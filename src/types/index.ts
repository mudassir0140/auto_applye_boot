export interface User {
  id: string
  email: string
  name?: string
  image?: string
  cvUrl?: string
  portfolioUrl?: string
  createdAt: Date
  updatedAt: Date
}

export interface Job {
  id: string
  userId: string
  title: string
  company: string
  location?: string
  description?: string
  url: string
  source: string
  salary?: string
  jobType?: string
  seniority?: string
  skills?: string[]
  matchScore?: number
  applied: boolean
  foundAt: Date
  appliedAt?: Date
  savedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface JobApplication {
  id: string
  jobId: string
  userId: string
  status: 'applied' | 'interview' | 'assessment' | 'rejected' | 'offer'
  appliedAt: Date
  applicationUrl?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface JobEmail {
  id: string
  userId: string
  jobId: string
  applicationId?: string
  gmailMessageId: string
  from: string
  subject: string
  body?: string
  emailType: 'confirmation' | 'interview' | 'assessment' | 'rejection' | 'offer' | 'other'
  status?: string
  isRead: boolean
  receivedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface Notification {
  id: string
  userId: string
  type: 'interview' | 'assessment' | 'rejection' | 'offer' | 'email'
  title: string
  message: string
  read: boolean
  createdAt: Date
  updatedAt: Date
}

export interface DashboardStats {
  totalJobs: number
  appliedJobs: number
  interviews: number
  assessments: number
  rejections: number
  offers: number
  savedJobs: number
  unreadNotifications: number
  gmailConnected: boolean
}

export interface JobSearchParams {
  keywords: string[]
  location?: string
  jobType?: string
  seniority?: string
}
