import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchJobRelatedEmails, classifyJobEmail } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
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
        { error: 'Gmail not connected' },
        { status: 400 }
      )
    }

    // Fetch job-related emails from Gmail
    const emails = await fetchJobRelatedEmails(user.id)

    const savedEmails = []
    const notifications = []

    for (const email of emails) {
      // Check if email already exists
      const existingEmail = await prisma.jobEmail.findUnique({
        where: { gmailMessageId: email.gmailMessageId },
      })

      if (existingEmail) {
        continue
      }

      // Classify the email
      const emailType = classifyJobEmail(email.subject, email.body || '')

      // Try to find related job
      const job = await prisma.job.findFirst({
        where: {
          userId: user.id,
          OR: [
            { company: { contains: email.from.split('@')[0] } },
            { title: { contains: email.subject } },
          ],
        },
      })

      // Find related application
      const application = job
        ? await prisma.jobApplication.findFirst({
            where: { jobId: job.id, userId: user.id },
          })
        : null

      // Save email
      const savedEmail = await prisma.jobEmail.create({
        data: {
          userId: user.id,
          jobId: job?.id || 'unknown',
          applicationId: application?.id,
          gmailMessageId: email.gmailMessageId,
          from: email.from,
          subject: email.subject,
          body: email.body,
          emailType,
          status: emailType,
          receivedAt: email.receivedAt,
        },
      })

      savedEmails.push(savedEmail)

      // Update application status if relevant
      if (application) {
        if (emailType === 'interview') {
          await prisma.jobApplication.update({
            where: { id: application.id },
            data: { status: 'interview' },
          })
        } else if (emailType === 'assessment') {
          await prisma.jobApplication.update({
            where: { id: application.id },
            data: { status: 'assessment' },
          })
        } else if (emailType === 'rejection') {
          await prisma.jobApplication.update({
            where: { id: application.id },
            data: { status: 'rejected' },
          })
        } else if (emailType === 'offer') {
          await prisma.jobApplication.update({
            where: { id: application.id },
            data: { status: 'offer' },
          })
        }
      }

      // Create notification for important emails
      if (['interview', 'assessment', 'rejection', 'offer'].includes(emailType)) {
        const notification = await prisma.notification.create({
          data: {
            userId: user.id,
            type: emailType,
            title: `${emailType.charAt(0).toUpperCase() + emailType.slice(1)}: ${email.subject}`,
            message: `From: ${email.from}`,
          },
        })
        notifications.push(notification)
      }
    }

    return NextResponse.json({
      success: true,
      emailsSync: savedEmails.length,
      emails: savedEmails,
      notifications,
    })
  } catch (error) {
    console.error('Gmail sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync Gmail' },
      { status: 500 }
    )
  }
}
