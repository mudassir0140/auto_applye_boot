import axios from 'axios'
import { classifyJob, userTracks, matchesUserTracks } from './job-classifier'

// Real job sources with free public JSON APIs (no scraping, no API keys).
export interface FoundJob {
  title: string
  company: string
  location?: string
  description?: string
  url: string
  applyEmail?: string
  /** Where a human applies (employer/ATS page) when there is no application email. */
  applyUrl?: string
  source: string
  salary?: string
  jobType?: string
  tags?: string[]
}

const HTTP = { timeout: 15000, headers: { 'User-Agent': 'Boot-JobAgent/1.0 (+https://github.com/mudassir0140/auto_applye_boot)' } }

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x?[0-9a-f]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const BAD_EMAIL = /^(no-?reply|donotreply|do-not-reply|privacy|abuse|support-noreply)@|@(example|sentry|domain|email)\./i

const RECRUITING_MAILBOX = /^(jobs?|careers?|hr|recruit(ing|ment|er|ers)?|talent|hiring|apply|applications?|cv|resume|people|work|join)$/i
// Mailboxes that are never a hiring inbox unless the posting explicitly says "send your CV to ...".
const GENERIC_MAILBOX = /^(support|help|info|contact|hello|sales|press|media|billing|legal|security|admin|webmaster|marketing|office|team|service|customer[a-z.-]*)$/i
const APPLY_CONTEXT = /(apply|applications?|send|submit|forward|cv|resume|résumé|e-?mail(?:ing)?\s+(?:your|us|a\b|the\b|it\b))[^\n@]{0,120}?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi

/**
 * A recruiter/apply address from the posting, or undefined. Deliberately strict —
 * a wrong address means Boot emails a stranger — so an address only counts when it is
 *  1. named in an "apply / send your CV to ..." sentence, or
 *  2. a recruiting mailbox (jobs@, careers@, hr@, talent@ ...).
 * Any other address in the text (support@, press@, a founder's or employee's address, one that
 * merely shares the company's domain) is ignored.
 */
export function extractApplyEmail(text: string, _company = ''): string | undefined {
  const all = Array.from(new Set((text.match(EMAIL_RE) || []).map((m) => m.toLowerCase()))).filter((m) => !BAD_EMAIL.test(m))
  if (all.length === 0) return undefined

  for (const m of text.matchAll(APPLY_CONTEXT)) {
    const e = m[2].toLowerCase()
    if (!BAD_EMAIL.test(e)) return e
  }
  const implicit = all.filter((e) => !GENERIC_MAILBOX.test(e.split('@')[0]))
  const mailbox = implicit.find((e) => RECRUITING_MAILBOX.test(e.split('@')[0]))
  if (mailbox) return mailbox
  return undefined
}

/** An employer/ATS application link inside the posting (checked on the raw HTML, so href="..." links count). */
export function extractAtsUrl(html: string): string | undefined {
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>)\]]+/gi)) {
    const url = m[0].replace(/[.,;:!?]+$/, '')
    if (ATS_HOSTS.some(([re, name]) => re.test(url) && name !== 'linkedin' && name !== 'indeed')) return url
  }
  return undefined
}

export type ApplyMethod = 'email' | 'external'
export interface ApplyFlow {
  method: ApplyMethod
  /** email | greenhouse | lever | ashby | workable | ... | the job board name */
  channel: string
  applyUrl: string
}

const ATS_HOSTS: Array<[RegExp, string]> = [
  [/greenhouse\.io/i, 'greenhouse'],
  [/lever\.co/i, 'lever'],
  [/ashbyhq\.com/i, 'ashby'],
  [/workable\.com/i, 'workable'],
  [/smartrecruiters\.com/i, 'smartrecruiters'],
  [/myworkdayjobs\.com|workday\.com/i, 'workday'],
  [/breezy\.hr/i, 'breezy'],
  [/recruitee\.com/i, 'recruitee'],
  [/teamtailor\.com/i, 'teamtailor'],
  [/bamboohr\.com/i, 'bamboohr'],
  [/personio\./i, 'personio'],
  [/linkedin\.com/i, 'linkedin'],
  [/indeed\.com/i, 'indeed'],
]

/**
 * How can this job legitimately be applied to?
 *  - email: the posting names an application address -> Boot sends it from the user's Gmail.
 *  - external: an employer/ATS form or a job board. ATS submission APIs need the
 *    employer's private API key and the forms are captcha-protected, so Boot does NOT
 *    pretend to submit them: it links the user straight to the form and tracks the result.
 */
export function detectApplyFlow(job: Pick<FoundJob, 'url' | 'applyUrl' | 'applyEmail' | 'source'>): ApplyFlow {
  const applyUrl = job.applyUrl || job.url
  if (job.applyEmail) return { method: 'email', channel: 'email', applyUrl }
  const ats = ATS_HOSTS.find(([re]) => re.test(applyUrl))
  return { method: 'external', channel: ats ? ats[1] : job.source, applyUrl }
}

// Arbeitnow and RemoteOK return their WHOLE feed regardless of keyword. It used to be
// downloaded again for every keyword (up to 5x per search); now it is fetched once and
// reused for a few minutes (also by repeated searches / the cron run).
const feedCache = new Map<string, { at: number; data: Promise<any> }>()
function cachedFeed(url: string): Promise<any> {
  const hit = feedCache.get(url)
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.data
  const data = axios.get(url, HTTP).then((r) => r.data)
  feedCache.set(url, { at: Date.now(), data })
  data.catch(() => feedCache.delete(url))
  return data
}

async function fromRemotive(keyword: string): Promise<FoundJob[]> {
  const { data } = await axios.get('https://remotive.com/api/remote-jobs', { ...HTTP, params: { search: keyword, limit: 30 } })
  return (data.jobs || []).map((j: any): FoundJob => {
    const description = stripHtml(j.description || '')
    return {
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || 'Remote',
      description: description.slice(0, 6000),
      url: j.url,
      applyEmail: extractApplyEmail(description, j.company_name || j.company || ''),
      applyUrl: extractAtsUrl(j.description || ''),
      source: 'remotive',
      salary: j.salary || undefined,
      jobType: j.job_type || undefined,
      tags: j.tags || [],
    }
  })
}

async function fromArbeitnow(keyword: string): Promise<FoundJob[]> {
  const data = await cachedFeed('https://www.arbeitnow.com/api/job-board-api')
  const kw = keyword.toLowerCase()
  return (data.data || [])
    .filter((j: any) => `${j.title} ${(j.tags || []).join(' ')} ${j.description || ''}`.toLowerCase().includes(kw))
    .map((j: any): FoundJob => {
      const description = stripHtml(j.description || '')
      return {
        title: j.title,
        company: j.company_name,
        location: j.remote ? `Remote${j.location ? ` (${j.location})` : ''}` : j.location,
        description: description.slice(0, 6000),
        url: j.url,
        applyEmail: extractApplyEmail(description, j.company_name || j.company || ''),
      applyUrl: extractAtsUrl(j.description || ''),
        source: 'arbeitnow',
        jobType: (j.job_types || []).join(', ') || undefined,
        tags: j.tags || [],
      }
    })
}

async function fromRemoteOk(keyword: string): Promise<FoundJob[]> {
  const data = await cachedFeed('https://remoteok.com/api')
  const kw = keyword.toLowerCase()
  return (Array.isArray(data) ? data : [])
    .filter((j: any) => j.position && j.url && `${j.position} ${(j.tags || []).join(' ')}`.toLowerCase().includes(kw))
    .map((j: any): FoundJob => {
      const description = stripHtml(j.description || '')
      return {
        title: j.position,
        company: j.company,
        location: j.location || 'Remote',
        description: description.slice(0, 6000),
        url: j.url,
        applyEmail: extractApplyEmail(description, j.company_name || j.company || ''),
        applyUrl: j.apply_url || extractAtsUrl(j.description || ''),
        source: 'remoteok',
        salary: j.salary_min ? `$${j.salary_min}–$${j.salary_max}` : undefined,
        tags: j.tags || [],
      }
    })
}

export async function searchJobs(keywords: string[], location?: string): Promise<FoundJob[]> {
  const out = new Map<string, FoundJob>()
  const loc = location?.toLowerCase().trim()

  const perKeyword = await Promise.all(
    keywords.slice(0, 5).map((keyword) => Promise.allSettled([fromRemotive(keyword), fromArbeitnow(keyword), fromRemoteOk(keyword)]))
  )
  for (const results of perKeyword) {
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[jobs] source failed:', r.reason?.message || r.reason)
        continue
      }
      for (const job of r.value) {
        if (!job.title || !job.company || !job.url) continue
        if (loc && loc !== 'remote' && job.location && !job.location.toLowerCase().includes(loc) && !/remote|anywhere|worldwide/i.test(job.location)) continue
        out.set(job.url, job)
      }
    }
  }
  return Array.from(out.values())
}

const MIN_RELEVANT_SCORE = 25

const termHits = (text: string, term: string) =>
  new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(text)

/**
 * A posting is only worth tracking (and applying to) when its ROLE matches what the
 * user targets. The posting is classified (React/Next.js/JavaScript, Flutter, React
 * Native, Node, ...) from its title/tags, and must fall in a track the user's
 * confirmed keywords / roles / skills point at — a Flutter developer never gets
 * React-only roles, a React developer never gets Vue, Java or Flutter ones.
 * Keywords that map to no known track (e.g. "data analyst") fall back to plain
 * title/tag term matching. The match score must also clear a floor.
 */
export function isRelevantJob(
  job: Pick<FoundJob, 'title' | 'description' | 'tags'>,
  skills: string[],
  keywords: string[],
  roles: string[] = []
): boolean {
  const user = userTracks(skills, keywords, roles)
  const cls = classifyJob(job)

  if (user.tracks.size > 0) {
    if (!matchesUserTracks(cls, user)) return false
    return calculateJobMatchScore(job, skills, keywords, roles) >= MIN_RELEVANT_SCORE
  }

  const terms = Array.from(new Set([...skills, ...keywords, ...roles].map((s) => s.toLowerCase().trim()).filter((s) => s.length > 1)))
  if (terms.length === 0) return false
  const headline = `${job.title} ${(job.tags || []).join(' ')}`.toLowerCase()
  if (!terms.some((t) => termHits(headline, t))) return false
  return calculateJobMatchScore(job, skills, keywords, roles) >= MIN_RELEVANT_SCORE
}

/** 0–100: how many of the user's skills/keywords the posting mentions, plus title hits and a role-match bonus. */
export function calculateJobMatchScore(
  job: Pick<FoundJob, 'title' | 'description' | 'tags'>,
  skills: string[],
  keywords: string[],
  roles: string[] = []
): number {
  const haystack = `${job.title} ${(job.tags || []).join(' ')} ${job.description || ''}`.toLowerCase()
  const title = job.title.toLowerCase()
  const terms = Array.from(new Set([...skills, ...keywords].map((s) => s.toLowerCase().trim()).filter(Boolean)))
  if (terms.length === 0) return 0

  const matched = terms.filter((t) => termHits(haystack, t)).length
  const titleHits = keywords.filter((k) => k && title.includes(k.toLowerCase())).length
  const roleBonus = matchesUserTracks(classifyJob(job), userTracks(skills, keywords, roles)) ? 15 : 0

  const base = (matched / Math.min(terms.length, 8)) * 80
  return Math.min(100, Math.round(base + Math.min(titleHits, 2) * 10 + roleBonus))
}
