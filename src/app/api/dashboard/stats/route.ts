import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { get24HourActivityStats, getApplicationHistory } from '@/lib/application-cooldown'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        accounts: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

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

    const gmailConnected = user.accounts.some(a => a.provider === 'google' && a.access_token)
    const gmailEmail = user.accounts.find(a => a.provider === 'google')?.id ? session.user.email : null

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
        gmailEmail: gmailConnected ? session.user.email : null,
        skills: user.skills ? JSON.parse(user.skills) : [],
        preferredRoles: user.preferredRoles ? JSON.parse(user.preferredRoles) : [],
      },
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get dashboard stats' },
      { status: 500 }
    )
  }
}
