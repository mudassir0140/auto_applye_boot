'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  if (!session) {
    return null
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-gray-900">JobAI</h1>
          <p className="text-sm text-gray-600">{session.user?.email}</p>
        </div>

        <nav className="p-4 space-y-2">
          <Link
            href="/dashboard"
            className="block px-4 py-2 text-gray-700 hover:bg-blue-50 rounded"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/jobs"
            className="block px-4 py-2 text-gray-700 hover:bg-blue-50 rounded"
          >
            Jobs Found
          </Link>
          <Link
            href="/dashboard/applications"
            className="block px-4 py-2 text-gray-700 hover:bg-blue-50 rounded"
          >
            Applications
          </Link>
          <Link
            href="/dashboard/emails"
            className="block px-4 py-2 text-gray-700 hover:bg-blue-50 rounded"
          >
            Email Updates
          </Link>
          <Link
            href="/dashboard/settings"
            className="block px-4 py-2 text-gray-700 hover:bg-blue-50 rounded"
          >
            Settings
          </Link>
        </nav>

        <div className="absolute bottom-0 left-0 w-64 p-4 border-t">
          <button
            onClick={() => signOut({ redirect: true })}
            className="w-full px-4 py-2 text-red-600 hover:bg-red-50 rounded"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
