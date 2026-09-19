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
 * Check if a user has already applied to the same job/company within the cooldown period
 * Uses multiple identifiers for matching: URL, company name, and recipient email
 */
export async function checkApplicationCooldown(
  userId: string,
  jobUrl: string,
  company: string,
  recipientEmail?: string
): Promise<DuplicateCheckResult> {
  const cooldownDate = new Date()
  cooldownDate.setDate(cooldownDate.getDate() - COOLDOWN_DAYS)

  try {
    // Check application history for recent applications to the same URL
    const urlMatch = await prisma.applicationHistory.findFirst({
      where: {
        userId,
        jobUrl,
        appliedAt: {
          gte: cooldownDate,
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    })

    if (urlMatch) {
      return {
        isDuplicate: true,
        lastApplyDate: urlMatch.appliedAt,
        daysRemaining: calculateDaysRemaining(urlMatch.appliedAt, COOLDOWN_DAYS),
        cooldownExpiresAt: calculateCooldownExpiry(urlMatch.appliedAt, COOLDOWN_DAYS),
      }
    }

    // Check for applications to the same company within cooldown
    const companyMatch = await prisma.applicationHistory.findFirst({
      where: {
        userId,
        company,
        appliedAt: {
          gte: cooldownDate,
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    })

    if (companyMatch) {
      // Only consider it a duplicate if email also matches (if provided)
      if (recipientEmail && companyMatch.recipientEmail === recipientEmail) {
        return {
          isDuplicate: true,
          lastApplyDate: companyMatch.appliedAt,
          daysRemaining: calculateDaysRemaining(companyMatch.appliedAt, COOLDOWN_DAYS),
          cooldownExpiresAt: calculateCooldownExpiry(companyMatch.appliedAt, COOLDOWN_DAYS),
        }
      }
    }

    // Check if exact same recipient email was used
    if (recipientEmail) {
      const emailMatch = await prisma.applicationHistory.findFirst({
        where: {
          userId,
          recipientEmail,
          appliedAt: {
            gte: cooldownDate,
          },
        },
        orderBy: {
          appliedAt: 'desc',
        },
      })

      if (emailMatch) {
        return {
          isDuplicate: true,
          lastApplyDate: emailMatch.appliedAt,
          daysRemaining: calculateDaysRemaining(emailMatch.appliedAt, COOLDOWN_DAYS),
          cooldownExpiresAt: calculateCooldownExpiry(emailMatch.appliedAt, COOLDOWN_DAYS),
        }
      }
    }

    return { isDuplicate: false }
  } catch (error) {
    console.error('Error checking application cooldown:', error)
    // On error, allow application to proceed
    return { isDuplicate: false }
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
  recipientEmail: string,
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
