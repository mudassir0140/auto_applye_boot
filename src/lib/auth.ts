import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'

function getBaseUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

const baseUrl = getBaseUrl()
const clientId = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
const secret = process.env.NEXTAUTH_SECRET

if (!secret) {
  const instructions = process.env.NODE_ENV === 'production'
    ? 'Set NEXTAUTH_SECRET in your Vercel project environment variables'
    : 'Set NEXTAUTH_SECRET in .env.local'
  throw new Error(`NextAuth Configuration Error: NEXTAUTH_SECRET is not set. ${instructions}`)
}

if (!clientId || clientId === 'your-google-client-id-here') {
  console.error('[auth] GOOGLE_CLIENT_ID is missing or still a placeholder — sign-in will fail with 401: invalid_client')
}
if (!clientSecret || clientSecret === 'your-google-client-secret-here') {
  console.error('[auth] GOOGLE_CLIENT_SECRET is missing or still a placeholder — sign-in will fail')
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: clientId || '',
      clientSecret: clientSecret || '',
      allowDangerousEmailAccountLinking: false,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        }
      },
    }),
  ],
  callbacks: {
    // Runs on every request. `user`/`account` are only populated on the
    // initial sign-in — that's when we copy the Prisma User id and Google
    // profile picture onto the token so they survive for the life of the
    // session (the JWT cookie), without a database lookup on every request.
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.picture = user.image
      }
      if (account?.provider) {
        token.provider = account.provider
      }
      return token
    },
    // With strategy: 'jwt', session() receives `token`, not `user` — read the
    // id/picture back off the token instead of doing a per-request DB call.
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id as string
        if (token.picture) {
          session.user.image = token.picture as string
        }
      }
      return session
    },
    async signIn({ user, account }) {
      // PrismaAdapter creates/links the User + Account rows (with Google's
      // access/refresh tokens) before this callback runs. Refuse to issue a
      // session if that somehow didn't happen.
      if (!user?.id) {
        console.error('[auth] signIn blocked: adapter returned no user id for provider', account?.provider)
        return false
      }
      return true
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url
      if (url.startsWith('/')) return `${baseUrl}${url}`
      return baseUrl
    },
  },
  pages: {
    signIn: '/',
    error: '/auth/error',
  },
  // IMPORTANT: session strategy must be 'jwt', not 'database'.
  //
  // src/middleware.ts uses next-auth/middleware's withAuth(), which protects
  // /dashboard/* by calling getToken() to decode the session cookie as a JWT.
  // getToken() CANNOT read database-strategy sessions — that cookie is just
  // an opaque lookup key, not a JWT — so it silently returned null, meaning
  // `authorized: ({ token }) => !!token` was always false and the middleware
  // redirected every successfully-authenticated user straight back to the
  // sign-in page before the dashboard ever rendered. That was the actual
  // root cause of "Google login succeeds but Boot still shows Sign in with
  // Google": the user never even reached /dashboard for the connected state
  // to show up.
  //
  // PrismaAdapter still creates/links the User + Account rows (with Google's
  // access_token/refresh_token) on every sign-in regardless of session
  // strategy, so this only changes how the Boot login session itself is
  // stored (a signed JWT cookie instead of a Session row) — not how the
  // Google account is saved. The JWT cookie is still persistent (maxAge
  // below), so it survives page refresh and closing/reopening the browser,
  // and is only cleared by an explicit signOut() (Logout button).
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret,
  debug: process.env.NODE_ENV === 'development',
}
