import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { searchJobsFromRSS, calculateJobMatchScore } from '@/lib/jobs'

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

    const { keywords, location } = await req.json()

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Keywords array is required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const jobs = await searchJobsFromRSS(keywords, location)

    const savedJobs = []

    for (const job of jobs) {
      // Check if job already exists for this user
      const existingJob = await prisma.job.findFirst({
        where: { userId: user.id, url: job.url },
      })

      if (existingJob) {
        savedJobs.push(existingJob)
        continue
      }

      const userSkills = user.portfolioUrl?.split(',') || []
      const matchScore = calculateJobMatchScore(job.description || '', userSkills)

      const savedJob = await prisma.job.create({
        data: {
          userId: user.id,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          url: job.url,
          source: job.source,
          salary: job.salary,
          jobType: job.jobType,
          seniority: job.seniority,
          matchScore,
        },
      })

      savedJobs.push(savedJob)
    }

    return NextResponse.json({
      success: true,
      count: savedJobs.length,
      jobs: savedJobs,
    })
  } catch (error) {
    console.error('Job search error:', error)
    return NextResponse.json(
      { error: 'Failed to search jobs' },
      { status: 500 }
    )
  }
}
