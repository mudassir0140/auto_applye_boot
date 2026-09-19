import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

    // Find and delete Google account
    const googleAccount = user.accounts.find(a => a.provider === 'google')
    if (!googleAccount) {
      return NextResponse.json(
        { error: 'Gmail not connected' },
        { status: 400 }
      )
    }

    await prisma.account.delete({
      where: { id: googleAccount.id },
    })

    console.log(`[/api/gmail/disconnect] Disconnected Gmail for user: ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Gmail account disconnected',
    })
  } catch (error) {
    console.error('[/api/gmail/disconnect] Error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Gmail' },
      { status: 500 }
    )
  }
}
