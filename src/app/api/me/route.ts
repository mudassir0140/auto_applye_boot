import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getCurrentUser } from '@/lib/session'
import { persistGoogleAccount } from '@/lib/auth'
import { databaseErrorResponse } from '@/lib/db-error'
import { getGoogleAccount, isGmailConnected } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

// Source of truth for "who is signed in and is Gmail connected". Reads MongoDB,
// never the browser. OAuth tokens are deliberately not included in the response.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ connected: false, email: null, user: null })
    }
    let account = await getGoogleAccount(user.id)
    if (!account) {
      // Signed in while MongoDB was unreachable: the JWT still holds the grant,
      // so save the Google account now. (A disconnected account keeps its row,
      // so an explicit disconnect is never undone here.)
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
      if (token?.sub && !token.error && (token.access_token || token.refresh_token)) {
        await persistGoogleAccount(
          { email: user.email, name: user.name, picture: user.image },
          { providerAccountId: token.sub, access_token: token.access_token, refresh_token: token.refresh_token, expires_at: token.expires_at }
        )
        account = await getGoogleAccount(user.id)
      }
    }
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
    return databaseErrorResponse(error, 'api/me')
  }
}
