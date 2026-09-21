import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, unauthorized } from '@/lib/session'
import { databaseErrorResponse } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

// The applications list on its own (the page used to download the whole dashboard
// stats bundle — ~20 queries — and read 5 rows from it).
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const applications = await prisma.jobApplication.findMany({
      where: { userId: user.id },
      orderBy: { appliedAt: 'desc' },
      take: 200,
      include: { job: { select: { id: true, title: true, company: true, url: true, location: true } } },
    })
    return NextResponse.json({ applications })
  } catch (error) {
    return databaseErrorResponse(error, 'api/applications')
  }
}
