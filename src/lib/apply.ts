import { prisma } from './prisma'
import type { CurrentUser } from './session'
import { parseJsonList } from './session'
import { checkApplicationCooldown, recordApplicationAttempt } from './application-cooldown'
import {
  generateApplicationEmail,
  sendApplicationEmail,
  getGoogleAccount,
  isGmailConnected,
  GmailApiDisabledError,
  GmailScopeError,
  GmailNotConnectedError,
} from './gmail'

export type ApplyFailureCode =
  | 'already_applied'
  | 'cooldown'
  | 'no_recipient'
  | 'no_cv'
  | 'gmail_not_connected'
  | 'gmail_api_disabled'
  | 'gmail_scope_missing'
  | 'send_failed'
  | 'not_found'

export type ApplyResult =
  | { ok: true; applicationId: string; method: 'auto' | 'manual'; sentTo?: string }
  | { ok: false; code: ApplyFailureCode; message: string; cooldownExpiresAt?: Date; daysRemaining?: number }

export function httpStatusForApplyFailure(code: ApplyFailureCode): number {
  switch (code) {
    case 'cooldown':
      return 429
    case 'not_found':
      return 404
    case 'send_failed':
      return 502
    case 'gmail_api_disabled':
      return 503
    case 'gmail_scope_missing':
      return 403
    default:
      return 400
  }
}

/** Failures that will hit every other job too — the auto-apply loop stops on these. */
export const BLOCKING_APPLY_FAILURES: ApplyFailureCode[] = ['gmail_not_connected', 'gmail_api_disabled', 'gmail_scope_missing', 'no_cv']

/**
 * Apply to one of the user's tracked jobs.
 *  - method "email": send from THIS user's Gmail to the address found in the posting
 *    (or `recipientEmail` supplied by the user), with their stored CV attached.
 *    Recorded as applied ONLY after Gmail confirms the message was sent; any failure
 *    is saved on the job (status apply_failed + the reason) and in the history, never hidden.
 *  - method "manual": the user applied on the employer's site/ATS themselves; Boot records
 *    that (there is no legitimate way for Boot to submit those forms for them).
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

  if (opts.method === 'email') {
    const account = await getGoogleAccount(user.id)
    if (!isGmailConnected(account)) {
      return { ok: false, code: 'gmail_not_connected', message: 'Gmail is not connected. Sign in with Google again.' }
    }
    const cv = await prisma.resumeFile.findFirst({ where: { userId: user.id }, select: { id: true } })
    if (!cv && !user.cvUrl) {
      return { ok: false, code: 'no_cv', message: 'Upload your CV on the Profile page before Boot emails applications for you.' }
    }
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

  // Claim the slot first: the unique (userId, jobId) index stops a double-click or
  // a concurrent cron run from sending the same application twice.
  let application
  try {
    application = await prisma.jobApplication.create({
      data: {
        userId: user.id,
        jobId: job.id,
        status: 'applied',
        applicationUrl: job.applyUrl || job.url,
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

      // The email IS sent at this point. If saving the record fails we must NOT roll the
      // application back (it would be re-sent later); log it and carry on.
      await prisma.sentEmail
        .create({
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
        .catch((err) => console.error('[apply] email was sent but saving SentEmail failed:', err))
    } catch (error) {
      // Not sent → not applied. Undo the claim, keep the reason visible on the job and in the history.
      await prisma.jobApplication.delete({ where: { id: application.id } }).catch(() => {})
      const message = error instanceof Error ? error.message : 'Failed to send email'
      const code: ApplyFailureCode =
        error instanceof GmailApiDisabledError
          ? 'gmail_api_disabled'
          : error instanceof GmailScopeError
            ? 'gmail_scope_missing'
            : error instanceof GmailNotConnectedError
              ? 'gmail_not_connected'
              : 'send_failed'
      await recordApplicationAttempt(user.id, job.id, job.url, job.company, job.title, recipient, 'auto', 'failed', message).catch(() => {})
      // A problem with THIS job's send (bad address, rejected) marks it apply_failed so it is not
      // retried blindly. A Gmail-wide problem (API disabled, permission missing, not connected)
      // keeps the job as-is — only the reason is recorded — so it is retried automatically once fixed.
      const gmailWide = BLOCKING_APPLY_FAILURES.includes(code)
      await prisma.job
        .update({
          where: { id: job.id },
          data: { ...(gmailWide ? {} : { status: 'apply_failed' }), applyError: message, applyAttemptedAt: new Date() },
        })
        .catch(() => {})
      await prisma.notification
        .create({
          data: { userId: user.id, type: 'application_failed', title: `Application NOT sent: ${job.title} at ${job.company}`, message },
        })
        .catch(() => {})
      return { ok: false, code, message }
    }
  }

  const method = opts.method === 'email' ? 'auto' : 'manual'
  await recordApplicationAttempt(user.id, job.id, job.url, job.company, job.title, recipient, method, 'success', application.notes ?? undefined)
  await prisma.job.update({ where: { id: job.id }, data: { applied: true, status: 'applied', applyError: null, applyAttemptedAt: new Date() } })
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
