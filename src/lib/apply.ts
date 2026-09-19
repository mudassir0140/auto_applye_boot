import { prisma } from './prisma'
import type { CurrentUser } from './session'
import { parseJsonList } from './session'
import { checkApplicationCooldown, recordApplicationAttempt } from './application-cooldown'
import { generateApplicationEmail, sendApplicationEmail, getGoogleAccount, isGmailConnected } from './gmail'

export type ApplyResult =
  | { ok: true; applicationId: string; method: 'auto' | 'manual'; sentTo?: string }
  | { ok: false; code: 'already_applied' | 'cooldown' | 'no_recipient' | 'gmail_not_connected' | 'send_failed' | 'not_found'; message: string; cooldownExpiresAt?: Date; daysRemaining?: number }

/**
 * Apply to one of the user's tracked jobs.
 *  - method "email": send from THIS user's Gmail to the address found in the posting
 *    (or `recipientEmail` supplied by the user), with their stored CV attached.
 *  - method "manual": the user applied on the employer's site; just record it.
 * Both paths enforce the 7-day cooldown and write Application + History rows.
 */
export async function applyToJob(
  user: CurrentUser,
  jobId: string,
  opts: { method: 'email' | 'manual'; recipientEmail?: string | null }
): Promise<ApplyResult> {
  const job = await prisma.job.findFirst({ where: { id: jobId, userId: user.id } })
  if (!job) return { ok: false, code: 'not_found', message: 'Job not found' }

  const existing = await prisma.jobApplication.findUnique({ where: { userId_jobId: { userId: user.id, jobId: job.id } } })
  if (existing) return { ok: false, code: 'already_applied', message: 'You already applied to this job.' }

  const recipient = opts.method === 'email' ? (opts.recipientEmail || job.applyEmail || null) : null
  if (opts.method === 'email' && !recipient) {
    return { ok: false, code: 'no_recipient', message: 'This posting has no application email. Apply on the employer site, then mark it as applied.' }
  }

  const cooldown = await checkApplicationCooldown(user.id, job.url, job.company, job.title, recipient)
  if (cooldown.isDuplicate) {
    return {
      ok: false,
      code: 'cooldown',
      message: `Already applied recently. You can apply again in ${cooldown.daysRemaining} day(s).`,
      cooldownExpiresAt: cooldown.cooldownExpiresAt,
      daysRemaining: cooldown.daysRemaining,
    }
  }

  if (opts.method === 'email') {
    const account = await getGoogleAccount(user.id)
    if (!isGmailConnected(account)) {
      return { ok: false, code: 'gmail_not_connected', message: 'Gmail is not connected. Sign in with Google again.' }
    }
  }

  // Claim the slot first: the unique (userId, jobId) index stops a double-click or
  // a concurrent cron run from sending the same application twice.
  let application
  try {
    application = await prisma.jobApplication.create({
      data: {
        userId: user.id,
        jobId: job.id,
        status: 'applied',
        applicationUrl: job.url,
        notes: opts.method === 'email' ? `Emailed ${recipient}` : 'Applied manually on employer site',
      },
    })
  } catch {
    return { ok: false, code: 'already_applied', message: 'You already applied to this job.' }
  }

  if (opts.method === 'email' && recipient) {
    try {
      const cv = await prisma.resumeFile.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
      const content = generateApplicationEmail({
        jobTitle: job.title,
        company: job.company,
        userName: user.name || user.email,
        userEmail: user.email,
        skills: parseJsonList(user.skills),
        cvUrl: user.cvUrl,
        portfolioUrl: user.portfolioUrl,
        hasAttachment: !!cv,
      })
      content.to = recipient
      if (cv) content.attachment = { fileName: cv.fileName, contentType: cv.contentType, data: Buffer.from(cv.data) }

      const sent = await sendApplicationEmail(user.id, content, user.name)

      await prisma.sentEmail.create({
        data: {
          userId: user.id,
          jobId: job.id,
          applicationId: application.id,
          gmailMessageId: sent.messageId,
          gmailThreadId: sent.threadId,
          to: recipient,
          subject: content.subject,
          body: content.bodyPlain,
        },
      })
    } catch (error) {
      await prisma.jobApplication.delete({ where: { id: application.id } }).catch(() => {})
      const message = error instanceof Error ? error.message : 'Failed to send email'
      await recordApplicationAttempt(user.id, job.id, job.url, job.company, job.title, recipient, 'auto', 'failed', message).catch(() => {})
      return { ok: false, code: 'send_failed', message }
    }
  }

  const method = opts.method === 'email' ? 'auto' : 'manual'
  await recordApplicationAttempt(user.id, job.id, job.url, job.company, job.title, recipient, method, 'success', application.notes ?? undefined)
  await prisma.job.update({ where: { id: job.id }, data: { applied: true, status: 'applied' } })
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: 'application',
      title: 'Application recorded',
      message: `${opts.method === 'email' ? `Emailed ${recipient} for` : 'Marked as applied:'} ${job.title} at ${job.company}`,
    },
  })

  return { ok: true, applicationId: application.id, method, sentTo: recipient ?? undefined }
}
