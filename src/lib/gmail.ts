import { google } from 'googleapis'
import { prisma } from './prisma'

export class GmailNotConnectedError extends Error {
  constructor(message = 'Gmail is not connected. Sign in with Google again to reconnect.') {
    super(message)
    this.name = 'GmailNotConnectedError'
  }
}

export async function getGoogleAccount(userId: string) {
  return prisma.account.findFirst({ where: { userId, provider: 'google' } })
}

export function isGmailConnected(account: { access_token: string | null; refresh_token: string | null; disconnectedAt: Date | null } | null | undefined) {
  return !!account && !account.disconnectedAt && !!(account.access_token || account.refresh_token)
}

/**
 * Gmail client for one user, authenticated with THAT user's stored OAuth tokens.
 * Tokens stay server-side; an expired access token is refreshed with the stored
 * refresh token and the new one is written back to MongoDB.
 */
export async function getGmailClient(userId: string) {
  const account = await getGoogleAccount(userId)
  if (!account || !isGmailConnected(account)) throw new GmailNotConnectedError()

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  })

  oauth2Client.on('tokens', (tokens) => {
    prisma.account
      .update({
        where: { id: account.id },
        data: {
          ...(tokens.access_token ? { access_token: tokens.access_token } : {}),
          ...(tokens.expiry_date ? { expires_at: Math.floor(tokens.expiry_date / 1000) } : {}),
          ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
        },
      })
      .catch((err) => console.error('[gmail] failed to persist refreshed token:', err))
  })

  return { gmail: google.gmail({ version: 'v1', auth: oauth2Client }), oauth2Client, account }
}

/** Force a token refresh now if the access token is expired/expiring. */
export async function ensureFreshToken(userId: string): Promise<{ refreshed: boolean }> {
  const { oauth2Client, account } = await getGmailClient(userId)
  const expiresAt = (account.expires_at ?? 0) * 1000
  if (account.access_token && expiresAt - Date.now() > 5 * 60 * 1000) return { refreshed: false }
  try {
    const { credentials } = await oauth2Client.refreshAccessToken()
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: credentials.access_token ?? null,
        expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : null,
        ...(credentials.refresh_token ? { refresh_token: credentials.refresh_token } : {}),
      },
    })
    return { refreshed: true }
  } catch (error) {
    await handleGoogleAuthFailure(userId, error)
    throw error
  }
}

/** Google revoked the grant / refresh token is dead → mark disconnected so the UI asks to re-login. */
export async function handleGoogleAuthFailure(userId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/invalid_grant|invalid_client|unauthorized_client|Token has been expired or revoked/i.test(message)) {
    await prisma.account.updateMany({
      where: { userId, provider: 'google' },
      data: { access_token: null, refresh_token: null, expires_at: null, disconnectedAt: new Date() },
    })
  }
}

export interface FetchedEmail {
  gmailMessageId: string
  gmailThreadId: string | null
  from: string
  subject: string
  body: string
  receivedAt: Date
}

/** Recent inbox messages (not sent by the user) that look job-related. */
export async function fetchJobRelatedEmails(userId: string, days = 30): Promise<FetchedEmail[]> {
  const { gmail } = await getGmailClient(userId)
  try {
    const list = await gmail.users.messages.list({
      userId: 'me',
      q: `in:inbox -from:me newer_than:${days}d (interview OR assessment OR application OR applied OR candidate OR position OR role OR offer OR unfortunately OR "your application" OR recruiter OR hiring)`,
      maxResults: 50,
    })

    const emails: FetchedEmail[] = []
    for (const message of list.data.messages || []) {
      if (!message.id) continue
      const msg = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' })
      const headers = msg.data.payload?.headers || []
      const header = (name: string) => headers.find((h) => h.name?.toLowerCase() === name)?.value || ''
      const dateHeader = header('date')
      const received = msg.data.internalDate
        ? new Date(Number(msg.data.internalDate))
        : dateHeader
          ? new Date(dateHeader)
          : new Date()
      emails.push({
        gmailMessageId: message.id,
        gmailThreadId: msg.data.threadId || null,
        from: header('from'),
        subject: header('subject'),
        body: extractEmailBody(msg.data.payload).slice(0, 20000),
        receivedAt: isNaN(received.getTime()) ? new Date() : received,
      })
    }
    return emails
  } catch (error) {
    await handleGoogleAuthFailure(userId, error)
    throw error
  }
}

function decode(data: string) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function extractEmailBody(payload: any): string {
  if (!payload) return ''
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decode(payload.body.data)
  for (const part of payload.parts || []) {
    const found = extractEmailBody(part)
    if (found) return found
  }
  if (payload.body?.data) {
    const text = decode(payload.body.data)
    return payload.mimeType === 'text/html' ? text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') : text
  }
  return ''
}

export function classifyJobEmail(subject: string, body: string): string {
  const content = `${subject} ${body}`.toLowerCase()
  const has = (re: RegExp) => re.test(content)

  if (has(/\b(unfortunately|not (be )?moving forward|not selected|regret to inform|other candidates|decided not to (proceed|move)|rejected)\b/)) return 'rejection'
  if (has(/\b(job offer|offer letter|pleased to offer|offer of employment|extend (you )?an offer)\b/)) return 'offer'
  if (has(/\b(interview|schedule a (call|chat|meeting)|phone screen|video call)\b/)) return 'interview'
  if (has(/\b(assessment|coding (test|challenge)|take-home|technical test|hackerrank|codility|skills test)\b/)) return 'assessment'
  if (has(/\b(thank you for applying|we('| ha)ve received your application|application (has been )?received|successfully (applied|submitted))\b/)) return 'confirmation'
  return 'other'
}

export interface EmailContent {
  to: string
  subject: string
  bodyPlain: string
  bodyHtml?: string
  attachment?: { fileName: string; contentType: string; data: Buffer }
}

function encodeHeader(value: string) {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`
}

function wrap76(b64: string) {
  return b64.replace(/(.{76})/g, '$1\r\n')
}

function buildMime(from: string, email: EmailContent): string {
  const boundary = `boot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
  const altBoundary = `${boundary}_alt`
  const headers = [
    `From: ${from}`,
    `To: ${email.to}`,
    `Subject: ${encodeHeader(email.subject)}`,
    'MIME-Version: 1.0',
  ]
  const bodyPart = (ctype: string, content: string) =>
    `Content-Type: ${ctype}; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(Buffer.from(content, 'utf-8').toString('base64'))}`

  const alternative = email.bodyHtml
    ? `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n` +
      `--${altBoundary}\r\n${bodyPart('text/plain', email.bodyPlain)}\r\n` +
      `--${altBoundary}\r\n${bodyPart('text/html', email.bodyHtml)}\r\n` +
      `--${altBoundary}--`
    : bodyPart('text/plain', email.bodyPlain)

  if (!email.attachment) {
    return `${headers.join('\r\n')}\r\n${alternative}`
  }

  const { fileName, contentType, data } = email.attachment
  const safeName = fileName.replace(/["\r\n]/g, '')
  return (
    `${headers.join('\r\n')}\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n` +
    `--${boundary}\r\n${alternative}\r\n` +
    `--${boundary}\r\nContent-Type: ${contentType}; name="${safeName}"\r\n` +
    `Content-Disposition: attachment; filename="${safeName}"\r\nContent-Transfer-Encoding: base64\r\n\r\n` +
    `${wrap76(data.toString('base64'))}\r\n--${boundary}--`
  )
}

/** Sends through the user's own Gmail; the message appears in their Sent folder. */
export async function sendApplicationEmail(
  userId: string,
  email: EmailContent,
  fromName?: string | null
): Promise<{ messageId: string; threadId: string | null; from: string }> {
  const { gmail } = await getGmailClient(userId)
  try {
    const profile = await gmail.users.getProfile({ userId: 'me' })
    const address = profile.data.emailAddress || ''
    const from = fromName ? `${encodeHeader(fromName)} <${address}>` : address
    const raw = Buffer.from(buildMime(from, email))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const response = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    return { messageId: response.data.id || '', threadId: response.data.threadId || null, from: address }
  } catch (error) {
    await handleGoogleAuthFailure(userId, error)
    throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function generateApplicationEmail(opts: {
  jobTitle: string
  company: string
  userName: string
  userEmail: string
  skills: string[]
  cvUrl: string | null
  portfolioUrl: string | null
  hasAttachment: boolean
}): EmailContent {
  const { jobTitle, company, userName, userEmail, skills, cvUrl, portfolioUrl, hasAttachment } = opts
  const skillLine = skills.length ? `My core skills include ${skills.slice(0, 8).join(', ')}.` : ''

  const lines = [
    'Dear Hiring Team,',
    '',
    `I am writing to apply for the ${jobTitle} position at ${company}. ${skillLine}`.trim(),
    '',
    hasAttachment ? 'My CV is attached to this email.' : '',
    cvUrl ? `CV: ${cvUrl}` : '',
    portfolioUrl ? `Portfolio: ${portfolioUrl}` : '',
    '',
    'Thank you for your time and consideration. I would welcome the chance to discuss the role.',
    '',
    'Best regards,',
    userName,
    userEmail,
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))

  const bodyPlain = lines.join('\n')
  const bodyHtml = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">${lines
    .map((l) => (l ? `<p style="margin:0 0 8px">${escapeHtml(l)}</p>` : '<br>'))
    .join('')}</div>`

  return { to: '', subject: `Application for ${jobTitle} – ${userName}`, bodyPlain, bodyHtml }
}
