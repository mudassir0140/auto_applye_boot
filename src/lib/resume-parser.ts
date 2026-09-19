// Resume/portfolio parsing utilities
// Extracts skills, experience, education, projects, and preferred roles from resume/portfolio text

export interface ResumeProfile {
  skills: string[]
  experience: Array<{
    title: string
    company: string
    duration: string
    description?: string
  }>
  education: Array<{
    degree: string
    institution: string
    field?: string
    year?: string
  }>
  projects: Array<{
    name: string
    description: string
    technologies?: string[]
  }>
  preferredRoles: string[]
}

// Common job roles to detect in resume/portfolio
const COMMON_ROLES = [
  'frontend developer',
  'backend developer',
  'full stack developer',
  'react developer',
  'node.js developer',
  'javascript developer',
  'typescript developer',
  'python developer',
  'java developer',
  'mobile developer',
  'flutter developer',
  'dart developer',
  'ios developer',
  'android developer',
  'devops engineer',
  'data engineer',
  'machine learning engineer',
  'software engineer',
  'engineer',
  'developer',
  'architect',
  'lead',
  'senior',
  'junior',
  'intern',
  'contractor',
  'freelancer',
]

// Common technical skills
const COMMON_SKILLS = [
  'react', 'vue', 'angular', 'svelte',
  'next.js', 'nuxt', 'nest', 'express', 'fastapi', 'django',
  'javascript', 'typescript', 'python', 'java', 'c#', 'go', 'rust', 'kotlin',
  'html', 'css', 'sass', 'tailwind', 'bootstrap',
  'sql', 'mongodb', 'postgresql', 'mysql', 'firebase',
  'git', 'docker', 'kubernetes', 'aws', 'gcp', 'azure',
  'rest', 'graphql', 'grpc',
  'jest', 'pytest', 'mocha',
  'flutter', 'dart', 'swift', 'kotlin',
  'node', 'npm', 'yarn', 'webpack', 'vite',
  'redis', 'elasticsearch', 'rabbitmq',
  'linux', 'windows', 'macos',
  'agile', 'scrum', 'kanban',
  'ai', 'machine learning', 'deep learning', 'tensorflow', 'pytorch',
  'web3', 'blockchain', 'solidity', 'ethereum',
]

export async function parseResumeText(text: string): Promise<ResumeProfile> {
  const lowerText = text.toLowerCase()

  return {
    skills: extractSkills(lowerText),
    experience: extractExperience(text),
    education: extractEducation(text),
    projects: extractProjects(text),
    preferredRoles: extractPreferredRoles(lowerText),
  }
}

function extractSkills(text: string): string[] {
  const foundSkills = new Set<string>()

  // Check for each common skill in the text
  for (const skill of COMMON_SKILLS) {
    // Use word boundaries to match whole words
    const regex = new RegExp(`\\b${skill}\\b`, 'gi')
    if (regex.test(text)) {
      foundSkills.add(skill.toLowerCase())
    }
  }

  return Array.from(foundSkills).sort()
}

function extractExperience(text: string): ResumeProfile['experience'] {
  const experience: ResumeProfile['experience'] = []

  // Look for common work experience patterns
  // This is a simplified extraction - real implementation would be more sophisticated
  const lines = text.split('\n')
  let currentRole: Partial<ResumeProfile['experience'][0]> | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines
    if (!trimmed) {
      if (currentRole && currentRole.title) {
        experience.push(currentRole as ResumeProfile['experience'][0])
        currentRole = null
      }
      continue
    }

    // Look for job titles (contains keywords like developer, engineer, lead, etc.)
    const isTitleLine = /developer|engineer|lead|manager|designer|architect|analyst/i.test(trimmed)

    if (isTitleLine && trimmed.length < 100) {
      if (currentRole && currentRole.title) {
        experience.push(currentRole as ResumeProfile['experience'][0])
      }
      currentRole = {
        title: trimmed,
        company: '',
        duration: '',
      }
    }
  }

  if (currentRole && currentRole.title) {
    experience.push(currentRole as ResumeProfile['experience'][0])
  }

  return experience.slice(0, 10) // Return top 10 experiences
}

function extractEducation(text: string): ResumeProfile['education'] {
  const education: ResumeProfile['education'] = []

  // Look for degree keywords
  const degreePattern = /(bachelor|master|phd|diploma|associate|certification|b\.s\.|b\.a\.|m\.s\.|m\.a\.|m\.b\.a\.|bsc|msc|ba|bs|ma|ms)/gi
  const matches = text.matchAll(degreePattern)

  for (const match of matches) {
    if (match.index !== undefined) {
      // Get context around the match
      const start = Math.max(0, match.index - 100)
      const end = Math.min(text.length, match.index + 200)
      const context = text.substring(start, end)

      education.push({
        degree: match[0],
        institution: extractInstitution(context),
        field: extractField(context),
      })
    }
  }

  return education.slice(0, 5) // Return top 5 educations
}

function extractProjects(text: string): ResumeProfile['projects'] {
  const projects: ResumeProfile['projects'] = []

  // Look for "Project:", "Built:", "Created:", etc.
  const projectKeywords = ['project', 'built', 'created', 'developed', 'launched']
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase()

    for (const keyword of projectKeywords) {
      if (line.includes(keyword)) {
        const projectName = lines[i].substring(lines[i].indexOf(':') + 1).trim()
        if (projectName.length > 0 && projectName.length < 100) {
          // Try to find project description in next lines
          const description = lines.slice(i + 1, i + 3).join(' ').substring(0, 200)

          projects.push({
            name: projectName,
            description,
          })
          break
        }
      }
    }
  }

  return projects.slice(0, 5) // Return top 5 projects
}

function extractPreferredRoles(text: string): string[] {
  const foundRoles = new Set<string>()

  for (const role of COMMON_ROLES) {
    if (text.includes(role)) {
      foundRoles.add(role)
    }
  }

  return Array.from(foundRoles).sort()
}

function extractInstitution(context: string): string {
  // Look for common institution patterns
  const universityPattern = /(university|institute|college|school|academy)/gi
  const match = context.match(universityPattern)

  if (match) {
    // Try to get the full institution name
    const lines = context.split(/[,\n]/)
    for (const line of lines) {
      if (universityPattern.test(line)) {
        return line.trim().substring(0, 100)
      }
    }
  }

  return ''
}

function extractField(context: string): string {
  // Look for common field of study
  const fieldPattern = /(computer science|engineering|business|mathematics|physics|chemistry|biology|economics|psychology|arts|humanities)/gi
  const match = context.match(fieldPattern)

  return match ? match[0] : ''
}

// Parse resume from URL (fetch and extract text)
export async function parseResumeFromUrl(url: string): Promise<ResumeProfile> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const text = await response.text()

    // Try to extract text from HTML if it's a web page
    let extractedText = text
    if (text.includes('<html') || text.includes('<body')) {
      // Simple HTML text extraction
      extractedText = text
        .replace(/<script[^>]*>.*?<\/script>/gs, '')
        .replace(/<style[^>]*>.*?<\/style>/gs, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
    }

    return parseResumeText(extractedText)
  } catch (error) {
    console.error('Error parsing resume from URL:', error)
    return {
      skills: [],
      experience: [],
      education: [],
      projects: [],
      preferredRoles: [],
    }
  }
}

// Calculate profile completeness score
export function getProfileCompletenessScore(profile: ResumeProfile): number {
  let score = 0
  const maxScore = 100

  // Skills (0-30 points)
  if (profile.skills.length > 0) score += Math.min(30, profile.skills.length * 3)

  // Experience (0-30 points)
  if (profile.experience.length > 0) score += Math.min(30, profile.experience.length * 6)

  // Education (0-20 points)
  if (profile.education.length > 0) score += Math.min(20, profile.education.length * 7)

  // Projects (0-20 points)
  if (profile.projects.length > 0) score += Math.min(20, profile.projects.length * 4)

  // Preferred roles (0-10 points)
  if (profile.preferredRoles.length > 0) score += Math.min(10, profile.preferredRoles.length * 2)

  return Math.min(score, maxScore)
}
