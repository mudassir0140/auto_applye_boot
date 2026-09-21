import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserWithGoogle, unauthorized, parseJsonList } from '@/lib/session'
import { isGmailConnected } from '@/lib/gmail'
import { databaseErrorResponse } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

export async function GET() {
  try {
    // Stage 1: user + Google account in parallel.
    const current = await getCurrentUserWithGoogle()
    if (!current) return unauthorized()
    const { user, googleAccount } = current
    const userId = user.id

    const now = Date.now()
    const last24h = new Date(now - DAY_MS)
    const last7d = new Date(now - 7 * DAY_MS)

    // Stage 2: everything else in parallel (11 queries; was 19 in 3 sequential stages).
    const [
      totalJobs,
      appliedJobs,
      savedJobs,
      jobsFound24h,
      unreadNotifications,
      statusGroups,
      emailGroups24h,
      recentApplications,
      recentEmails,
      history7d,
    ] = await Promise.all([
      prisma.job.count({ where: { userId } }),
      prisma.job.count({ where: { userId, applied: true } }),
      prisma.job.count({ where: { userId, savedAt: { not: null } } }),
      prisma.job.count({ where: { userId, foundAt: { gte: last24h } } }),
      prisma.notification.count({ where: { userId, read: false } }),
      prisma.jobApplication.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
      prisma.jobEmail.groupBy({ by: ['emailType'], where: { userId, receivedAt: { gte: last24h } }, _count: { _all: true } }),
      prisma.jobApplication.findMany({
        where: { userId },
        orderBy: { appliedAt: 'desc' },
        take: 5,
        include: { job: { select: { id: true, title: true, company: true, url: true, location: true } } },
      }),
      prisma.jobEmail.findMany({
        where: { userId },
        orderBy: { receivedAt: 'desc' },
        take: 5,
        select: { id: true, from: true, subject: true, emailType: true, receivedAt: true, isRead: true },
      }),
      // One query serves both the 7-day history list and the 24h activity numbers.
      prisma.applicationHistory.findMany({
        where: { userId, appliedAt: { gte: last7d } },
        orderBy: { appliedAt: 'desc' },
        take: 200,
        select: { id: true, company: true, jobTitle: true, appliedAt: true, status: true, method: true },
      }),
    ])

    const applicationsByStatus = (s: string) => statusGroups.find((g) => g.status === s)?._count._all ?? 0
    const emailsByType = (t: string) => emailGroups24h.find((g) => g.emailType === t)?._count._all ?? 0
    const history24h = history7d.filter((h) => h.appliedAt.getTime() >= last24h.getTime())
    const gmailConnected = isGmailConnected(googleAccount)

    return NextResponse.json({
      stats: {
        totalJobs,
        appliedJobs,
        interviews: applicationsByStatus('interview'),
        assessments: applicationsByStatus('assessment'),
        rejections: applicationsByStatus('rejected'),
        offers: applicationsByStatus('offer'),
        savedJobs,
        unreadNotifications,
        gmailConnected,
        last24Hours: {
          applicationsSubmitted: history24h.length,
          jobsFound: jobsFound24h,
          emailsReceived: emailGroups24h.reduce((n, g) => n + g._count._all, 0),
          interviewInvites: emailsByType('interview'),
          assessments: emailsByType('assessment'),
          rejections: emailsByType('rejection'),
          uniqueCompanies: new Set(history24h.map((h) => h.company)).size,
        },
      },
      recentApplications,
      recentEmails,
      applicationHistory: history7d.slice(0, 10),
      user: {
        email: user.email,
        name: user.name,
        cvUrl: user.cvUrl,
        portfolioUrl: user.portfolioUrl,
        gmailEmail: gmailConnected ? user.email : null,
        image: user.image,
        preferencesConfirmed: !!user.preferencesConfirmedAt,
        needsGmailReconnect: !!googleAccount && !gmailConnected,
        skills: parseJsonList(user.skills),
        preferredRoles: parseJsonList(user.preferredRoles),
      },
    })
  } catch (error) {
    return databaseErrorResponse(error, 'dashboard/stats')
  }
}
