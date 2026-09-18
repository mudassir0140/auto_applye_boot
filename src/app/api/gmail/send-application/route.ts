import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendApplicationEmail, generateApplicationEmail, getAccountEmail } from '@/lib/gmail'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { jobId, recruiterEmail, recruiterName } = await req.json()

    if (!jobId || !recruiterEmail) {
      return NextResponse.json(
        { error: 'Job ID and recruiter email are required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, name: true, cvUrl: true, portfolioUrl: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if Gmail is connected
    const gmailAccount = await prisma.account.findFirst({
      where: {
        userId: user.id,
        provider: 'google',
      },
    })

    if (!gmailAccount?.access_token) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect Gmail in settings.' },
        { status: 400 }
      )
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { title: true, company: true, userId: true }
    })

    if (!job || job.userId !== user.id) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Check if application already sent
    const existingApplication = await prisma.jobApplication.findUnique({
      where: { jobId },
    })

    if (!existingApplication) {
      return NextResponse.json(
        { error: 'No application found for this job' },
        { status: 404 }
      )
    }

    // Generate personalized email
    const emailContent = generateApplicationEmail(
      job.title,
      job.company,
      recruiterName || null,
      user.email,
      user.name || 'Applicant',
      user.cvUrl || null,
      user.portfolioUrl || null
    )

    emailContent.to = recruiterEmail

    // Send email via Gmail
    const result = await sendApplicationEmail(user.id, emailContent)

    // Update application with email sent timestamp and status
    await prisma.jobApplication.update({
      where: { jobId },
      data: {
        notes: `Email sent to ${recruiterEmail} at ${new Date().toISOString()}`,
        updatedAt: new Date(),
      },
    })

    // Create notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'email',
        title: 'Application Email Sent',
        message: `Sent application email for ${job.title} at ${job.company} to ${recruiterEmail}`,
      },
    })

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: `Application email sent to ${recruiterEmail}`,
    })
  } catch (error) {
    console.error('Send application email error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send application email',
        details: error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
