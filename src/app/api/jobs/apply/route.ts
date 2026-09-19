import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, unauthorized } from '@/lib/session'
import { applyToJob } from '@/lib/apply'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// method "email" (default): send from the user's Gmail if the posting has an
// application email. method "manual": user applied on the employer site.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  const { jobId, method, recipientEmail } = await req.json().catch(() => ({}))
  if (!jobId) return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })

  const result = await applyToJob(user, jobId, { method: method === 'manual' ? 'manual' : 'email', recipientEmail })
  if (!result.ok) {
    const status = result.code === 'cooldown' ? 429 : result.code === 'not_found' ? 404 : result.code === 'send_failed' ? 502 : 400
    return NextResponse.json({ ...result, error: result.message }, { status })
  }
  return NextResponse.json(result)
}
