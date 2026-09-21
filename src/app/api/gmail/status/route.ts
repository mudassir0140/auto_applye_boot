import { NextResponse } from 'next/server'
import { getCurrentUser, unauthorized } from '@/lib/session'
import { NextRequest } from 'next/server'
import { getGoogleAccount, isGmailConnected, gmailIssueFrom, checkGmailHealth } from '@/lib/gmail'
import { disconnectGmail } from '@/lib/gmail-disconnect'

export const dynamic = 'force-dynamic'

// GET            -> stored state (no Google call)
// GET ?check=1   -> one real Gmail API call to verify it works right now (e.g. after enabling the API)
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    let health: Awaited<ReturnType<typeof checkGmailHealth>> | null = null
    if (req.nextUrl.searchParams.get('check')) health = await checkGmailHealth(user.id)
    const account = await getGoogleAccount(user.id)
    const connected = isGmailConnected(account)
    return NextResponse.json({
      connected,
      issue: gmailIssueFrom(account),
      health,
      lastChecked: account?.gmailCheckedAt ?? null,
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
