import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, unauthorized, parseJsonList } from '@/lib/session'
import { getGoogleAccount, isGmailConnected } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

const cleanList = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? Array.from(new Set(v.map((s) => String(s).trim()).filter(Boolean))).slice(0, 50) : undefined

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const [account, cv] = await Promise.all([
      getGoogleAccount(user.id),
      prisma.resumeFile.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: { fileName: true, size: true, createdAt: true } }),
    ])

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      cvUrl: user.cvUrl,
      portfolioUrl: user.portfolioUrl,
      cvFile: cv,
      skills: parseJsonList(user.skills),
      experience: parseJsonList(user.experience),
      education: parseJsonList(user.education),
      projects: parseJsonList(user.projects),
      preferredRoles: parseJsonList(user.preferredRoles),
      jobKeywords: parseJsonList(user.jobKeywords),
      jobLocations: parseJsonList(user.jobLocations),
      preferencesConfirmedAt: user.preferencesConfirmedAt,
      autoApplyEnabled: user.autoApplyEnabled,
      autoApplyMinScore: user.autoApplyMinScore,
      autoApplyDailyLimit: user.autoApplyDailyLimit,
      gmailConnected: isGmailConnected(account),
      profileParsedAt: user.profileParsedAt,
    })
  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

// Save profile fields. `confirm: true` records that the user reviewed the
// skills/preferences — background search and auto-apply only run after that.
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    const body = await req.json().catch(() => ({}))

    const skills = cleanList(body.skills)
    const jobKeywords = cleanList(body.jobKeywords)
    const jobLocations = cleanList(body.jobLocations)
    const preferredRoles = cleanList(body.preferredRoles)

    if (body.confirm && !(jobKeywords ?? parseJsonList(user.jobKeywords)).length) {
      return NextResponse.json({ error: 'Add at least one job keyword before confirming.' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(typeof body.name === 'string' && body.name.trim() ? { name: body.name.trim() } : {}),
        ...(typeof body.cvUrl === 'string' ? { cvUrl: body.cvUrl.trim() || null } : {}),
        ...(typeof body.portfolioUrl === 'string' ? { portfolioUrl: body.portfolioUrl.trim() || null } : {}),
        ...(skills ? { skills: JSON.stringify(skills) } : {}),
        ...(jobKeywords ? { jobKeywords: JSON.stringify(jobKeywords) } : {}),
        ...(jobLocations ? { jobLocations: JSON.stringify(jobLocations) } : {}),
        ...(preferredRoles ? { preferredRoles: JSON.stringify(preferredRoles) } : {}),
        ...(typeof body.autoApplyEnabled === 'boolean' ? { autoApplyEnabled: body.autoApplyEnabled } : {}),
        ...(Number.isInteger(body.autoApplyMinScore) ? { autoApplyMinScore: Math.min(100, Math.max(0, body.autoApplyMinScore)) } : {}),
        ...(Number.isInteger(body.autoApplyDailyLimit) ? { autoApplyDailyLimit: Math.min(25, Math.max(1, body.autoApplyDailyLimit)) } : {}),
        ...(body.confirm ? { preferencesConfirmedAt: new Date() } : {}),
      },
    })

    return NextResponse.json({ success: true, preferencesConfirmedAt: updated.preferencesConfirmedAt })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
