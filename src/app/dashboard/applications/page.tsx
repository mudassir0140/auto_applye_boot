'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface Application {
  id: string
  status: string
  appliedAt: string
  job: {
    title: string
    company: string
    url: string
  }
}

const STATUS_COLORS = {
  applied: 'bg-blue-100 text-blue-900',
  interview: 'bg-green-100 text-green-900',
  assessment: 'bg-yellow-100 text-yellow-900',
  rejected: 'bg-red-100 text-red-900',
  offer: 'bg-purple-100 text-purple-900',
}

export default function ApplicationsPage() {
  const { data: session } = useSession()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchApplications() {
      try {
        // In a real implementation, fetch from API
        setApplications([])
      } catch (error) {
        console.error('Fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session) {
      fetchApplications()
    }
  }, [session])

  const filteredApplications =
    filter === 'all'
      ? applications
      : applications.filter(app => app.status === filter)

  const statuses = ['all', 'applied', 'interview', 'assessment', 'rejected', 'offer']

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Applications</h1>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {statuses.map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded whitespace-nowrap ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-gray-600">Loading applications...</p>
        ) : filteredApplications.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No applications yet</p>
            <a
              href="/dashboard/jobs"
              className="text-blue-600 hover:underline mt-2 inline-block"
            >
              Find and apply to jobs
            </a>
          </div>
        ) : (
          filteredApplications.map(app => (
            <div key={app.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{app.job.title}</h3>
                  <p className="text-gray-600">{app.job.company}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    STATUS_COLORS[app.status as keyof typeof STATUS_COLORS] || 'bg-gray-100'
                  }`}
                >
                  {app.status}
                </span>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                Applied on {new Date(app.appliedAt).toLocaleDateString()}
              </p>

              <a
                href={app.job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View Job Posting
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
