import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// Route handlers are otherwise eligible for static optimization/caching in
// the App Router. Forcing dynamic rendering guarantees /api/auth/session,
// /api/auth/providers, etc. are evaluated per-request (reading the real
// cookie) instead of ever serving a cached response to a different user.
export const dynamic = 'force-dynamic'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
