import { NextResponse } from 'next/server'
import { getCurrentUser, unauthorized } from '@/lib/session'
import { syncGmailForUser } from '@/lib/workflow'
import { GmailNotConnectedError } from '@/lib/gmail'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  try {
    const result = await syncGmailForUser(user)
    return NextResponse.json({ success: true, emailsSync: result.saved, scanned: result.scanned })
  } catch (error) {
    if (error instanceof GmailNotConnectedError) {
      return NextResponse.json({ error: error.message, needsReconnect: true }, { status: 400 })
    }
    console.error('Gmail sync error:', error)
    return NextResponse.json({ error: 'Failed to sync Gmail' }, { status: 500 })
  }
}
