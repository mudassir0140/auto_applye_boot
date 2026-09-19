'use client'

import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    setAuthError(new URLSearchParams(window.location.search).get('error'))
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard')
    }
  }, [status, router])

  if (status === 'loading') {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Job Application AI Agent
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Automate your job search and application process. Find relevant jobs,
            apply automatically, and track your progress all in one place.
          </p>

          {authError && (
            <p className="mb-4 text-red-600" role="alert">
              Google sign-in did not complete ({authError}). Please try again.
            </p>
          )}

          <div className="space-y-4">
            <button
              onClick={() => signIn('google', { callbackUrl: '/dashboard', redirect: true })}
              className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              Sign in with Google
            </button>
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">🔍 Find Jobs</h3>
              <p className="text-gray-600">
                Discover real openings from public job boards that match your CV.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">🤖 Apply Automatically</h3>
              <p className="text-gray-600">
                Send applications from your own Gmail with your CV attached.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">📊 Track Progress</h3>
              <p className="text-gray-600">
                Monitor applications, interviews, and get real-time email updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
