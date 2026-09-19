'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface JobEmail {
  id: string
  from: string
  subject: string
  emailType: string
  receivedAt: string
  isRead: boolean
}

const EMAIL_TYPE_COLORS = {
  confirmation: 'bg-blue-100 text-blue-900',
  interview: 'bg-green-100 text-green-900',
  assessment: 'bg-yellow-100 text-yellow-900',
  rejection: 'bg-red-100 text-red-900',
  offer: 'bg-purple-100 text-purple-900',
  recruiter_reply: 'bg-indigo-100 text-indigo-900',
  application_update: 'bg-orange-100 text-orange-900',
  other: 'bg-gray-100 text-gray-900',
}

export default function EmailsPage() {
  const { data: session } = useSession()
  const [emails, setEmails] = useState<JobEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  async function fetchEmails() {
    try {
      const response = await fetch('/api/dashboard/stats')
      if (!response.ok) throw new Error('Failed to fetch emails')
      const data = await response.json()
      setEmails(data.recentEmails || [])
    } catch (error) {
      console.error('Fetch error:', error)
      setEmails([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchEmails()
    }
  }, [session])

  async function syncEmails() {
    setSyncing(true)
    try {
      const response = await fetch('/api/gmail/sync', {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Sync failed')
      const data = await response.json()
      await fetchEmails()
      alert(`Synced ${data.emailsSync || 0} emails`)
    } catch (error) {
      console.error('Sync error:', error)
      alert('Failed to sync emails. Make sure Gmail is connected.')
    } finally {
      setSyncing(false)
    }
  }

  const filteredEmails = emails
    .filter(email => filter === 'all' || email.emailType === filter)
    .filter(email =>
      email.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase())
    )

  const emailTypes = [
    { value: 'all', label: 'All' },
    { value: 'confirmation', label: 'Confirmation' },
    { value: 'interview', label: 'Interview' },
    { value: 'assessment', label: 'Assessment' },
    { value: 'rejection', label: 'Rejection' },
    { value: 'offer', label: 'Offer' },
    { value: 'recruiter_reply', label: 'Recruiter Reply' },
    { value: 'application_update', label: 'Application Update' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job-Related Emails</h1>
            <p className="text-gray-600 mt-1">Track emails about interviews, assessments, and offers</p>
          </div>
          <button
            onClick={syncEmails}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            <span>🔄</span>
            <span>{syncing ? 'Syncing...' : 'Sync Gmail'}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {/* Info Box */}
        <div className="mb-8 bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="text-blue-900 text-sm">
            📧 Job-related emails from recruiters and companies are automatically categorized below. Connect Gmail to enable automatic syncing.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8">
          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search by sender or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {emailTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setFilter(type.value)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition ${
                  filter === type.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Emails Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">From</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <span className="text-gray-600">Loading emails...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredEmails.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <p className="text-gray-600 text-lg mb-4">No job-related emails yet</p>
                      <Link href="/dashboard/settings" className="text-blue-600 hover:underline">
                        Connect Gmail to see emails →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  filteredEmails.map(email => (
                    <tr key={email.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{email.from}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{email.subject}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            EMAIL_TYPE_COLORS[
                              email.emailType as keyof typeof EMAIL_TYPE_COLORS
                            ] || EMAIL_TYPE_COLORS.other
                          }`}
                        >
                          {email.emailType.replace(/_/g, ' ').charAt(0).toUpperCase() + email.emailType.replace(/_/g, ' ').slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(email.receivedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          {!loading && filteredEmails.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
