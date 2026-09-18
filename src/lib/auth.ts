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

// Log configuration issues in development (but not secrets)
if (process.env.NODE_ENV === 'development') {
  const issues: string[] = []
  if (!clientId || clientId === 'your-google-client-id-here') {
    issues.push('GOOGLE_CLIENT_ID is not configured (still using placeholder)')
  }
  if (!clientSecret || clientSecret === 'your-google-client-secret-here') {
    issues.push('GOOGLE_CLIENT_SECRET is not configured (still using placeholder)')
  }
  if (!secret) {
    issues.push('NEXTAUTH_SECRET is not set')
  }
  if (issues.length > 0) {
    console.warn('⚠️  OAuth Configuration Issues:')
    issues.forEach(issue => console.warn(`  - ${issue}`))
    console.warn('See GOOGLE_OAUTH_SETUP.md or INVALID_CLIENT_TROUBLESHOOTING.md for help')
  }
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
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
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
    async session({ session, user }) {
      if (session?.user) {
        (session.user as any).id = user.id
      }
      return session
    },
    async signIn({ user, account, profile }) {
      return true
    },
  },
  pages: {
    signIn: '/',
    error: '/auth/error',
  },
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: secret,
}
