import { NextResponse } from 'next/server'
import { getCurrentUser, unauthorized } from '@/lib/session'
import { disconnectGmail } from '@/lib/gmail-disconnect'

export const dynamic = 'force-dynamic'

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  await disconnectGmail(user.id)
  return NextResponse.json({ success: true, message: 'Gmail account disconnected' })
}
