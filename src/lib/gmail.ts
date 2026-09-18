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
