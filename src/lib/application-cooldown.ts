// 7-day application cooldown and duplicate prevention logic
// Ensures users don't apply to the same job/company within 7 days

import { prisma } from './prisma'

export interface DuplicateCheckResult {
  isDuplicate: boolean
  lastApplyDate?: Date
  daysRemaining?: number
  cooldownExpiresAt?: Date
}

const COOLDOWN_DAYS = 7

/**
 * 7-day duplicate protection, scoped to one user. A new application is blocked if,
 * within the last 7 days, the same user already applied to the same posting URL,
 * the same company + job title, or emailed the same recipient address.
 * Only successful attempts count, so a failed send can be retried.
 * Fails CLOSED: if the history can't be read we refuse rather than risk a duplicate email.
 */
export async function checkApplicationCooldown(
  userId: string,
  jobUrl: string,
  company: string,
  jobTitle: string,
  recipientEmail?: string | null
): Promise<DuplicateCheckResult> {
  const since = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000)

  const matchers: Array<Record<string, unknown>> = [
    { jobUrl },
    { company: { equals: company, mode: 'insensitive' }, jobTitle: { equals: jobTitle, mode: 'insensitive' } },
  ]
  if (recipientEmail) matchers.push({ recipientEmail: { equals: recipientEmail, mode: 'insensitive' } })

  const match = await prisma.applicationHistory.findFirst({
    where: { userId, status: 'success', appliedAt: { gte: since }, OR: matchers },
    orderBy: { appliedAt: 'desc' },
  })

  if (!match) return { isDuplicate: false }
  return {
    isDuplicate: true,
    lastApplyDate: match.appliedAt,
    daysRemaining: calculateDaysRemaining(match.appliedAt, COOLDOWN_DAYS),
    cooldownExpiresAt: calculateCooldownExpiry(match.appliedAt, COOLDOWN_DAYS),
  }
}

/**
 * Record an application in the history/cooldown system
 */
export async function recordApplicationAttempt(
  userId: string,
  jobId: string | null,
  jobUrl: string,
  company: string,
  jobTitle: string,
  recipientEmail: string | null,
  method: 'auto' | 'manual' = 'auto',
  status: string = 'success',
  notes?: string
): Promise<string> {
  try {
    const record = await prisma.applicationHistory.create({
      data: {
        userId,
        jobId,
        jobUrl,
        company,
        jobTitle,
        recipientEmail,
        method,
        status,
        notes,
      },
    })

    return record.id
  } catch (error) {
    console.error('Error recording application attempt:', error)
    throw error
  }
}

/**
 * Get application history for a user (last N applications)
 */
export async function getApplicationHistory(
  userId: string,
  limit: number = 100,
  days?: number
): Promise<Array<{
  id: string
  company: string
  jobTitle: string
  appliedAt: Date
  status: string | null
  method: string
}>> {
  try {
    const where: any = { userId }

    if (days) {
      const sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - days)
      where.appliedAt = { gte: sinceDate }
    }

    const history = await prisma.applicationHistory.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        company: true,
        jobTitle: true,
        appliedAt: true,
        status: true,
        method: true,
      },
    })

    return history
  } catch (error) {
    console.error('Error fetching application history:', error)
    return []
  }
}

/**
 * Get 24-hour activity statistics
 */
export async function get24HourActivityStats(userId: string): Promise<{
  applicationsSubmitted: number
  uniqueCompanies: number
  jobsFound: number
  emailsReceived: number
  interviewInvites: number
  assessments: number
  rejections: number
}> {
  try {
    const last24Hours = new Date()
    last24Hours.setHours(last24Hours.getHours() - 24)

    const [
      applicationsSubmitted,
      jobsFound,
      emailsReceived,
      interviewInvites,
      assessments,
      rejections,
    ] = await Promise.all([
      prisma.applicationHistory.count({
        where: {
          userId,
          appliedAt: { gte: last24Hours },
        },
      }),
      prisma.job.count({
        where: {
          userId,
          foundAt: { gte: last24Hours },
        },
      }),
      prisma.jobEmail.count({
        where: {
          userId,
          receivedAt: { gte: last24Hours },
        },
      }),
      prisma.jobEmail.count({
        where: {
          userId,
          emailType: 'interview',
          receivedAt: { gte: last24Hours },
        },
      }),
      prisma.jobEmail.count({
        where: {
          userId,
          emailType: 'assessment',
          receivedAt: { gte: last24Hours },
        },
      }),
      prisma.jobEmail.count({
        where: {
          userId,
          emailType: 'rejection',
          receivedAt: { gte: last24Hours },
        },
      }),
    ])

    // Get unique companies from applications in last 24 hours
    const applications = await prisma.applicationHistory.findMany({
      where: {
        userId,
        appliedAt: { gte: last24Hours },
      },
      select: { company: true },
      distinct: ['company'],
    })

    return {
      applicationsSubmitted,
      uniqueCompanies: applications.length,
      jobsFound,
      emailsReceived,
      interviewInvites,
      assessments,
      rejections,
    }
  } catch (error) {
    console.error('Error fetching 24-hour stats:', error)
    return {
      applicationsSubmitted: 0,
      uniqueCompanies: 0,
      jobsFound: 0,
      emailsReceived: 0,
      interviewInvites: 0,
      assessments: 0,
      rejections: 0,
    }
  }
}

function calculateDaysRemaining(lastApplyDate: Date, cooldownDays: number): number {
  const now = new Date()
  const expiryDate = new Date(lastApplyDate)
  expiryDate.setDate(expiryDate.getDate() + cooldownDays)

  const diffMs = expiryDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  return Math.max(0, diffDays)
}

function calculateCooldownExpiry(lastApplyDate: Date, cooldownDays: number): Date {
  const expiryDate = new Date(lastApplyDate)
  expiryDate.setDate(expiryDate.getDate() + cooldownDays)
  return expiryDate
}
