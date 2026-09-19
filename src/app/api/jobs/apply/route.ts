import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAutoApply } from '@/lib/jobs'
import { checkApplicationCooldown, recordApplicationAttempt } from '@/lib/application-cooldown'

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

    const { jobId } = await req.json()

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Get user (verify ownership)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get job (verify ownership)
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    })

    if (!job || job.userId !== user.id) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Check if user already applied to this specific job
    const existingApplication = await prisma.jobApplication.findFirst({
      where: {
        jobId: job.id,
        userId: user.id,
      },
    })

    if (existingApplication) {
      return NextResponse.json(
        { error: 'Already applied to this job' },
        { status: 400 }
      )
    }

    // Check 7-day cooldown/duplicate prevention
    const cooldownCheck = await checkApplicationCooldown(
      user.id,
      job.url,
      job.company,
      'hiring@company.com' // This would come from job posting
    )

    if (cooldownCheck.isDuplicate) {
      return NextResponse.json(
        {
          error: 'Duplicate application blocked',
          message: `You already applied to this job or company recently. Try again in ${cooldownCheck.daysRemaining} days.`,
          lastApplyDate: cooldownCheck.lastApplyDate,
          cooldownExpiresAt: cooldownCheck.cooldownExpiresAt,
          daysRemaining: cooldownCheck.daysRemaining,
        },
        { status: 429 }
      )
    }

    // Check if we can auto-apply
    const { canApply: autoApplySupported, reason } = await canAutoApply(job.url)

    // Create application record
    const application = await prisma.jobApplication.create({
      data: {
        jobId: job.id,
        userId: user.id,
        status: 'applied',
        applicationUrl: job.url,
        notes: autoApplySupported ? 'Auto-applied' : reason,
      },
    })

    // Record in application history for cooldown tracking
    await recordApplicationAttempt(
      user.id,
      job.id,
      job.url,
      job.company,
      job.title,
      'hiring@company.com',
      autoApplySupported ? 'auto' : 'manual',
      'success',
      autoApplySupported ? 'Auto-applied' : reason
    )

    // Update job as applied
    await prisma.job.update({
      where: { id: jobId },
      data: { applied: true },
    })

    // Create notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'email',
        title: 'Application Submitted',
        message: `Applied to ${job.title} at ${job.company}`,
      },
    })

    return NextResponse.json({
      success: true,
      application,
      requiresManualApproval: !autoApplySupported,
      reason: reason || undefined,
    })
  } catch (error) {
    console.error('Apply error:', error)
    return NextResponse.json(
      { error: 'Failed to apply to job' },
      { status: 500 }
    )
  }
}
