import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({
        connected: false,
        email: null,
        user: null,
      })
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        accounts: {
          select: {
            id: true,
            provider: true,
            access_token: true,
            refresh_token: true,
            expires_at: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({
        connected: false,
        email: null,
        user: null,
      })
    }

    // Check if Google account is connected with tokens
    const googleAccount = user.accounts.find(a => a.provider === 'google')
    const gmailConnected = !!googleAccount?.access_token

    return NextResponse.json({
      connected: gmailConnected,
      email: gmailConnected ? session.user.email : null,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: session.user.image,
      },
      googleAccount: gmailConnected ? {
        hasRefreshToken: !!googleAccount?.refresh_token,
        expiresAt: googleAccount?.expires_at,
      } : null,
    })
  } catch (error) {
    console.error('[/api/me] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to check connection status',
        connected: false,
      },
      { status: 500 }
    )
  }
}
