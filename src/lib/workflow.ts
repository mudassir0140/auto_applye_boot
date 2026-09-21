import { prisma } from './prisma'
import { parseJsonList } from './session'
import type { CurrentUser } from './session'
import { searchJobs, calculateJobMatchScore, isRelevantJob, detectApplyFlow } from './jobs'
import { classifyJob } from './job-classifier'
import { fetchJobRelatedEmails, classifyJobEmail, getGoogleAccount, isGmailConnected, gmailIssueFrom, checkGmailHealth } from './gmail'
import { applyToJob, BLOCKING_APPLY_FAILURES } from './apply'

/**
 * The user's confirmed targeting. Keywords they typed/confirmed win; roles detected from
 * the CV are only used when they gave no keywords (CV text mentions many things they
 * do not want jobs in).
 */
function targeting(user: CurrentUser, overrideKeywords?: string[]) {
  const keywords = overrideKeywords?.length ? overrideKeywords : parseJsonList(user.jobKeywords)
  const skills = parseJsonList(user.skills)
  const roles = keywords.length ? [] : parseJsonList(user.preferredRoles)
  return { keywords, skills, roles }
}

/**
 * Find jobs for the user's profile and track them (per-user, de-duplicated by URL).
 * Each posting is classified (React/Next.js/JavaScript, Flutter, ...), kept only if its
 * role matches what the user targets, and stored with HOW it can be applied to.
 */
export async function discoverJobsForUser(user: CurrentUser, overrides?: { keywords?: string[]; location?: string }) {
  const { keywords, skills, roles } = targeting(user, overrides?.keywords)
  const locations = parseJsonList(user.jobLocations)
  if (keywords.length === 0 && roles.length === 0) return { found: 0, relevant: 0, added: 0 }

  const found = await searchJobs(keywords.length ? keywords : roles, overrides?.location ?? locations[0])
  const relevantJobs = found.filter((job) => isRelevantJob(job, skills, keywords, roles))
  const relevant = relevantJobs.length

  // One lookup + one bulk insert instead of an insert (= Atlas round trip) per posting.
  const known = await prisma.job.findMany({
    where: { userId: user.id, url: { in: relevantJobs.map((j) => j.url) } },
    select: { url: true },
  })
  const knownUrls = new Set(known.map((k) => k.url))
  const rows = relevantJobs
    .filter((job) => !knownUrls.has(job.url))
    .map((job) => {
      const cls = classifyJob(job)
      const flow = detectApplyFlow(job)
      return {
        userId: user.id,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        url: job.url,
        applyEmail: job.applyEmail,
        applyUrl: flow.applyUrl,
        applyMethod: flow.method,
        applyChannel: flow.channel,
        roleCategory: cls.primary,
        technologies: JSON.stringify(cls.technologies),
        source: job.source,
        salary: job.salary,
        jobType: job.jobType,
        skills: JSON.stringify(job.tags || []),
        matchScore: calculateJobMatchScore(job, skills, keywords, roles),
      }
    })

  let added = 0
  if (rows.length > 0) {
    try {
      added = (await prisma.job.createMany({ data: rows })).count
    } catch (error: any) {
      // A concurrent run (cron + manual search) saved some of them first: fall back to one by one.
      if (error?.code !== 'P2002') console.error('[workflow] bulk save failed, retrying individually:', error)
      for (const row of rows) {
        try {
          await prisma.job.create({ data: row })
          added++
        } catch (e: any) {
          if (e?.code !== 'P2002') console.error('[workflow] failed to save job:', e)
        }
      }
    }
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastJobSearchAt: new Date() } })
  if (added > 0) {
    await prisma.notification.create({
      data: { userId: user.id, type: 'jobs', title: 'New jobs found', message: `${added} new matching job(s) were added to your list.` },
    })
  }
  return { found: found.length, relevant, added }
}

const STATUS_BY_TYPE: Record<string, string> = {
  interview: 'interview',
  assessment: 'assessment',
  rejection: 'rejected',
  offer: 'offer',
  bounce: 'bounced',
}

const domainOf = (from: string) => (from.match(/@([a-z0-9.-]+)/i)?.[1] || '').toLowerCase()
/** Sender domain belongs to the company: a domain label equals the company name (or, for names of 5+ letters, starts/ends with it). */
function domainMatchesCompany(domain: string, token: string): boolean {
  const labels = domain.split('.').slice(0, -1).map((l) => l.replace(/[^a-z0-9]/g, ''))
  return labels.some((l) => l === token || (token.length >= 5 && (l.startsWith(token) || l.endsWith(token))))
}
const companyToken = (company: string) => company.toLowerCase().replace(/\b(inc|llc|ltd|gmbh|corp|co|limited|the)\b\.?/g, '').replace(/[^a-z0-9]/g, '')

/**
 * Read the user's Gmail and keep ONLY messages tied to one of THEIR applications:
 *  1. same Gmail thread as an email Boot sent (this also catches delivery-failure
 *     notices, which Gmail files in the thread of the message that bounced), or
 *  2. the sender's domain is the company's, or
 *  3. the subject names the company AND it is a real hiring message (not "other").
 * Newsletters, receipts and unrelated mail are ignored. Then classify (interview /
 * assessment / rejection / offer / bounce) and update the application status.
 */
export async function syncGmailForUser(user: CurrentUser) {
  const known = await prisma.jobEmail.findMany({ where: { userId: user.id }, select: { gmailMessageId: true } })
  const knownIds = new Set(known.map((k) => k.gmailMessageId))
  const emails = await fetchJobRelatedEmails(user.id, 30, knownIds)
  const applications = await prisma.jobApplication.findMany({ where: { userId: user.id }, include: { job: true } })
  const sent = await prisma.sentEmail.findMany({ where: { userId: user.id }, select: { gmailThreadId: true, applicationId: true } })
  const threadToApp = new Map(sent.filter((s) => s.gmailThreadId && s.applicationId).map((s) => [s.gmailThreadId!, s.applicationId!]))

  let saved = 0
  let bounced = 0
  for (const email of emails) {
    const emailType = classifyJobEmail(email.subject, email.body, email.from)

    let application = email.gmailThreadId && threadToApp.has(email.gmailThreadId)
      ? applications.find((a) => a.id === threadToApp.get(email.gmailThreadId!))
      : undefined

    if (!application && emailType !== 'bounce') {
      const senderDomain = domainOf(email.from)
      const subject = email.subject.toLowerCase().replace(/[^a-z0-9]/g, '')
      application = applications.find((a) => {
        const token = companyToken(a.job.company)
        if (token.length < 3) return false
        if (domainMatchesCompany(senderDomain, token)) return true
        return emailType !== 'other' && subject.includes(token)
      })
    }
    if (!application) continue

    try {
      await prisma.jobEmail.create({
        data: {
          userId: user.id,
          jobId: application.jobId,
          applicationId: application.id,
          gmailMessageId: email.gmailMessageId,
          gmailThreadId: email.gmailThreadId,
          from: email.from,
          subject: email.subject,
          body: email.body,
          emailType,
          status: emailType,
          receivedAt: email.receivedAt,
        },
      })
    } catch (error: any) {
      if (error?.code === 'P2002') continue // saved by a concurrent sync
      throw error
    }
    saved++

    const nextStatus = STATUS_BY_TYPE[emailType]
    if (!nextStatus) continue
    await prisma.jobApplication.update({ where: { id: application.id }, data: { status: nextStatus } })

    if (emailType === 'bounce') {
      // The message never reached the employer: this is NOT an application. Free the
      // 7-day cooldown so it can be retried with a corrected address, and say so.
      bounced++
      const reason = `Email to the employer bounced (${email.subject || 'delivery failed'})`
      await prisma.applicationHistory.updateMany({
        where: { userId: user.id, jobId: application.jobId, status: 'success' },
        data: { status: 'failed', notes: reason },
      })
      await prisma.job.update({ where: { id: application.jobId }, data: { applied: false, status: 'apply_failed', applyError: reason } })
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'application_failed',
          title: `Application NOT delivered: ${application.job.title} at ${application.job.company}`,
          message: reason,
        },
      })
      continue
    }

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: emailType,
        title: `${emailType[0].toUpperCase()}${emailType.slice(1)}: ${application.job.title} at ${application.job.company}`,
        message: `From: ${email.from} — ${email.subject}`,
      },
    })
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastGmailSyncAt: new Date() } })
  return { scanned: emails.length, saved, bounced }
}

/**
 * Is Gmail usable right now? If a problem was recorded earlier (API disabled, missing
 * permission) it is RE-CHECKED with one real API call, so enabling the Gmail API in
 * Google Cloud heals the app by itself — a stale "disabled" flag never blocks forever.
 */
export async function gmailUsable(userId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const account = await getGoogleAccount(userId)
  if (!isGmailConnected(account)) return { ok: false, reason: 'Gmail is not connected' }
  if (!gmailIssueFrom(account) && account?.gmailStatus !== null) return { ok: true }
  const health = await checkGmailHealth(userId)
  return health.ok ? { ok: true } : { ok: false, reason: health.message }
}

/**
 * Auto-apply (opt-in). Only jobs that (1) match the user's target role, (2) clear the
 * match-score floor, and (3) name a real application email are emailed from the user's
 * own Gmail with their CV. Everything else (ATS forms, job boards) is left for the user.
 * Stops immediately when Gmail itself is unusable instead of failing every job.
 */
export async function autoApplyForUser(user: CurrentUser) {
  const result = { applied: 0, skipped: 0, failed: 0, stoppedBecause: null as string | null }
  if (!user.autoApplyEnabled || !user.preferencesConfirmedAt) return result
  const usable = await gmailUsable(user.id)
  if (!usable.ok) return { ...result, stoppedBecause: usable.reason }

  const { keywords, skills, roles } = targeting(user)

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const today = await prisma.applicationHistory.count({ where: { userId: user.id, method: 'auto', status: 'success', appliedAt: { gte: since } } })
  let remaining = Math.max(0, user.autoApplyDailyLimit - today)

  const candidates = await prisma.job.findMany({
    where: {
      userId: user.id,
      applied: false,
      status: { in: ['new', 'saved'] },
      applyMethod: 'email',
      applyEmail: { not: null },
      matchScore: { gte: user.autoApplyMinScore },
    },
    orderBy: { matchScore: 'desc' },
    take: Math.max(remaining, 1) * 4,
  })

  for (const job of candidates) {
    if (remaining <= 0) break
    // Re-check the role against the user's CURRENT targeting (preferences may have changed since discovery).
    const stillRelevant = isRelevantJob({ title: job.title, description: job.description ?? undefined, tags: parseJsonList(job.skills) }, skills, keywords, roles)
    if (!stillRelevant) {
      result.skipped++
      continue
    }
    const outcome = await applyToJob(user, job.id, { method: 'email' })
    if (outcome.ok) {
      result.applied++
      remaining--
    } else if (BLOCKING_APPLY_FAILURES.includes(outcome.code)) {
      result.failed++
      result.stoppedBecause = outcome.message
      break
    } else if (outcome.code === 'send_failed') {
      result.failed++
    } else {
      result.skipped++
    }
  }
  return result
}

/** One full background pass for one user: discover → auto-apply → read Gmail. */
export async function runWorkflowForUser(user: CurrentUser) {
  const summary: Record<string, unknown> = { userId: user.id }
  if (!user.preferencesConfirmedAt) return { ...summary, skipped: 'preferences not confirmed' }
  try {
    summary.jobs = await discoverJobsForUser(user)
    summary.apply = await autoApplyForUser(user)
    const usable = await gmailUsable(user.id)
    if (usable.ok) summary.gmail = await syncGmailForUser(user)
    else summary.gmail = { skipped: usable.reason }
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error)
    console.error('[workflow] user run failed:', user.id, error)
  }
  return summary
}
