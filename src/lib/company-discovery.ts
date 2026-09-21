import axios from 'axios'

// Company discovery through Google's OFFICIAL APIs only (no scraping of Google pages):
//  - Google Maps: Places API (New) "Text Search"   -> GOOGLE_MAPS_API_KEY
//  - Google Search: Custom Search JSON API          -> GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX
// A provider without its key reports "not configured"; nothing is ever made up.

export interface DiscoveredCompany {
  name: string
  website: string
  source: 'google_maps' | 'google_search' | 'manual'
  sourceRef?: string
  address?: string
}

export interface DiscoveryReport {
  companies: DiscoveredCompany[]
  /** Human-readable status per provider, surfaced to the user (missing keys, API errors). */
  notes: string[]
}

const HTTP = { timeout: 15000 }

/** Directories, social networks and job boards are not the company's own website. */
const NOT_A_COMPANY_SITE =
  /(^|\.)(linkedin|facebook|instagram|twitter|x|youtube|tiktok|glassdoor|indeed|clutch|goodfirms|upwork|fiverr|yelp|wikipedia|crunchbase|rozee|mustakbil|medium|reddit|pinterest|github|google|justdial|yellowpages|topdevelopers|designrush|sortlist|themanifest|g2|capterra|trustpilot|zoominfo|dnb|apollo|cbinsights|bayt)\.[a-z.]+$/i

export function normalizeWebsite(url: string): { website: string; domain: string } | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null
    const domain = u.hostname.toLowerCase().replace(/^www\./, '')
    if (NOT_A_COMPANY_SITE.test(domain)) return null
    return { website: `${u.protocol}//${u.host}`, domain }
  } catch {
    return null
  }
}

export function discoveryQueries(city: string | undefined): string[] {
  const where = city ? ` in ${city}` : ''
  return [`software house${where}`, `IT company${where}`, `web development company${where}`]
}

async function fromGoogleMaps(queries: string[], notes: string[]): Promise<DiscoveredCompany[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    notes.push('Google Maps not configured: set GOOGLE_MAPS_API_KEY (Places API (New) enabled in Google Cloud).')
    return []
  }
  const out: DiscoveredCompany[] = []
  for (const textQuery of queries) {
    try {
      const { data } = await axios.post(
        'https://places.googleapis.com/v1/places:searchText',
        { textQuery, pageSize: 20 },
        {
          ...HTTP,
          headers: {
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.formattedAddress,places.businessStatus',
          },
        }
      )
      for (const p of data.places || []) {
        if (!p.websiteUri || (p.businessStatus && p.businessStatus !== 'OPERATIONAL')) continue
        out.push({ name: p.displayName?.text || '', website: p.websiteUri, source: 'google_maps', sourceRef: p.id, address: p.formattedAddress })
      }
    } catch (error: any) {
      notes.push(`Google Maps search failed: ${error?.response?.data?.error?.message || error?.message || 'unknown error'}`)
      break
    }
  }
  return out
}

async function fromGoogleSearch(queries: string[], notes: string[]): Promise<DiscoveredCompany[]> {
  const key = process.env.GOOGLE_SEARCH_API_KEY
  const cx = process.env.GOOGLE_SEARCH_CX
  if (!key || !cx) {
    notes.push('Google Search not configured: set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX (Programmable Search Engine).')
    return []
  }
  const out: DiscoveredCompany[] = []
  for (const q of queries) {
    try {
      const { data } = await axios.get('https://www.googleapis.com/customsearch/v1', { ...HTTP, params: { key, cx, q, num: 10 } })
      for (const item of data.items || []) {
        const site = String(item.displayLink || '').replace(/^www\./, '')
        const name = (item.pagemap?.metatags?.[0]?.['og:site_name'] as string) || String(item.title || site).split(/[|–-]/)[0].trim()
        out.push({ name, website: item.link, source: 'google_search', sourceRef: item.link })
      }
    } catch (error: any) {
      notes.push(`Google Search failed: ${error?.response?.data?.error?.message || error?.message || 'unknown error'}`)
      break
    }
  }
  return out
}

/** Unique companies (by website domain) from Google Maps and Google Search. */
export async function discoverCompanies(city?: string): Promise<DiscoveryReport> {
  const notes: string[] = []
  const queries = discoveryQueries(city)
  const [maps, search] = await Promise.all([fromGoogleMaps(queries, notes), fromGoogleSearch(queries, notes)])
  const seen = new Set<string>()
  const companies: DiscoveredCompany[] = []
  for (const c of [...maps, ...search]) {
    const site = normalizeWebsite(c.website)
    if (!site || !c.name || seen.has(site.domain)) continue
    seen.add(site.domain)
    companies.push({ ...c, website: site.website })
  }
  return { companies, notes }
}
