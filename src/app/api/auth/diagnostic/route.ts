import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Only available in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const nextauthUrl = process.env.NEXTAUTH_URL
  const nextauthSecret = process.env.NEXTAUTH_SECRET

  // Format Client ID: show first 8 and last 6 chars only
  let clientIdDisplay = '❌ NOT SET'
  if (clientId && clientId !== 'your-google-client-id-here') {
    clientIdDisplay = `${clientId.slice(0, 8)}...${clientId.slice(-6)}`
  } else if (clientId === 'your-google-client-id-here') {
    clientIdDisplay = '❌ PLACEHOLDER VALUE'
  }

  // Format Secret: just show if set or not
  let secretDisplay = process.env.GOOGLE_CLIENT_SECRET ? '✓ SET' : '❌ NOT SET'
  if (process.env.GOOGLE_CLIENT_SECRET === 'your-google-client-secret-here') {
    secretDisplay = '❌ PLACEHOLDER VALUE'
  }

  const callbackUrl = `${nextauthUrl || 'http://localhost:3000'}/api/auth/callback/google`

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    configuration: {
      NEXTAUTH_URL: nextauthUrl || 'NOT SET (using default)',
      NEXTAUTH_SECRET: nextauthSecret ? '✓ SET' : '❌ NOT SET',
      GOOGLE_CLIENT_ID: clientIdDisplay,
      GOOGLE_CLIENT_SECRET: secretDisplay,
    },
    computed: {
      base_url: nextauthUrl || 'http://localhost:3000',
      callback_url: callbackUrl,
    },
    oauth_request: {
      endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      parameters: {
        client_id: clientId && clientId !== 'your-google-client-id-here'
          ? `${clientId.slice(0, 8)}...${clientId.slice(-6)}`
          : clientId,
        redirect_uri: callbackUrl,
        scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
        response_type: 'code',
        prompt: 'consent',
        access_type: 'offline',
      },
    },
    google_cloud_console_check: {
      authorized_redirect_uris_must_include: callbackUrl,
      authorized_javascript_origins_must_include: nextauthUrl || 'http://localhost:3000',
      client_id_must_match: clientId ? (clientId !== 'your-google-client-id-here' ? 'check console' : 'USING PLACEHOLDER') : 'NOT SET',
    },
    issues: validateConfiguration(clientId, clientSecret, nextauthUrl),
  }

  return NextResponse.json(diagnostics, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function validateConfiguration(
  clientId: string | undefined,
  clientSecret: string | undefined,
  nextauthUrl: string | undefined
): string[] {
  const issues: string[] = []

  if (!clientId) {
    issues.push('GOOGLE_CLIENT_ID not set in environment')
  } else if (clientId === 'your-google-client-id-here') {
    issues.push('GOOGLE_CLIENT_ID is using placeholder value - need real value from Google Cloud Console')
  }

  if (!clientSecret) {
    issues.push('GOOGLE_CLIENT_SECRET not set in environment')
  } else if (clientSecret === 'your-google-client-secret-here') {
    issues.push('GOOGLE_CLIENT_SECRET is using placeholder value - need real value from Google Cloud Console')
  }

  if (!nextauthUrl) {
    issues.push('NEXTAUTH_URL not set - using default http://localhost:3000')
  }

  if (issues.length === 0) {
    issues.push('Configuration looks OK - check Google Cloud Console settings if still getting 401 error')
  }

  return issues
}
