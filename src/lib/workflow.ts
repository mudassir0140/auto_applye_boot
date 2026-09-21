import { prisma } from './prisma'
import { parseJsonList } from './session'
import type { CurrentUser } from './session'
import { searchJobs, calculateJobMatchScore, isRelevantJob } from './jobs'
import { fetchJobRelatedEmails, classifyJobEmail, getGoogleAccount, isGmailConnected } from './gmail'
import { applyToJob } from './apply'

/** Find jobs for the user's confirmed keywords and track them (per-user, de-duplicated by URL). */
export async function discoverJobsForUser(user: CurrentUser, overrides?: { keywords?: string[]; location?: string }) {
  const keywords = overrides?.keywords?.length ? overrides.keywords : parseJsonList(user.jobKeywords)
  const locations = parseJsonList(user.jobLocations)
  const skills = parseJsonList(user.skills)
  if (keywords.length === 0) return { found: 0, added: 0 }

  const found = await searchJobs(keywords, overrides?.location ?? locations[0])
  const relevantJobs = found.filter((job) => isRelevantJob(job, skills, keywords))
  const relevant = relevantJobs.length

  // One lookup + one bulk insert instead of an insert (= Atlas round trip) per posting.
  const known = await prisma.job.findMany({
    where: { userId: user.id, url: { in: relevantJobs.map((j) => j.url) } },
    select: { url: true },
  })
  const knownUrls = new Set(known.map((k) => k.url))
  const rows = relevantJobs
    .filter((job) => !knownUrls.has(job.url))
    .map((job) => ({
      userId: user.id,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      url: job.url,
      applyEmail: job.applyEmail,
      source: job.source,
      salary: job.salary,
      jobType: job.jobType,
      skills: JSON.stringify(job.tags || []),
      matchScore: calculateJobMatchScore(job, skills, keywords),
    }))

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
}

const domainOf = (from: string) => (from.match(/@([a-z0-9.-]+)/i)?.[1] || '').toLowerCase()
const companyToken = (company: string) => company.toLowerCase().replace(/\b(inc|llc|ltd|gmbh|corp|co|limited|the)\b\.?/g, '').replace(/[^a-z0-9]/g, '')

/**
 * Read the user's Gmail and keep only messages tied to one of THEIR applications:
 * same Gmail thread as an email Boot sent, or sender/subject naming the company.
 * Then classify (interview / assessment / rejection / offer) and update the status.
 */
export async function syncGmailForUser(user: CurrentUser) {
  const known = await prisma.jobEmail.findMany({ where: { userId: user.id }, select: { gmailMessageId: true } })
  const knownIds = new Set(known.map((k) => k.gmailMessageId))
  const emails = await fetchJobRelatedEmails(user.id, 30, knownIds)
  const applications = await prisma.jobApplication.findMany({ where: { userId: user.id }, include: { job: true } })
  const sent = await prisma.sentEmail.findMany({ where: { userId: user.id }, select: { gmailThreadId: true, applicationId: true } })
  const threadToApp = new Map(sent.filter((s) => s.gmailThreadId && s.applicationId).map((s) => [s.gmailThreadId!, s.applicationId!]))

  let saved = 0
  for (const email of emails) {
    let application = email.gmailThreadId && threadToApp.has(email.gmailThreadId)
      ? applications.find((a) => a.id === threadToApp.get(email.gmailThreadId!))
      : undefined

    if (!application) {
      const senderDomain = domainOf(email.from)
      const haystack = `${email.from} ${email.subject}`.toLowerCase().replace(/[^a-z0-9@. ]/g, '')
      application = applications.find((a) => {
        const token = companyToken(a.job.company)
        return token.length >= 3 && (senderDomain.replace(/[^a-z0-9]/g, '').includes(token) || haystack.replace(/ /g, '').includes(token))
      })
    }
    if (!application) continue

    const emailType = classifyJobEmail(email.subject, email.body)
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
    saved++

    const nextStatus = STATUS_BY_TYPE[emailType]
    if (nextStatus) {
      await prisma.jobApplication.update({ where: { id: application.id }, data: { status: nextStatus } })
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: emailType,
          title: `${emailType[0].toUpperCase()}${emailType.slice(1)}: ${application.job.title} at ${application.job.company}`,
          message: `From: ${email.from} — ${email.subject}`,
        },
      })
    }
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastGmailSyncAt: new Date() } })
  return { scanned: emails.length, saved }
}

/** Auto-apply (opt-in) to well-matching jobs that have a real application email. */
export async function autoApplyForUser(user: CurrentUser) {
  if (!user.autoApplyEnabled || !user.preferencesConfirmedAt) return { applied: 0, skipped: 0 }
  const account = await getGoogleAccount(user.id)
  if (!isGmailConnected(account)) return { applied: 0, skipped: 0 }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const today = await prisma.applicationHistory.count({ where: { userId: user.id, method: 'auto', status: 'success', appliedAt: { gte: since } } })
  let remaining = Math.max(0, user.autoApplyDailyLimit - today)

  const candidates = await prisma.job.findMany({
    where: {
      userId: user.id,
      applied: false,
      status: { in: ['new', 'saved'] },
      applyEmail: { not: null },
      matchScore: { gte: user.autoApplyMinScore },
    },
    orderBy: { matchScore: 'desc' },
    take: remaining * 3,
  })

  let applied = 0
  let skipped = 0
  for (const job of candidates) {
    if (remaining <= 0) break
    const result = await applyToJob(user, job.id, { method: 'email' })
    if (result.ok) {
      applied++
      remaining--
    } else {
      skipped++
      if (result.code === 'gmail_not_connected') break
    }
  }
  return { applied, skipped }
}

/** One full background pass for one user: discover → auto-apply → read Gmail. */
export async function runWorkflowForUser(user: CurrentUser) {
  const summary: Record<string, unknown> = { userId: user.id }
  if (!user.preferencesConfirmedAt) return { ...summary, skipped: 'preferences not confirmed' }
  try {
    summary.jobs = await discoverJobsForUser(user)
    summary.apply = await autoApplyForUser(user)
    const account = await getGoogleAccount(user.id)
    if (isGmailConnected(account)) summary.gmail = await syncGmailForUser(user)
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error)
    console.error('[workflow] user run failed:', user.id, error)
  }
  return summary
}
