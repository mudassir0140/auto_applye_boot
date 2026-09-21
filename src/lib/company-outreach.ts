import { prisma } from './prisma'
import type { CurrentUser } from './session'
import { parseJsonList } from './session'
import { discoverCompanies, normalizeWebsite, type DiscoveredCompany } from './company-discovery'
import { scanCompanySite } from './company-scan'
import { applyToJob, BLOCKING_APPLY_FAILURES } from './apply'
import { gmailUsable } from './workflow'

const RESCAN_AFTER_MS = 14 * 24 * 60 * 60 * 1000
const MAX_SCANS_PER_RUN = 15

export const INQUIRY_TITLE = 'Frontend Developer / Internship (general inquiry)'

export interface OutreachSummary {
  discovered: number
  scanned: number
  applied: number
  inquiries: number
  jobsWithoutEmail: number
  noOpeningsNoEmail: number
  unreachable: number
  failed: number
  notes: string[]
  stoppedBecause: string | null
}

/**
 * Discover software houses / IT companies (Google Maps + Google Search official APIs, plus any
 * websites passed in), read their public sites, and email them from the user's own Gmail:
 *  - a relevant opening was found  -> a personalised application for THAT title;
 *  - no opening, but a public business address exists -> a general frontend / internship inquiry;
 *  - neither -> nothing is sent and the reason is stored on the company.
 * Every send goes through applyToJob, so the CV attachment, 7-day duplicate protection, Gmail
 * error handling and SentEmail / Application / History records are the same as for job-board jobs.
 * A company that was emailed is never emailed again.
 */
export async function runCompanyOutreach(user: CurrentUser, opts: { websites?: string[]; maxSends?: number; scan?: typeof scanCompanySite } = {}): Promise<OutreachSummary> {
  const summary: OutreachSummary = { discovered: 0, scanned: 0, applied: 0, inquiries: 0, jobsWithoutEmail: 0, noOpeningsNoEmail: 0, unreachable: 0, failed: 0, notes: [], stoppedBecause: null }

  const usable = await gmailUsable(user.id)
  if (!usable.ok) return { ...summary, stoppedBecause: usable.reason }

  // 1. Discover and remember companies (unique per user + website domain).
  const report = await discoverCompanies(parseJsonList(user.jobLocations)[0])
  summary.notes.push(...report.notes)
  const found: DiscoveredCompany[] = [...report.companies]
  for (const url of opts.websites || []) {
    const site = normalizeWebsite(url)
    if (site) found.push({ name: site.domain, website: site.website, source: 'manual' })
    else summary.notes.push(`Ignored "${url}": not a company website.`)
  }
  for (const c of found) {
    const site = normalizeWebsite(c.website)
    if (!site) continue
    const exists = await prisma.company.findUnique({ where: { userId_domain: { userId: user.id, domain: site.domain } }, select: { id: true } })
    if (exists) continue
    await prisma.company
      .create({ data: { userId: user.id, name: c.name, website: site.website, domain: site.domain, source: c.source, sourceRef: c.sourceRef, address: c.address } })
      .then(() => summary.discovered++)
      .catch(() => {}) // saved by a concurrent run
  }

  // 2. Companies still to check: never scanned, or last checked long ago without a result.
  const stale = new Date(Date.now() - RESCAN_AFTER_MS)
  const pending = await prisma.company.findMany({
    where: {
      userId: user.id,
      OR: [{ status: 'discovered' }, { status: { in: ['no_openings_no_email', 'job_found_no_email', 'site_unreachable', 'failed'] }, scannedAt: { lt: stale } }],
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_SCANS_PER_RUN,
  })

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const today = await prisma.applicationHistory.count({ where: { userId: user.id, method: 'auto', status: 'success', appliedAt: { gte: since } } })
  let remaining = Math.min(opts.maxSends ?? Infinity, Math.max(0, user.autoApplyDailyLimit - today))

  for (const company of pending) {
    if (remaining <= 0) {
      summary.stoppedBecause = 'Daily send limit reached'
      break
    }
    const scan = await (opts.scan ?? scanCompanySite)(company.website, company.domain)
    summary.scanned++
    const base = { scannedAt: new Date(), careersUrl: scan.careersUrl ?? null }

    if (!scan.reachable) {
      summary.unreachable++
      await prisma.company.update({ where: { id: company.id }, data: { ...base, status: 'site_unreachable', statusMessage: scan.error } })
      continue
    }

    // scan.emails only holds role mailboxes (jobs@, careers@, info@ ...) literally shown on the company's own site.
    const contact = scan.emails[0]
    const opening = scan.openings[0]
    const found = { contactEmail: contact?.email ?? null, contactEmailFrom: contact?.page ?? null, openingTitle: opening?.title ?? null, openingUrl: opening?.url ?? null }

    if (!contact) {
      if (opening) {
        summary.jobsWithoutEmail++
        // A real opening but no address to write to: keep it as a job the user can apply to on the site.
        await saveOpeningAsJob(user.id, company, opening, null)
        await prisma.company.update({
          where: { id: company.id },
          data: { ...base, ...found, status: 'job_found_no_email', statusMessage: `Opening "${opening.title}" found, but the site shows no public contact email. Apply at ${opening.url}` },
        })
      } else {
        summary.noOpeningsNoEmail++
        await prisma.company.update({ where: { id: company.id }, data: { ...base, ...found, status: 'no_openings_no_email', statusMessage: 'No relevant opening and no public contact email on the website.' } })
      }
      continue
    }

    const inquiry = !opening
    const jobId = opening ? await saveOpeningAsJob(user.id, company, opening, contact.email) : await saveInquiryJob(user.id, company, contact.email)
    if (!jobId) {
      await prisma.company.update({ where: { id: company.id }, data: { ...base, ...found, status: 'failed', statusMessage: 'Could not save the job record.' } })
      summary.failed++
      continue
    }

    const result = await applyToJob(user, jobId, { method: 'email', recipientEmail: contact.email, company: { companyId: company.id, website: company.website, source: company.source, inquiry } })
    if (result.ok) {
      remaining--
      inquiry ? summary.inquiries++ : summary.applied++
      await prisma.company.update({
        where: { id: company.id },
        data: { ...base, ...found, status: 'contacted', contactedAt: new Date(), statusMessage: inquiry ? `General inquiry emailed to ${contact.email}` : `Applied for "${opening!.title}" via ${contact.email}` },
      })
    } else if (result.code === 'already_applied' || result.code === 'cooldown') {
      await prisma.company.update({ where: { id: company.id }, data: { ...base, ...found, status: 'contacted', statusMessage: result.message } })
    } else {
      summary.failed++
      await prisma.company.update({ where: { id: company.id }, data: { ...base, ...found, status: 'failed', statusMessage: result.message } })
      if (BLOCKING_APPLY_FAILURES.includes(result.code)) {
        summary.stoppedBecause = result.message
        break
      }
    }
  }
  return summary
}

async function upsertJob(userId: string, data: { title: string; company: string; url: string; source: string; applyEmail: string | null; applyUrl: string; description?: string }): Promise<string | null> {
  try {
    const row = await prisma.job.upsert({
      where: { userId_url: { userId, url: data.url } },
      create: { userId, ...data, applyMethod: data.applyEmail ? 'email' : 'external', applyChannel: data.applyEmail ? 'email' : 'company_site', roleCategory: 'company_outreach' },
      update: {},
    })
    return row.id
  } catch (error) {
    console.error('[company-outreach] failed to save job:', error)
    return null
  }
}

const saveOpeningAsJob = (userId: string, c: { name: string; source: string }, opening: { title: string; url: string }, email: string | null) =>
  upsertJob(userId, { title: opening.title, company: c.name, url: opening.url, source: c.source, applyEmail: email, applyUrl: opening.url })

const saveInquiryJob = (userId: string, c: { name: string; source: string; website: string }, email: string) =>
  upsertJob(userId, {
    title: INQUIRY_TITLE,
    company: c.name,
    url: `${c.website}/#frontend-internship-inquiry`,
    source: c.source,
    applyEmail: email,
    applyUrl: c.website,
    description: 'No specific opening was listed on the company website; a general inquiry was sent to its public business email.',
  })
