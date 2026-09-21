import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, unauthorized } from '@/lib/session'
import { runCompanyOutreach } from '@/lib/company-outreach'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Companies found through Google Maps / Search and what happened with each.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  const companies = await prisma.company.findMany({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' }, take: 200 })
  return NextResponse.json({ companies })
}

// Discover companies, check their sites, and email them from the user's Gmail.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  const { websites } = await req.json().catch(() => ({}))
  const list = Array.isArray(websites) ? websites.filter((w: unknown): w is string => typeof w === 'string').slice(0, 20) : []
  try {
    return NextResponse.json({ success: true, ...(await runCompanyOutreach(user, { websites: list })) })
  } catch (error) {
    console.error('Company outreach error:', error)
    return NextResponse.json({ error: 'Company outreach failed' }, { status: 500 })
  }
}
