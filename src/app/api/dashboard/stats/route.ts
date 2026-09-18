import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

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
    ])

    const gmailConnected = user.accounts.some(a => a.provider === 'google' && a.access_token)

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
      },
      recentApplications,
      recentEmails,
      user: {
        email: user.email,
        name: user.name,
        cvUrl: user.cvUrl,
        portfolioUrl: user.portfolioUrl,
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
