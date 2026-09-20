import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, unauthorized, parseJsonList } from '@/lib/session'
import { getGoogleAccount, isGmailConnected } from '@/lib/gmail'
import { databaseErrorResponse } from '@/lib/db-error'
import { get24HourActivityStats, getApplicationHistory } from '@/lib/application-cooldown'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const googleAccount = await getGoogleAccount(user.id)

    // Get all stats
    const [
      totalJobs,
      appliedJobs,
      interviews,
      assessments,
      rejections,
      offers,
      savedJobs,
      unreadNotifications,
      recentApplications,
      recentEmails,
      last24Hours,
      applicationHistory,
    ] = await Promise.all([
      prisma.job.count({ where: { userId: user.id } }),
      prisma.job.count({ where: { userId: user.id, applied: true } }),
      prisma.jobApplication.count({
        where: { userId: user.id, status: 'interview' },
      }),
      prisma.jobApplication.count({
        where: { userId: user.id, status: 'assessment' },
      }),
      prisma.jobApplication.count({
        where: { userId: user.id, status: 'rejected' },
      }),
      prisma.jobApplication.count({
        where: { userId: user.id, status: 'offer' },
      }),
      prisma.job.count({ where: { userId: user.id, savedAt: { not: null } } }),
      prisma.notification.count({
        where: { userId: user.id, read: false },
      }),
      prisma.jobApplication.findMany({
        where: { userId: user.id },
        orderBy: { appliedAt: 'desc' },
        take: 5,
        include: { job: true },
      }),
      prisma.jobEmail.findMany({
        where: { userId: user.id },
        orderBy: { receivedAt: 'desc' },
        take: 5,
      }),
      get24HourActivityStats(user.id),
      getApplicationHistory(user.id, 10, 7), // Last 7 days
    ])

    const gmailConnected = isGmailConnected(googleAccount)

    return NextResponse.json({
      stats: {
        totalJobs,
        appliedJobs,
        interviews,
        assessments,
        rejections,
        offers,
        savedJobs,
        unreadNotifications,
        gmailConnected,
        // 24-hour stats
        last24Hours: {
          applicationsSubmitted: last24Hours.applicationsSubmitted,
          jobsFound: last24Hours.jobsFound,
          emailsReceived: last24Hours.emailsReceived,
          interviewInvites: last24Hours.interviewInvites,
          assessments: last24Hours.assessments,
          rejections: last24Hours.rejections,
          uniqueCompanies: last24Hours.uniqueCompanies,
        },
      },
      recentApplications,
      recentEmails,
      applicationHistory,
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
