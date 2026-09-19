'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const errorMessages: Record<string, { title: string; description: string }> = {
    'AccessDenied': {
      title: 'Access Denied',
      description: 'You denied access to your Google account. Please try again and grant the necessary permissions.',
    },
    'OAuthSignin': {
      title: 'OAuth Sign-in Error',
      description: 'Could not sign in with Google. Check that your Google OAuth credentials are correctly configured.',
    },
    'OAuthCallback': {
      title: 'OAuth Callback Error',
      description: 'Error during OAuth callback. Make sure the redirect URI is configured correctly in Google Cloud Console.',
    },
    'EmailCreateAccount': {
      title: 'Account Creation Error',
      description: 'Could not create account with this email. Try a different email or contact support.',
    },
    'Callback': {
      title: 'Callback Error',
      description: 'Google approved the login but Boot could not save it. This is almost always the database: check DATABASE_URL in .env.local is a MongoDB Atlas URL (mongodb+srv://…) and the server terminal for [next-auth][error][adapter_error].',
    },
    'CredentialsSignin': {
      title: 'Sign-in Error',
      description: 'Invalid credentials. Please try again.',
    },
    'SessionCallback': {
      title: 'Session Error',
      description: 'Could not create a session. Please try signing in again.',
    },
    'default': {
      title: 'Authentication Failed',
      description: 'An unexpected error occurred during authentication.',
    },
  }

  const message = errorMessages[error || ''] || errorMessages.default

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
      <div className="text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{message.title}</h1>
        <p className="text-gray-600 mb-4">{message.description}</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-6">
            <p className="text-sm text-red-800 font-mono">Error: {error}</p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Common causes:
            <ul className="text-left mt-2 space-y-1 text-xs text-gray-600">
              <li>• Invalid Google Client ID/Secret</li>
              <li>• Redirect URI not configured in Google Cloud Console</li>
              <li>• OAuth consent screen not properly configured</li>
              <li>• Test user not added to OAuth app</li>
            </ul>
          </p>
        </div>

        <div className="mt-8 space-y-2">
          <Link href="/" className="block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
            Try Again
          </Link>
          <Link href="/" className="block text-blue-600 hover:underline">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AuthError() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-center text-gray-600">Loading...</div>}>
        <AuthErrorContent />
      </Suspense>
    </div>
  )
}
