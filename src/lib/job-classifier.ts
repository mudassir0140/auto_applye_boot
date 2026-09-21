// Decides WHAT a job posting requires (React/Next.js/JavaScript, Flutter, React Native,
// Node, Python, ...) and which of those tracks the user is actually targeting, so a
// Flutter developer never gets React-only roles and vice versa.

export type TrackId =
  | 'react_js'
  | 'flutter_mobile'
  | 'react_native'
  | 'vue_angular'
  | 'node_backend'
  | 'python'
  | 'java'
  | 'dotnet'
  | 'php'
  | 'ruby'
  | 'golang'
  | 'ios'
  | 'android'
  | 'devops'
  | 'data_ml'
  | 'qa'
  | 'design'
  | 'other'

interface Track {
  id: TrackId
  label: string
  /** Terms that identify the track on their own. */
  strong: string[]
  /** Generic terms that only count when the posting body also mentions a strong term. */
  weak?: string[]
  /** Count only when they appear in the job TITLE (a Node/TS backend tagged "typescript" is not a React job). */
  titleOnly?: string[]
}

export const TRACKS: Track[] = [
  { id: 'react_native', label: 'React Native', strong: ['react native', 'react-native', 'expo'] },
  {
    id: 'react_js',
    label: 'React / Next.js / JavaScript',
    strong: ['react', 'reactjs', 'react.js', 'next.js', 'nextjs', 'next js', 'redux', 'gatsby'],
    titleOnly: ['javascript', 'typescript'],
    weak: ['frontend', 'front-end', 'front end', 'web developer', 'ui developer', 'full stack', 'fullstack', 'full-stack'],
  },
  { id: 'flutter_mobile', label: 'Flutter / Dart', strong: ['flutter', 'dart'] },
  { id: 'vue_angular', label: 'Vue / Angular', strong: ['vue', 'vue.js', 'vuejs', 'nuxt', 'angular', 'angularjs', 'svelte', 'sveltekit'] },
  { id: 'node_backend', label: 'Node.js backend', strong: ['node', 'node.js', 'nodejs', 'express', 'nestjs', 'nest.js'] },
  { id: 'python', label: 'Python', strong: ['python', 'django', 'flask', 'fastapi'] },
  { id: 'java', label: 'Java', strong: ['java', 'spring', 'spring boot'] },
  { id: 'dotnet', label: '.NET / C#', strong: ['.net', 'dotnet', 'c#', 'asp.net'] },
  { id: 'php', label: 'PHP', strong: ['php', 'laravel', 'symfony', 'wordpress'] },
  { id: 'ruby', label: 'Ruby', strong: ['ruby', 'rails', 'ruby on rails'] },
  { id: 'golang', label: 'Go', strong: ['golang'] },
  { id: 'ios', label: 'iOS', strong: ['ios', 'swift', 'swiftui', 'objective-c'] },
  { id: 'android', label: 'Android', strong: ['android', 'kotlin'] },
  { id: 'devops', label: 'DevOps', strong: ['devops', 'sre', 'kubernetes', 'terraform', 'site reliability'] },
  { id: 'data_ml', label: 'Data / ML', strong: ['data scientist', 'data engineer', 'machine learning', 'ml engineer', 'ai engineer', 'data analyst'] },
  { id: 'qa', label: 'QA', strong: ['qa', 'sdet', 'test automation', 'quality assurance'] },
  { id: 'design', label: 'Design', strong: ['designer', 'ux', 'ui/ux', 'figma'] },
]

export const TRACK_LABEL: Record<string, string> = Object.fromEntries([...TRACKS.map((t) => [t.id, t.label]), ['other', 'Other']])

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Whole-term match: "java" must not match "javascript", "go" not "google". */
function hasTerm(text: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${esc(term)}(?![a-z0-9])`, 'i').test(text)
}

// Technologies worth showing on a job card (subset of terms, display name -> match term).
const TECH_DISPLAY: Array<[string, string]> = [
  ['React', 'react'], ['Next.js', 'next.js'], ['Next.js', 'nextjs'], ['TypeScript', 'typescript'], ['JavaScript', 'javascript'],
  ['Redux', 'redux'], ['Tailwind', 'tailwind'], ['Flutter', 'flutter'], ['Dart', 'dart'], ['React Native', 'react native'],
  ['Vue', 'vue'], ['Angular', 'angular'], ['Node.js', 'node.js'], ['Node.js', 'nodejs'], ['Express', 'express'], ['NestJS', 'nestjs'],
  ['GraphQL', 'graphql'], ['MongoDB', 'mongodb'], ['PostgreSQL', 'postgresql'], ['Python', 'python'], ['Django', 'django'],
  ['Java', 'java'], ['Spring', 'spring'], ['.NET', '.net'], ['C#', 'c#'], ['PHP', 'php'], ['Laravel', 'laravel'], ['Ruby', 'ruby'],
  ['Go', 'golang'], ['Swift', 'swift'], ['Kotlin', 'kotlin'], ['Firebase', 'firebase'], ['AWS', 'aws'], ['Docker', 'docker'],
  ['Kubernetes', 'kubernetes'], ['Terraform', 'terraform'],
]

export interface JobClassification {
  /** Best-supported role category (a TrackId), or 'other'. */
  primary: TrackId
  /** Every track named in the title / tags (or supported by the body for generic terms). */
  tracks: TrackId[]
  technologies: string[]
}

interface JobText {
  title: string
  description?: string | null
  tags?: string[] | null
}

/** "React Native" is its own track, so hide it from the plain-React check. */
const withoutReactNative = (s: string) => s.replace(/react[\s-]native/gi, ' rn ')

export function classifyJob(job: JobText): JobClassification {
  const title = job.title.toLowerCase()
  const tags = (job.tags || []).join(' ').toLowerCase()
  const body = (job.description || '').toLowerCase().slice(0, 2500)

  const scores = new Map<TrackId, number>()
  const headlineTracks = new Set<TrackId>()

  for (const track of TRACKS) {
    const t = track.id === 'react_js' ? withoutReactNative(title) : title
    const g = track.id === 'react_js' ? withoutReactNative(tags) : tags
    const b = track.id === 'react_js' ? withoutReactNative(body) : body

    const titleHits = [...track.strong, ...(track.titleOnly || [])].filter((term) => hasTerm(t, term)).length
    const tagHits = track.strong.filter((term) => hasTerm(g, term)).length
    const bodyHits = track.strong.filter((term) => hasTerm(b, term)).length

    // Generic words ("frontend", "full stack") only count if the body backs them up.
    const weakInHeadline = (track.weak || []).some((term) => hasTerm(t, term) || hasTerm(g, term))
    const weakBacked = weakInHeadline && bodyHits > 0

    const score = titleHits * 5 + tagHits * 3 + Math.min(bodyHits, 4) + (weakBacked ? 3 : 0)
    if (score > 0) scores.set(track.id, score)
    if (titleHits > 0 || tagHits > 0 || weakBacked) headlineTracks.add(track.id)
  }

  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1])
  const primary = (ranked.find(([id]) => headlineTracks.has(id))?.[0] ?? ranked[0]?.[0] ?? 'other') as TrackId

  const haystack = `${withoutReactNative(title)} ${withoutReactNative(tags)} ${withoutReactNative(body)}`
  const technologies: string[] = []
  for (const [display, term] of TECH_DISPLAY) {
    if (technologies.includes(display)) continue
    const text = display === 'React Native' ? `${title} ${tags} ${body}` : haystack
    if (hasTerm(text, term)) technologies.push(display)
    if (technologies.length >= 8) break
  }

  return {
    primary: headlineTracks.size === 0 && (ranked[0]?.[1] ?? 0) < 3 ? 'other' : primary,
    tracks: Array.from(headlineTracks),
    technologies,
  }
}

export interface UserTracks {
  tracks: Set<TrackId>
  /** Keywords/roles that don't map to any known track (matched as plain terms instead). */
  unmapped: string[]
  /** True when the user named their target roles/keywords (vs. inferred from skills). */
  explicit: boolean
}

function tracksInText(text: string): TrackId[] {
  const t = withoutReactNative(text.toLowerCase())
  const original = text.toLowerCase()
  const found: TrackId[] = []
  for (const track of TRACKS) {
    const source = track.id === 'react_js' ? t : original
    const terms = [...track.strong, ...(track.titleOnly || []), ...(track.weak || [])]
    if (terms.some((term) => hasTerm(source, term))) found.push(track.id)
  }
  return found
}

/**
 * Which tracks does this user target? The keywords / preferred roles they confirmed
 * win. Only when they gave none do we infer from CV skills (top track by evidence).
 */
export function userTracks(skills: string[], keywords: string[], roles: string[] = []): UserTracks {
  const tracks = new Set<TrackId>()
  const unmapped: string[] = []
  const intent = [...keywords, ...roles].map((s) => s.trim()).filter(Boolean)

  for (const phrase of intent) {
    const found = tracksInText(phrase)
    if (found.length === 0) unmapped.push(phrase.toLowerCase())
    found.forEach((id) => tracks.add(id))
  }
  if (intent.length > 0 && tracks.size > 0) return { tracks, unmapped, explicit: true }
  if (intent.length > 0) return { tracks, unmapped, explicit: true }

  // No stated intent: infer from skills.
  const counts = new Map<TrackId, number>()
  for (const skill of skills) for (const id of tracksInText(skill)) counts.set(id, (counts.get(id) ?? 0) + 1)
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  if (top[0]) tracks.add(top[0][0])
  for (const [id, n] of top.slice(1)) if (n >= 2) tracks.add(id)
  return { tracks, unmapped, explicit: false }
}

/** Does the posting's role match a track the user targets? */
export function matchesUserTracks(cls: JobClassification, user: UserTracks): boolean {
  return cls.tracks.some((id) => user.tracks.has(id))
}
