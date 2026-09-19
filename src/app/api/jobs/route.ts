import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, unauthorized } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  const jobs = await prisma.job.findMany({
    where: { userId: user.id },
    orderBy: [{ matchScore: 'desc' }, { foundAt: 'desc' }],
    take: 200,
  })
  return NextResponse.json({ jobs })
}

// Save / skip a job. The userId in the where clause makes another user's job id a 404.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  const { jobId, status } = await req.json().catch(() => ({}))
  if (!jobId || !['saved', 'skipped', 'new'].includes(status)) {
    return NextResponse.json({ error: 'jobId and a valid status are required' }, { status: 400 })
  }
  const result = await prisma.job.updateMany({
    where: { id: jobId, userId: user.id },
    data: { status, savedAt: status === 'saved' ? new Date() : null },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
