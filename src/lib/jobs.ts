import axios from 'axios'

// Real job sources with free public JSON APIs (no scraping, no API keys).
export interface FoundJob {
  title: string
  company: string
  location?: string
  description?: string
  url: string
  applyEmail?: string
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

/** A real recruiter/apply address from the posting text, or undefined. */
export function extractApplyEmail(text: string): string | undefined {
  const matches = text.match(EMAIL_RE) || []
  return matches.find((m) => !BAD_EMAIL.test(m))?.toLowerCase()
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
      applyEmail: extractApplyEmail(description),
      source: 'remotive',
      salary: j.salary || undefined,
      jobType: j.job_type || undefined,
      tags: j.tags || [],
    }
  })
}

async function fromArbeitnow(keyword: string): Promise<FoundJob[]> {
  const { data } = await axios.get('https://www.arbeitnow.com/api/job-board-api', HTTP)
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
        applyEmail: extractApplyEmail(description),
        source: 'arbeitnow',
        jobType: (j.job_types || []).join(', ') || undefined,
        tags: j.tags || [],
      }
    })
}

async function fromRemoteOk(keyword: string): Promise<FoundJob[]> {
  const { data } = await axios.get('https://remoteok.com/api', HTTP)
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
        applyEmail: extractApplyEmail(description),
        source: 'remoteok',
        salary: j.salary_min ? `$${j.salary_min}–$${j.salary_max}` : undefined,
        tags: j.tags || [],
      }
    })
}

export async function searchJobs(keywords: string[], location?: string): Promise<FoundJob[]> {
  const out = new Map<string, FoundJob>()
  const loc = location?.toLowerCase().trim()

  for (const keyword of keywords.slice(0, 5)) {
    const results = await Promise.allSettled([fromRemotive(keyword), fromArbeitnow(keyword), fromRemoteOk(keyword)])
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

/** 0–100: how many of the user's skills/keywords the posting mentions, plus title hits. */
export function calculateJobMatchScore(job: Pick<FoundJob, 'title' | 'description' | 'tags'>, skills: string[], keywords: string[]): number {
  const haystack = `${job.title} ${(job.tags || []).join(' ')} ${job.description || ''}`.toLowerCase()
  const title = job.title.toLowerCase()
  const terms = Array.from(new Set([...skills, ...keywords].map((s) => s.toLowerCase().trim()).filter(Boolean)))
  if (terms.length === 0) return 0

  const hit = (t: string) => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(haystack)
  const matched = terms.filter(hit).length
  const titleHits = keywords.filter((k) => k && title.includes(k.toLowerCase())).length

  const base = (matched / Math.min(terms.length, 8)) * 80
  return Math.min(100, Math.round(base + Math.min(titleHits, 2) * 10))
}
