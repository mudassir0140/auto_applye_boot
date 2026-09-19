import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runWorkflowForUser } from '@/lib/workflow'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Scheduled background pass (vercel.json "crons"). Vercel sends
// `Authorization: Bearer $CRON_SECRET`. Runs with the browser closed.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await prisma.user.findMany({ where: { preferencesConfirmedAt: { not: null } } })
  const results = []
  for (const user of users) {
    results.push(await runWorkflowForUser(user))
  }
  return NextResponse.json({ success: true, users: users.length, results })
}
