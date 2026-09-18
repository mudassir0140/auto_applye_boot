import axios from 'axios'

interface JobSearchParams {
  keywords: string[]
  location?: string
  experience?: string
}

interface Job {
  title: string
  company: string
  location?: string
  description?: string
  url: string
  source: string
  salary?: string
  jobType?: string
  seniority?: string
}

export async function searchJobsFromRSS(
  keywords: string[],
  location?: string
): Promise<Job[]> {
  const jobs: Job[] = []

  // LinkedIn Jobs RSS feed (if available)
  try {
    const linkedinJobs = await searchLinkedInJobs(keywords, location)
    jobs.push(...linkedinJobs)
  } catch (error) {
    console.error('Error fetching LinkedIn jobs:', error)
  }

  // Google Jobs via public data
  try {
    const googleJobs = await searchGoogleJobs(keywords, location)
    jobs.push(...googleJobs)
  } catch (error) {
    console.error('Error fetching Google jobs:', error)
  }

  return jobs
}

async function searchLinkedInJobs(
  keywords: string[],
  location?: string
): Promise<Job[]> {
  const jobs: Job[] = []

  // LinkedIn requires API access, for now we'll create job search URLs
  // In production, use official LinkedIn jobs API or scraping library
  for (const keyword of keywords) {
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}${
      location ? `&location=${encodeURIComponent(location)}` : ''
    }`

    // Store the URL for manual browsing
    jobs.push({
      title: `LinkedIn Job Search: ${keyword}`,
      company: 'LinkedIn',
      url: searchUrl,
      source: 'linkedin',
      description: `Search for ${keyword} positions on LinkedIn${location ? ` in ${location}` : ''}`,
    })
  }

  return jobs
}

async function searchGoogleJobs(
  keywords: string[],
  location?: string
): Promise<Job[]> {
  const jobs: Job[] = []

  for (const keyword of keywords) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}+jobs${
      location ? `+${encodeURIComponent(location)}` : ''
    }`

    jobs.push({
      title: `Google Jobs Search: ${keyword}`,
      company: 'Google Jobs',
      url: searchUrl,
      source: 'google',
      description: `Search for ${keyword} positions on Google Jobs${location ? ` in ${location}` : ''}`,
    })
  }

  return jobs
}

export function calculateJobMatchScore(
  jobDescription: string,
  userSkills: string[]
): number {
  if (!jobDescription || userSkills.length === 0) return 50

  const lowerDesc = jobDescription.toLowerCase()
  let matchedSkills = 0

  for (const skill of userSkills) {
    if (lowerDesc.includes(skill.toLowerCase())) {
      matchedSkills++
    }
  }

  return Math.min(100, Math.round((matchedSkills / userSkills.length) * 100))
}

export async function canAutoApply(jobUrl: string): Promise<{
  canApply: boolean
  reason?: string
}> {
  // Check if the job platform supports automation
  const supportedPlatforms = ['greenhouse.io', 'lever.co', 'workable.com']

  try {
    const response = await axios.head(jobUrl, { timeout: 5000 })
    const contentType = response.headers['content-type']

    for (const platform of supportedPlatforms) {
      if (jobUrl.includes(platform) || contentType?.includes(platform)) {
        return { canApply: true }
      }
    }

    // For most platforms, we'll need human approval
    return {
      canApply: false,
      reason: 'Platform requires manual review. Show approval prompt.',
    }
  } catch (error) {
    return {
      canApply: false,
      reason: 'Could not verify job URL. Please apply manually.',
    }
  }
}
