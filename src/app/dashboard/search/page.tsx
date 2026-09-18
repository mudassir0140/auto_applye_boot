'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function SearchPage() {
  const { data: session } = useSession()
  const [keywords, setKeywords] = useState('React, Next.js, TypeScript')
  const [location, setLocation] = useState('Remote')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [applied, setApplied] = useState<Set<string>>(new Set())

  async function handleSearch() {
    if (!keywords.trim()) {
      alert('Please enter at least one keyword')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywords.split(',').map(k => k.trim()),
          location: location.trim() || undefined,
        }),
      })

      if (!response.ok) throw new Error('Search failed')
      const data = await response.json()
      setResults(data.jobs || [])
    } catch (error) {
      console.error('Search error:', error)
      alert('Failed to search jobs')
    } finally {
      setLoading(false)
    }
  }

  async function handleApply(jobId: string, jobUrl: string) {
    try {
      const response = await fetch('/api/jobs/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })

      if (!response.ok) throw new Error('Apply failed')

      const data = await response.json()
      setApplied(new Set([...applied, jobId]))

      if (data.requiresManualApproval) {
        alert(`Apply approved! Opening job page...\n${data.reason}`)
        window.open(jobUrl, '_blank')
      } else {
        alert('Application submitted successfully!')
      }
    } catch (error) {
      console.error('Apply error:', error)
      alert('Failed to apply. Please try again.')
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Search & Apply</h1>

      {/* Search Form */}
      <div className="bg-white p-8 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Find Your Next Job</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Job Keywords
            </label>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              placeholder="React, Next.js, TypeScript&#10;(comma-separated)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter keywords separated by commas
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Location (Optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="Remote, San Francisco, etc."
            />

            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {loading ? 'Searching...' : 'Search Jobs'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Found {results.length} Jobs
          </h2>

          <div className="space-y-4">
            {results.map((job) => (
              <div key={job.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 hover:text-blue-600">
                      {job.title}
                    </h3>
                    <p className="text-gray-600 font-medium">{job.company}</p>
                    {job.location && (
                      <p className="text-sm text-gray-500">📍 {job.location}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-gray-200 text-gray-800 text-xs font-semibold rounded-full">
                      {job.source}
                    </span>
                  </div>
                </div>

                {job.matchScore !== undefined && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 font-medium">Match Score</span>
                      <span className="font-bold">{Math.round(job.matchScore)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          job.matchScore >= 75
                            ? 'bg-green-500'
                            : job.matchScore >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${job.matchScore}%` }}
                      />
                    </div>
                  </div>
                )}

                {job.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {job.description}
                  </p>
                )}

                <div className="flex gap-3 pt-4 border-t">
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded font-medium transition"
                  >
                    View Full Job
                  </a>
                  <button
                    onClick={() => handleApply(job.id, job.url)}
                    disabled={applied.has(job.id) || job.applied}
                    className={`px-6 py-2 rounded font-medium transition ${
                      applied.has(job.id) || job.applied
                        ? 'bg-green-100 text-green-800 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {applied.has(job.id) || job.applied ? '✓ Applied' : '✉ Apply Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">
            No results yet. Try searching for jobs!
          </p>
        </div>
      )}
    </div>
  )
}
