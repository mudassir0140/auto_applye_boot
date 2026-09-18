'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface DashboardStats {
  totalJobs: number
  appliedJobs: number
  interviews: number
  assessments: number
  rejections: number
  offers: number
  savedJobs: number
  unreadNotifications: number
  gmailConnected: boolean
}

export default function Dashboard() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/dashboard/stats')
        if (!response.ok) throw new Error('Failed to fetch stats')
        const data = await response.json()
        setStats(data.stats)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    if (session) {
      fetchStats()
    }
  }, [session])

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>
  }

  if (!stats) {
    return <div className="p-8">No data available</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Gmail Status */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Gmail Connection</h2>
            <p className={stats.gmailConnected ? 'text-green-600' : 'text-gray-600'}>
              {stats.gmailConnected ? '✓ Connected' : 'Not connected'}
            </p>
          </div>
          {!stats.gmailConnected && (
            <a
              href="/api/auth/signin"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Connect Gmail
            </a>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Jobs Found" value={stats.totalJobs} />
        <StatCard title="Applied" value={stats.appliedJobs} color="blue" />
        <StatCard title="Interviews" value={stats.interviews} color="green" />
        <StatCard title="Assessments" value={stats.assessments} color="yellow" />
        <StatCard title="Rejections" value={stats.rejections} color="red" />
        <StatCard title="Offers" value={stats.offers} color="purple" />
        <StatCard title="Saved" value={stats.savedJobs} color="indigo" />
        <StatCard title="Notifications" value={stats.unreadNotifications} color="orange" />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ActionCard
          title="Find Jobs"
          description="Search for new job opportunities"
          href="/dashboard/search"
          icon="🔍"
        />
        <ActionCard
          title="View Applications"
          description="Track your applications"
          href="/dashboard/applications"
          icon="📋"
        />
        <ActionCard
          title="Email Updates"
          description="Check job-related emails"
          href="/dashboard/emails"
          icon="📧"
        />
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  color = 'gray',
}: {
  title: string
  value: number
  color?: string
}) {
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-900',
    blue: 'bg-blue-100 text-blue-900',
    green: 'bg-green-100 text-green-900',
    red: 'bg-red-100 text-red-900',
    yellow: 'bg-yellow-100 text-yellow-900',
    purple: 'bg-purple-100 text-purple-900',
    indigo: 'bg-indigo-100 text-indigo-900',
    orange: 'bg-orange-100 text-orange-900',
  }

  return (
    <div className={`p-6 rounded-lg shadow ${colorClasses[color as keyof typeof colorClasses]}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  )
}

function ActionCard({
  title,
  description,
  href,
  icon,
}: {
  title: string
  description: string
  href: string
  icon: string
}) {
  return (
    <a
      href={href}
      className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer"
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-gray-600 text-sm mt-1">{description}</p>
    </a>
  )
}
