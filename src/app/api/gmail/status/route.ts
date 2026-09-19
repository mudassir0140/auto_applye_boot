import { NextResponse } from 'next/server'
import { getCurrentUser, unauthorized } from '@/lib/session'
import { getGoogleAccount, isGmailConnected } from '@/lib/gmail'
import { disconnectGmail } from '@/lib/gmail-disconnect'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const account = await getGoogleAccount(user.id)
    const connected = isGmailConnected(account)
    return NextResponse.json({
      connected,
      email: connected ? user.email : null,
      needsReconnect: !!account && !connected,
      lastSync: user.lastGmailSyncAt,
    })
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Failed to check Gmail status' }, { status: 500 })
  }
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  await disconnectGmail(user.id)
  return NextResponse.json({ success: true, message: 'Gmail disconnected successfully' })
}
