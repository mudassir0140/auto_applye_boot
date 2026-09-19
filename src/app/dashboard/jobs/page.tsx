'use client'

import { useEffect, useState } from 'react'

interface Job {
  id: string
  title: string
  company: string
  location?: string | null
  url: string
  applyEmail?: string | null
  source: string
  matchScore?: number | null
  applied: boolean
  status: string
  foundAt: string
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [keywords, setKeywords] = useState('')
  const [location, setLocation] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function load() {
    try {
      const [jobsRes, profileRes] = await Promise.all([fetch('/api/jobs'), fetch('/api/user/profile')])
      if (jobsRes.ok) setJobs((await jobsRes.json()).jobs || [])
      if (profileRes.ok) {
        const profile = await profileRes.json()
        setKeywords((profile.jobKeywords || []).join(', '))
        setLocation((profile.jobLocations || [])[0] || '')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSearch() {
    setSearching(true)
    setMessage(null)
    try {
      const response = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean), location: location.trim() || undefined }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Search failed')
      setJobs(data.jobs || [])
      setMessage({ kind: 'ok', text: `Found ${data.found} postings, ${data.added} new.` })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Search failed' })
    } finally {
      setSearching(false)
    }
  }

  async function handleApply(job: Job, method: 'email' | 'manual') {
    setBusyId(job.id)
    setMessage(null)
    try {
      const response = await fetch('/api/jobs/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, method }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Apply failed')
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, applied: true, status: 'applied' } : j)))
      setMessage({ kind: 'ok', text: method === 'email' ? `Application emailed to ${data.sentTo} from your Gmail.` : 'Marked as applied.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Apply failed' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleStatus(jobId: string, status: 'saved' | 'skipped' | 'new') {
    const response = await fetch('/api/jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, status }),
    })
    if (response.ok) setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)))
  }

  const visible = jobs.filter((j) => j.status !== 'skipped')

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Jobs</h1>

      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma separated)</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="react, node.js, frontend developer"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Remote"
            />
          </div>
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || !keywords.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {searching ? 'Searching…' : 'Find jobs'}
        </button>
        {message && (
          <p className={`mt-4 text-sm ${message.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>
        )}
      </div>

      {loading ? (
        <p className="text-gray-600">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-600">No tracked jobs yet. Confirm your profile keywords, then search.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((job) => (
            <div key={job.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                  <p className="text-gray-600">{job.company}</p>
                  {job.location && <p className="text-sm text-gray-500">📍 {job.location}</p>}
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded">{job.source}</span>
                  {job.matchScore != null && <p className="text-sm font-semibold mt-2">{job.matchScore}% match</p>}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <a href={job.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded">
                  View posting
                </a>
                {job.applied ? (
                  <span className="px-4 py-2 bg-gray-200 text-gray-600 rounded">✓ Applied</span>
                ) : (
                  <>
                    {job.applyEmail ? (
                      <button
                        onClick={() => handleApply(job, 'email')}
                        disabled={busyId === job.id}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                        title={`Sends from your Gmail to ${job.applyEmail}`}
                      >
                        {busyId === job.id ? 'Sending…' : `Email application`}
                      </button>
                    ) : (
                      <span className="text-sm text-gray-500">No application email in posting</span>
                    )}
                    <button
                      onClick={() => handleApply(job, 'manual')}
                      disabled={busyId === job.id}
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      I applied on their site
                    </button>
                    <button
                      onClick={() => handleStatus(job.id, job.status === 'saved' ? 'new' : 'saved')}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                    >
                      {job.status === 'saved' ? '★ Saved' : '☆ Save'}
                    </button>
                    <button onClick={() => handleStatus(job.id, 'skipped')} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">
                      Skip
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
