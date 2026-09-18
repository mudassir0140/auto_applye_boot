'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface Job {
  id: string
  title: string
  company: string
  location?: string
  url: string
  source: string
  matchScore?: number
  applied: boolean
  foundAt: string
}

export default function JobsPage() {
  const { data: session } = useSession()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [keywords, setKeywords] = useState<string[]>(['React', 'Next.js', 'JavaScript'])
  const [location, setLocation] = useState('')

  async function handleSearch() {
    if (keywords.length === 0) return

    setLoading(true)
    try {
      const response = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, location }),
      })

      if (!response.ok) throw new Error('Search failed')
      const data = await response.json()
      setJobs(data.jobs || [])
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleApply(jobId: string) {
    try {
      const response = await fetch('/api/jobs/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })

      if (!response.ok) throw new Error('Apply failed')

      setJobs(jobs.map(j => j.id === jobId ? { ...j, applied: true } : j))
      alert('Applied successfully!')
    } catch (error) {
      console.error('Apply error:', error)
      alert('Failed to apply')
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Find Jobs</h1>

      {/* Search Form */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-lg font-semibold mb-4">Search for Jobs</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keywords (comma separated)
            </label>
            <input
              type="text"
              value={keywords.join(', ')}
              onChange={(e) => setKeywords(e.target.value.split(',').map(k => k.trim()))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="React, Next.js, JavaScript..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location (optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Remote, San Francisco, etc."
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Searching...' : 'Search Jobs'}
          </button>
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <p className="text-gray-600">No jobs found. Try searching!</p>
        ) : (
          jobs.map(job => (
            <div key={job.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                  <p className="text-gray-600">{job.company}</p>
                  {job.location && <p className="text-sm text-gray-500">📍 {job.location}</p>}
                </div>
                <span className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded">
                  {job.source}
                </span>
              </div>

              {job.matchScore !== undefined && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Match Score</span>
                    <span className="font-semibold">{job.matchScore}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${job.matchScore}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded"
                >
                  View Job
                </a>
                <button
                  onClick={() => handleApply(job.id)}
                  disabled={job.applied}
                  className={`px-4 py-2 rounded ${
                    job.applied
                      ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {job.applied ? '✓ Applied' : 'Apply'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
