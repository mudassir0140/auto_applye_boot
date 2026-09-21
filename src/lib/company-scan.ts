import axios from 'axios'
import { stripHtml } from './jobs'

// Reads a company's OWN public website (home, careers, contact pages) and reports only
// what is literally on those pages: relevant openings and public contact email addresses.
// Polite by design: honours robots.txt, at most MAX_PAGES requests per company, short timeouts.

const UA = 'Boot-JobAgent/1.0 (job-seeker outreach; respects robots.txt)'
const MAX_PAGES = 6

export interface Opening {
  title: string
  url: string
}

export interface SiteScan {
  reachable: boolean
  error?: string
  careersUrl?: string
  openings: Opening[]
  /** Public recruiting/general business mailboxes (jobs@, careers@, hr@, info@, contact@ ...) literally shown on the company's own site, best hiring candidate first. */
  emails: Array<{ email: string; page: string }>
}

const RELEVANT_TITLE = /(front[\s-]?end|react(?![a-z])|next\.?js|javascript|java[\s-]?script|\bjs\b|web developer|ui developer|intern(ship)?s?\b|trainee)/i
const NOT_JUNIOR_FIT = /(senior|\bsr\.?\s|lead\b|principal|staff\b|architect|head of|director|manager|\bcto\b|backend|back-end|\.net|php|python|devops|data (engineer|scientist)|\bqa\b|sales|marketing|accountant|designer)/i

/** A title worth applying to as a junior / intern frontend developer. */
export function isRelevantOpening(title: string): boolean {
  const t = title.replace(/\s+/g, ' ').trim()
  if (t.length < 5 || t.length > 100) return false
  if (!RELEVANT_TITLE.test(t)) return false
  // "Senior React Developer" is not a fit; "Junior/Intern/Trainee" wins over a stray exclusion word.
  if (/(junior|\bjr\b|intern|trainee|graduate|entry)/i.test(t)) return !/(backend|back-end|\.net|php|python|devops|sales|marketing)/i.test(t)
  return !NOT_JUNIOR_FIT.test(t)
}

const RECRUITING_MAILBOX = /^(jobs?|careers?|hr|recruit(ing|ment|er|ers)?|talent|hiring|apply|applications?|cv|resume|people|join|internships?)$/i
const GENERAL_MAILBOX = /^(info|contact|hello|hi|office|team|enquiries|inquiries|admin|mail|business)$/i
const BAD_MAILBOX = /^(no-?reply|donotreply|privacy|abuse|postmaster|webmaster|security|legal|billing|sales|support|help|press|media|marketing|dpo|gdpr)$/i

const rank = (email: string) => {
  const box = email.split('@')[0]
  return RECRUITING_MAILBOX.test(box) ? 0 : GENERAL_MAILBOX.test(box) ? 1 : 2
}

export const isRecruitingMailbox = (email: string) => RECRUITING_MAILBOX.test(email.split('@')[0])

const sameSite = (host: string, domain: string) => {
  const h = host.toLowerCase().replace(/^www\./, '')
  return h === domain || h.endsWith(`.${domain}`)
}

/** Cloudflare's "email protection" hides addresses in data-cfemail; a browser shows the real address, so decode it. */
function decodeCfEmail(hex: string): string {
  const key = parseInt(hex.slice(0, 2), 16)
  let out = ''
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key)
  return out
}

/** Public addresses literally present on the page AND on the company's own domain. Never guessed. */
export function extractPublicEmails(html: string, domain: string): string[] {
  const found = new Set<string>()
  const add = (raw: string) => {
    const e = raw.trim().toLowerCase().replace(/^mailto:/, '').split('?')[0]
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) return
    const [box, host] = e.split('@')
    if (BAD_MAILBOX.test(box) || !sameSite(host, domain)) return
    found.add(e)
  }
  for (const m of html.matchAll(/mailto:([^"'\s>]+)/gi)) {
    try {
      add(decodeURIComponent(m[1].replace(/&amp;/g, '&')))
    } catch {}
  }
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) add(decodeCfEmail(m[1]))
  for (const m of stripHtml(html).matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) add(m[0])
  // Personal-looking mailboxes (firstname@) are dropped: only role mailboxes are business contacts.
  return Array.from(found).filter((e) => rank(e) < 2).sort((a, b) => rank(a) - rank(b))
}

function anchors(html: string, base: string): Array<{ text: string; url: string }> {
  const out: Array<{ text: string; url: string }> = []
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(m[1].replace(/&amp;/g, '&'), base)
      if (/^https?:$/.test(url.protocol)) out.push({ text: stripHtml(m[2]).replace(/\s+/g, ' ').trim(), url: url.toString() })
    } catch {}
  }
  return out
}

export function openingsFrom(html: string, pageUrl: string): Opening[] {
  const found = new Map<string, Opening>()
  const add = (title: string, url: string) => {
    const t = title.replace(/\s+/g, ' ').trim()
    if (isRelevantOpening(t) && !found.has(t.toLowerCase())) found.set(t.toLowerCase(), { title: t, url })
  }
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n: any) => {
        if (Array.isArray(n)) return n.forEach(walk)
        if (n && typeof n === 'object') {
          if (n['@type'] === 'JobPosting' && n.title) add(String(n.title), String(n.url || pageUrl))
          Object.values(n).forEach(walk)
        }
      }
      walk(JSON.parse(m[1]))
    } catch {}
  }
  for (const a of anchors(html, pageUrl)) add(a.text, a.url)
  for (const m of html.matchAll(/<(h[1-6]|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = stripHtml(m[2]).replace(/\s+/g, ' ').trim()
    if (text.length <= 100) add(text, pageUrl)
  }
  return Array.from(found.values())
}

function robotsAllows(robots: string, path: string): boolean {
  let applies = false
  let allowed = true
  let longest = -1
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const [k, ...rest] = line.split(':')
    const v = rest.join(':').trim()
    if (/^user-agent$/i.test(k)) applies = v === '*'
    else if (applies && /^(dis)?allow$/i.test(k) && v && path.startsWith(v.replace(/\*.*$/, '')) && v.length > longest) {
      longest = v.length
      allowed = /^allow$/i.test(k)
    }
  }
  return allowed
}

export async function scanCompanySite(website: string, domain: string): Promise<SiteScan> {
  let pages = 0
  const scan: SiteScan = { reachable: false, openings: [], emails: [] }
  let robots = ''
  try {
    robots = String((await axios.get(`${website}/robots.txt`, { timeout: 8000, headers: { 'User-Agent': UA }, responseType: 'text', validateStatus: (s) => s === 200 })).data || '')
  } catch {}

  const get = async (url: string): Promise<string | null> => {
    if (pages >= MAX_PAGES) return null
    let u: URL
    try {
      u = new URL(url)
    } catch {
      return null
    }
    if (!sameSite(u.hostname, domain) || !robotsAllows(robots, u.pathname)) return null
    pages++
    try {
      const res = await axios.get(u.toString(), {
        timeout: 10000, maxRedirects: 3, maxContentLength: 2_000_000, responseType: 'text',
        headers: { 'User-Agent': UA, Accept: 'text/html' },
      })
      return /html|xml|text/i.test(String(res.headers?.['content-type'] || 'text/html')) ? String(res.data) : null
    } catch {
      return null
    }
  }

  const collectEmails = (html: string, page: string) => {
    for (const email of extractPublicEmails(html, domain)) if (!scan.emails.some((e) => e.email === email)) scan.emails.push({ email, page })
  }

  const home = await get(`${website}/`)
  if (home == null) return { ...scan, error: 'Website could not be read (unreachable or blocked by robots.txt).' }
  scan.reachable = true
  collectEmails(home, `${website}/`)

  const links = anchors(home, `${website}/`).filter((a) => sameSite(new URL(a.url).hostname, domain))
  const careers = links.find((a) => /career|jobs?\b|join[\s-]?(us|our|the)|work[\s-]with[\s-]us|hiring|vacanc|opportunit|internship/i.test(`${a.text} ${new URL(a.url).pathname}`))
  const careerCandidates = [careers?.url, `${website}/careers`, `${website}/jobs`, `${website}/career`].filter((u): u is string => !!u)
  for (const url of Array.from(new Set(careerCandidates))) {
    const html = await get(url)
    if (html == null) continue
    scan.careersUrl = url
    scan.openings = openingsFrom(html, url)
    collectEmails(html, url)
    break
  }

  if (!scan.emails.length) {
    const contact = links.find((a) => /contact|reach[\s-]us|get[\s-]in[\s-]touch/i.test(`${a.text} ${new URL(a.url).pathname}`))
    for (const url of Array.from(new Set([contact?.url, `${website}/contact`, `${website}/contact-us`].filter((u): u is string => !!u)))) {
      const html = await get(url)
      if (html != null) collectEmails(html, url)
      if (scan.emails.length) break
    }
  }
  scan.emails.sort((a, b) => rank(a.email) - rank(b.email))
  return scan
}
