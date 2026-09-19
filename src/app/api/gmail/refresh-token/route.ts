import { NextResponse } from 'next/server'
import { getCurrentUser, unauthorized } from '@/lib/session'
import { ensureFreshToken, GmailNotConnectedError } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  try {
    const { refreshed } = await ensureFreshToken(user.id)
    return NextResponse.json({ success: true, refreshed })
  } catch (error) {
    if (error instanceof GmailNotConnectedError) {
      return NextResponse.json({ error: error.message, needsReconnect: true }, { status: 400 })
    }
    console.error('[token-refresh] Error:', error)
    return NextResponse.json({ error: 'Failed to refresh token', needsReconnect: true }, { status: 400 })
  }
}
