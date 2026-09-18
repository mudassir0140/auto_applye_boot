export const JOB_SOURCES = {
  LINKEDIN: 'linkedin',
  GOOGLE: 'google',
  INDEED: 'indeed',
  GLASSDOOR: 'glassdoor',
  STACKOVERFLOW: 'stackoverflow',
} as const

export const APPLICATION_STATUSES = {
  APPLIED: 'applied',
  INTERVIEW: 'interview',
  ASSESSMENT: 'assessment',
  REJECTED: 'rejected',
  OFFER: 'offer',
  NEGOTIATING: 'negotiating',
  ACCEPTED: 'accepted',
} as const

export const EMAIL_TYPES = {
  CONFIRMATION: 'confirmation',
  INTERVIEW: 'interview',
  ASSESSMENT: 'assessment',
  REJECTION: 'rejection',
  OFFER: 'offer',
  OTHER: 'other',
} as const

export const JOB_TYPES = {
  FULL_TIME: 'full-time',
  PART_TIME: 'part-time',
  CONTRACT: 'contract',
  FREELANCE: 'freelance',
  INTERNSHIP: 'internship',
  APPRENTICESHIP: 'apprenticeship',
} as const

export const SENIORITY_LEVELS = {
  ENTRY: 'entry-level',
  MID: 'mid-level',
  SENIOR: 'senior',
  LEAD: 'lead',
  PRINCIPAL: 'principal',
} as const

export const DEFAULT_JOB_KEYWORDS = [
  'React',
  'Next.js',
  'TypeScript',
  'JavaScript',
  'Node.js',
]

export const DEFAULT_LOCATIONS = [
  'Remote',
  'San Francisco, CA',
  'New York, NY',
  'Austin, TX',
]
