'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

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
  other: 'bg-gray-100 text-gray-900',
}

export default function EmailsPage() {
  const { data: session } = useSession()
  const [emails, setEmails] = useState<JobEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  async function syncEmails() {
    setSyncing(true)
    try {
      const response = await fetch('/api/gmail/sync', {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Sync failed')
      const data = await response.json()
      setEmails(data.emails || [])
      alert(`Synced ${data.emailsSync} emails`)
    } catch (error) {
      console.error('Sync error:', error)
      alert('Failed to sync emails. Make sure Gmail is connected.')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (session) {
      // Initial load can be added here
    }
  }, [session])

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Job-Related Emails</h1>
        <button
          onClick={syncEmails}
          disabled={syncing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {syncing ? 'Syncing...' : 'Sync Gmail'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-8">
        <p className="text-blue-900">
          ℹ️ Connect your Gmail account in Settings to automatically sync job-related emails
          and get real-time updates about interviews, assessments, and offers.
        </p>
      </div>

      {/* Emails List */}
      <div className="space-y-4">
        {emails.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No emails yet</p>
            <p className="text-gray-500 mt-2">Connect Gmail and sync to see job-related emails</p>
          </div>
        ) : (
          emails.map(email => (
            <div key={email.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{email.subject}</h3>
                  <p className="text-gray-600">{email.from}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded text-sm font-medium whitespace-nowrap ml-4 ${
                    EMAIL_TYPE_COLORS[
                      email.emailType as keyof typeof EMAIL_TYPE_COLORS
                    ] || EMAIL_TYPE_COLORS.other
                  }`}
                >
                  {email.emailType}
                </span>
              </div>

              <p className="text-sm text-gray-500">
                {new Date(email.receivedAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
