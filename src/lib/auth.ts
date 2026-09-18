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
const callbackUrl = `${baseUrl}/api/auth/callback/google`

// Log configuration with debugging info (but not secrets)
if (process.env.NODE_ENV === 'development') {
  let clientIdDisplay = '❌ NOT SET'
  if (clientId && clientId !== 'your-google-client-id-here') {
    // Show first 8 and last 6 characters only
    clientIdDisplay = `${clientId.slice(0, 8)}...${clientId.slice(-6)}`
  } else if (clientId === 'your-google-client-id-here') {
    clientIdDisplay = '❌ PLACEHOLDER'
  }

  const hasSecret = clientSecret && clientSecret !== 'your-google-client-secret-here'

  console.log('\n========================================')
  console.log('🔐 OAUTH CONFIGURATION DIAGNOSTIC')
  console.log('========================================')
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log(`Environment: ${process.env.NODE_ENV}`)
  console.log('')
  console.log('📋 Loaded Values:')
  console.log(`  NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || '(not set - using default)'}`)
  console.log(`  Base URL: ${baseUrl}`)
  console.log(`  Callback URL: ${callbackUrl}`)
  console.log(`  GOOGLE_CLIENT_ID: ${clientIdDisplay}`)
  console.log(`  GOOGLE_CLIENT_SECRET: ${hasSecret ? '✓ SET' : '❌ NOT SET or PLACEHOLDER'}`)
  console.log(`  NEXTAUTH_SECRET: ${secret ? '✓ SET' : '❌ NOT SET'}`)
  console.log('')
  console.log('📤 OAuth Request Will Send:')
  console.log(`  endpoint: https://accounts.google.com/o/oauth2/v2/auth`)
  console.log(`  client_id: ${clientId ? (clientId !== 'your-google-client-id-here' ? clientIdDisplay : '❌ PLACEHOLDER') : '❌ EMPTY'}`)
  console.log(`  redirect_uri: ${callbackUrl}`)
  console.log(`  scope: openid email profile gmail.readonly gmail.send`)
  console.log('')
  console.log('🔍 Google Cloud Console Must Have:')
  console.log(`  ✓ Authorized JavaScript origins: ${baseUrl}`)
  console.log(`  ✓ Authorized redirect URIs: ${callbackUrl}`)
  console.log(`  ✓ OAuth Client ID: matches the value above`)
  console.log('')

  const issues: string[] = []
  if (!clientId) {
    issues.push('GOOGLE_CLIENT_ID is completely missing from environment')
  } else if (clientId === 'your-google-client-id-here') {
    issues.push('GOOGLE_CLIENT_ID is still using PLACEHOLDER value - this causes 401: invalid_client')
  }
  if (!clientSecret) {
    issues.push('GOOGLE_CLIENT_SECRET is completely missing from environment')
  } else if (clientSecret === 'your-google-client-secret-here') {
    issues.push('GOOGLE_CLIENT_SECRET is still using PLACEHOLDER value')
  }
  if (!secret) {
    issues.push('NEXTAUTH_SECRET is not set')
  }

  if (issues.length > 0) {
    console.error('❌ CONFIGURATION ERRORS:')
    issues.forEach((issue, i) => console.error(`  ${i + 1}. ${issue}`))
    console.error('')
    console.error('💡 TO FIX:')
    console.error('  1. Get real credentials from: https://console.cloud.google.com/apis/credentials')
    console.error('  2. Put them in .env.local (replace placeholder values)')
    console.error('  3. Restart npm run dev')
    console.error('')
  } else {
    console.log('✅ Configuration looks correct!')
    console.log('   If still getting 401 error, verify Google Cloud Console settings.')
  }
  console.log('========================================\n')
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
    async session({ session, user }) {
      if (session?.user) {
        (session.user as any).id = user.id
      }
      return session
    },
    async signIn({ user, account, profile }) {
      return true
    },
    async redirect({ url, baseUrl }) {
      return url.startsWith(baseUrl) ? url : baseUrl
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
  debug: process.env.NODE_ENV === 'development',
}
