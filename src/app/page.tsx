'use client'

import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

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

          <div className="space-y-4">
            <button
              onClick={() => signIn('google', { redirect: false })}
              className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              Sign in with Google
            </button>

            <p className="text-gray-600">
              New here?{' '}
              <Link href="/auth/signup" className="text-blue-600 hover:underline">
                Create an account
              </Link>
            </p>
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">🔍 Find Jobs</h3>
              <p className="text-gray-600">
                Discover relevant positions from LinkedIn, Google Jobs, and more.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">🤖 Apply Automatically</h3>
              <p className="text-gray-600">
                Apply to suitable jobs automatically using your CV and portfolio.
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
