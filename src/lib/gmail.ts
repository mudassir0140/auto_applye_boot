import { google } from 'googleapis'
import { Session } from 'next-auth'
import { prisma } from './prisma'

export async function getGmailClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      user: { id: userId },
      provider: 'google',
    },
  })

  if (!account?.access_token) {
    throw new Error('Gmail not connected or access token expired')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  )

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

export async function fetchJobRelatedEmails(userId: string) {
  try {
    const gmail = await getGmailClient(userId)

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'subject:(job OR position OR apply OR interview OR assessment OR reject OR offer) is:unread',
      maxResults: 20,
    })

    const messages = response.data.messages || []
    const jobEmails = []

    for (const message of messages) {
      if (!message.id) continue

      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full',
      })

      const headers = msg.data.payload?.headers || []
      const from = headers.find(h => h.name === 'From')?.value || ''
      const subject = headers.find(h => h.name === 'Subject')?.value || ''
      const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString()

      const body = extractEmailBody(msg.data.payload)

      jobEmails.push({
        gmailMessageId: message.id,
        from,
        subject,
        body,
        receivedAt: new Date(date),
      })
    }

    return jobEmails
  } catch (error) {
    console.error('Error fetching Gmail emails:', error)
    return []
  }
}

function extractEmailBody(payload: any): string {
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain') {
        const data = part.body?.data
        if (data) {
          return Buffer.from(data, 'base64').toString('utf-8')
        }
      }
    }
  }

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  }

  return ''
}

export function classifyJobEmail(subject: string, body: string): string {
  const lowerSubject = subject.toLowerCase()
  const lowerBody = body.toLowerCase()
  const content = `${lowerSubject} ${lowerBody}`

  if (content.includes('interview') || content.includes('schedule')) {
    return 'interview'
  }
  if (content.includes('assessment') || content.includes('test')) {
    return 'assessment'
  }
  if (content.includes('reject') || content.includes('rejected') || content.includes('unfortunately')) {
    return 'rejection'
  }
  if (content.includes('offer') || content.includes('congratul')) {
    return 'offer'
  }
  if (content.includes('applied') || content.includes('received')) {
    return 'confirmation'
  }

  return 'other'
}

export interface EmailContent {
  to: string
  subject: string
  bodyPlain: string
  bodyHtml?: string
}

export async function sendApplicationEmail(
  userId: string,
  email: EmailContent
): Promise<{ messageId: string }> {
  try {
    const gmail = await getGmailClient(userId)

    const emailLines = [
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      'Content-Type: text/html; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      email.bodyHtml || email.bodyPlain,
    ]

    const message = emailLines.join('\n')
    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    })

    return {
      messageId: response.data.id || '',
    }
  } catch (error) {
    console.error('Error sending application email:', error)
    throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function getAccountEmail(userId: string): Promise<string> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        user: { id: userId },
        provider: 'google',
      },
    })

    if (!account?.access_token) {
      throw new Error('Gmail not connected')
    }

    const gmail = await getGmailClient(userId)
    const profile = await gmail.users.getProfile({
      userId: 'me',
    })

    return profile.data.emailAddress || ''
  } catch (error) {
    console.error('Error getting account email:', error)
    throw error
  }
}

export function generateApplicationEmail(
  jobTitle: string,
  company: string,
  recruiterName: string | null,
  userEmail: string,
  userName: string,
  cvUrl: string | null,
  portfolioUrl: string | null
): EmailContent {
  const greeting = recruiterName ? `Dear ${recruiterName}` : 'Dear Hiring Team'

  const portfolioLine = portfolioUrl ? `\nPortfolio: ${portfolioUrl}` : ''
  const cvLine = cvUrl ? `\nCV/Resume: ${cvUrl}` : ''

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { margin-bottom: 20px; }
    .greeting { font-size: 16px; margin-bottom: 15px; }
    .body-text { margin-bottom: 15px; }
    .signature { margin-top: 25px; padding-top: 15px; border-top: 1px solid #ddd; }
    .links { margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 5px; }
    .link-item { margin: 10px 0; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <p class="greeting">${greeting},</p>

      <div class="body-text">
        <p>I am writing to express my strong interest in the <strong>${jobTitle}</strong> position at <strong>${company}</strong>.</p>

        <p>With my background and skills, I believe I can make a valuable contribution to your team. I am enthusiastic about the opportunity to bring my expertise to ${company} and would welcome the chance to discuss how I can contribute to your team's success.</p>

        <p>Please find my application materials and information below:</p>
      </div>

      <div class="links">
        <div class="link-item"><strong>Email:</strong> ${userEmail}</div>
        ${cvLine ? `<div class="link-item"><strong>CV/Resume:</strong> <a href="${cvUrl}">${cvUrl}</a></div>` : ''}
        ${portfolioLine ? `<div class="link-item"><strong>Portfolio:</strong> <a href="${portfolioUrl}">${portfolioUrl}</a></div>` : ''}
      </div>

      <p style="margin-top: 20px;">Thank you for considering my application. I look forward to the opportunity to discuss this position with you.</p>
    </div>

    <div class="signature">
      <p>Best regards,<br><strong>${userName}</strong></p>
    </div>
  </div>
</body>
</html>
  `.trim()

  const bodyPlain = `
${greeting},

I am writing to express my strong interest in the ${jobTitle} position at ${company}.

With my background and skills, I believe I can make a valuable contribution to your team. I am enthusiastic about the opportunity to bring my expertise to ${company} and would welcome the chance to discuss how I can contribute to your team's success.

Please find my application materials and information below:

Email: ${userEmail}
${cvLine}
${portfolioLine}

Thank you for considering my application. I look forward to the opportunity to discuss this position with you.

Best regards,
${userName}
  `.trim()

  return {
    to: '', // Will be set by caller
    subject: `Application for ${jobTitle} position at ${company}`,
    bodyPlain,
    bodyHtml,
  }
}
