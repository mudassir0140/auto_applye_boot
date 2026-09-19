import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { accounts: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const googleAccount = user.accounts.find(a => a.provider === 'google')
    if (!googleAccount) {
      return NextResponse.json(
        { error: 'Gmail not connected' },
        { status: 400 }
      )
    }

    // Check if token needs refresh (expires within 5 minutes)
    const expiresAt = googleAccount.expires_at || 0
    const now = Math.floor(Date.now() / 1000)
    const shouldRefresh = expiresAt - now < 300

    if (!shouldRefresh) {
      return NextResponse.json({
        success: true,
        refreshed: false,
        expiresIn: expiresAt - now,
      })
    }

    // Refresh the token if we have a refresh token
    if (!googleAccount.refresh_token) {
      return NextResponse.json(
        { error: 'No refresh token available' },
        { status: 400 }
      )
    }

    const refreshResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: googleAccount.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!refreshResponse.ok) {
      const errorData = await refreshResponse.json()
      console.error('[token-refresh] Google error:', errorData)
      return NextResponse.json(
        { error: 'Failed to refresh token', details: errorData },
        { status: 400 }
      )
    }

    const newTokenData = await refreshResponse.json()

    // Update the account with new token info
    await prisma.account.update({
      where: { id: googleAccount.id },
      data: {
        access_token: newTokenData.access_token,
        expires_at: Math.floor(Date.now() / 1000) + (newTokenData.expires_in || 3599),
        // Keep existing refresh token if new one wasn't provided
        refresh_token: newTokenData.refresh_token || googleAccount.refresh_token,
      },
    })

    console.log(`[token-refresh] Successfully refreshed token for user: ${user.email}`)

    return NextResponse.json({
      success: true,
      refreshed: true,
      expiresIn: newTokenData.expires_in || 3599,
    })
  } catch (error) {
    console.error('[token-refresh] Error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    )
  }
}
