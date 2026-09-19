import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, unauthorized } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 })
  return NextResponse.json({ notifications, unread: notifications.filter((n) => !n.read).length })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  const { id } = await req.json().catch(() => ({}))
  await prisma.notification.updateMany({ where: { userId: user.id, ...(id ? { id } : {}) }, data: { read: true } })
  return NextResponse.json({ success: true })
}
