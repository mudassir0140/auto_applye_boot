import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseResumeText, parseResumeFromUrl } from '@/lib/resume-parser'
import type { ResumeProfile } from '@/lib/resume-parser'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
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
      include: {
        accounts: {
          select: {
            provider: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      cvUrl: user.cvUrl,
      portfolioUrl: user.portfolioUrl,
      skills: user.skills ? JSON.parse(user.skills) : [],
      experience: user.experience ? JSON.parse(user.experience) : [],
      education: user.education ? JSON.parse(user.education) : [],
      projects: user.projects ? JSON.parse(user.projects) : [],
      preferredRoles: user.preferredRoles ? JSON.parse(user.preferredRoles) : [],
      jobKeywords: user.jobKeywords ? JSON.parse(user.jobKeywords) : [],
      jobLocations: user.jobLocations ? JSON.parse(user.jobLocations) : [],
      connectedProviders: user.accounts.map(a => a.provider),
      profileParsedAt: user.profileParsedAt,
    })
  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { name, cvUrl, portfolioUrl, resumeText, jobKeywords, jobLocations, preferredRoles } = await req.json()

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Parse resume/portfolio if provided
    let parsedProfile: ResumeProfile = {
      skills: [],
      experience: [],
      education: [],
      projects: [],
      preferredRoles: preferredRoles || [],
    }

    if (resumeText) {
      parsedProfile = await parseResumeText(resumeText)
    } else if (portfolioUrl && !user.portfolioUrl) {
      try {
        parsedProfile = await parseResumeFromUrl(portfolioUrl)
      } catch (error) {
        console.error('Error parsing portfolio:', error)
      }
    } else if (cvUrl && !user.cvUrl) {
      try {
        parsedProfile = await parseResumeFromUrl(cvUrl)
      } catch (error) {
        console.error('Error parsing CV:', error)
      }
    }

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        ...(name && { name }),
        ...(cvUrl && { cvUrl }),
        ...(portfolioUrl && { portfolioUrl }),
        skills: JSON.stringify(parsedProfile.skills),
        experience: JSON.stringify(parsedProfile.experience),
        education: JSON.stringify(parsedProfile.education),
        projects: JSON.stringify(parsedProfile.projects),
        preferredRoles: JSON.stringify(parsedProfile.preferredRoles || preferredRoles || []),
        jobKeywords: jobKeywords ? JSON.stringify(jobKeywords) : user.jobKeywords,
        jobLocations: jobLocations ? JSON.stringify(jobLocations) : user.jobLocations,
        profileParsedAt: resumeText || portfolioUrl || cvUrl ? new Date() : user.profileParsedAt,
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        cvUrl: updatedUser.cvUrl,
        portfolioUrl: updatedUser.portfolioUrl,
        skills: parsedProfile.skills,
        experience: parsedProfile.experience,
        education: parsedProfile.education,
        projects: parsedProfile.projects,
        preferredRoles: parsedProfile.preferredRoles || preferredRoles || [],
        jobKeywords: jobKeywords || [],
        jobLocations: jobLocations || [],
      },
    })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update profile' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { action, resumeText, portfolioUrl, cvUrl } = body

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (action === 'parseResume') {
      let parsedProfile: ResumeProfile = {
        skills: [],
        experience: [],
        education: [],
        projects: [],
        preferredRoles: [],
      }

      if (resumeText) {
        parsedProfile = await parseResumeText(resumeText)
      } else if (portfolioUrl) {
        parsedProfile = await parseResumeFromUrl(portfolioUrl)
      } else if (cvUrl) {
        parsedProfile = await parseResumeFromUrl(cvUrl)
      }

      return NextResponse.json({
        success: true,
        parsed: parsedProfile,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Profile POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    )
  }
}
