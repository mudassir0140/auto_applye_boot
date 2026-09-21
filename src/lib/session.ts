import '@/lib/normalize-env'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth'
import { prisma } from './prisma'

const OBJECT_ID = /^[a-f\d]{24}$/i

export function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID.test(value)
}

/**
 * Resolve the signed-in user from the session cookie and confirm the user still
 * exists in the database. Every API route derives `userId` from here — never
 * from the request body or query string — so records stay isolated per user.
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  const id = (session?.user as { id?: string } | undefined)?.id
  if (isObjectId(id)) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (user) return user
  }
  // Session predates the DB row (MongoDB was unreachable at sign-in): resolve by email.
  const email = session?.user?.email?.toLowerCase()
  if (!email) return null
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: session?.user?.name ?? null, image: session?.user?.image ?? null },
  })
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function parseJsonList(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Same as getCurrentUser(), but loads the user's Google account in the SAME round
 * trip (both queries run in parallel from the session id) instead of one after the
 * other. Falls back to the email lookup for sessions that predate the DB row.
 */
export async function getCurrentUserWithGoogle() {
  const session = await getServerSession(authOptions)
  const id = (session?.user as { id?: string } | undefined)?.id
  if (isObjectId(id)) {
    const [user, googleAccount] = await Promise.all([
      prisma.user.findUnique({ where: { id } }),
      prisma.account.findFirst({ where: { userId: id, provider: 'google' } }),
    ])
    if (user) return { user, googleAccount }
  }
  const user = await getCurrentUser()
  if (!user) return null
  return { user, googleAccount: await prisma.account.findFirst({ where: { userId: user.id, provider: 'google' } }) }
}
