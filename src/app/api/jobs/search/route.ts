import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, unauthorized } from '@/lib/session'
import { discoverJobsForUser } from '@/lib/workflow'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()

    const { keywords, location } = await req.json().catch(() => ({}))
    const list = Array.isArray(keywords) ? keywords.filter((k: unknown) => typeof k === 'string' && k.trim()) : []

    const result = await discoverJobsForUser(user, { keywords: list, location })
    const jobs = await prisma.job.findMany({ where: { userId: user.id }, orderBy: [{ matchScore: 'desc' }, { foundAt: 'desc' }], take: 100 })
    return NextResponse.json({ success: true, ...result, count: jobs.length, jobs })
  } catch (error) {
    console.error('Job search error:', error)
    return NextResponse.json({ error: 'Failed to search jobs' }, { status: 500 })
  }
}
