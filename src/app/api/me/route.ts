import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { getGoogleAccount, isGmailConnected } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

// Source of truth for "who is signed in and is Gmail connected". Reads MongoDB,
// never the browser. OAuth tokens are deliberately not included in the response.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ connected: false, email: null, user: null })
    }
    const account = await getGoogleAccount(user.id)
    const connected = isGmailConnected(account)
    return NextResponse.json({
      connected,
      email: connected ? user.email : null,
      needsReconnect: !!account && !connected,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        preferencesConfirmed: !!user.preferencesConfirmedAt,
      },
    })
  } catch (error) {
    console.error('[/api/me] Error:', error)
    return NextResponse.json({ error: 'Failed to check connection status', connected: false }, { status: 500 })
  }
}
