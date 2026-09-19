import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, unauthorized } from '@/lib/session'
import { applyToJob } from '@/lib/apply'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  const { jobId, recruiterEmail } = await req.json().catch(() => ({}))
  if (!jobId) return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })

  const result = await applyToJob(user, jobId, { method: 'email', recipientEmail: recruiterEmail })
  if (!result.ok) {
    const status = result.code === 'cooldown' ? 429 : result.code === 'not_found' ? 404 : result.code === 'send_failed' ? 502 : 400
    return NextResponse.json({ ...result, error: result.message }, { status })
  }
  return NextResponse.json({ ...result, message: `Application email sent to ${result.sentTo}` })
}
