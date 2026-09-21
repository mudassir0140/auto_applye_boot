import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, unauthorized } from '@/lib/session'
import { databaseErrorResponse } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

// Job-related emails for the signed-in user only (list view: no bodies).
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const emails = await prisma.jobEmail.findMany({
      where: { userId: user.id },
      orderBy: { receivedAt: 'desc' },
      take: 200,
      select: { id: true, from: true, subject: true, emailType: true, receivedAt: true, isRead: true, applicationId: true },
    })
    return NextResponse.json({ emails })
  } catch (error) {
    return databaseErrorResponse(error, 'api/emails')
  }
}
