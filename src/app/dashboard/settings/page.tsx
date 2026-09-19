'use client'

import { useEffect, useState } from 'react'
import { useSession, signIn } from 'next-auth/react'

interface UserSettings {
  email: string
  name?: string
  cvUrl?: string
  portfolioUrl?: string
  gmailConnected: boolean
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [gmailConnecting, setGmailConnecting] = useState(false)
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false)

  useEffect(() => {
    async function fetchSettings() {
      try {
        // Pick up any changes from a just-completed OAuth redirect
        await updateSession()

        const response = await fetch('/api/dashboard/stats')
        if (!response.ok) throw new Error('Failed to fetch settings')
        const data = await response.json()
        setSettings({
          email: data.user.email,
          name: data.user.name,
          cvUrl: data.user.cvUrl,
          portfolioUrl: data.user.portfolioUrl,
          gmailConnected: data.stats.gmailConnected,
        })
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session) {
      fetchSettings()
    }
  }, [session, updateSession])

  async function handleConnectGmail() {
    setGmailConnecting(true)
    try {
      // Redirect to OAuth sign-in flow
      // This will authenticate with Google and link the account
      await signIn('google', {
        callbackUrl: '/dashboard/settings',
        redirect: true,
      })
    } catch (error) {
      console.error('Gmail connection error:', error)
      alert('Failed to connect Gmail')
      setGmailConnecting(false)
    }
  }

  async function handleDisconnectGmail() {
    if (!confirm('Are you sure you want to disconnect Gmail? You can reconnect with a different account anytime.')) return

    setGmailDisconnecting(true)
    try {
      const response = await fetch('/api/gmail/status', {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to disconnect')

      // Refresh settings after disconnecting
      if (settings) {
        setSettings({ ...settings, gmailConnected: false })
      }
      alert('Gmail disconnected successfully. You can connect a different account anytime.')
    } catch (error) {
      console.error('Disconnect error:', error)
      alert('Failed to disconnect Gmail')
    } finally {
      setGmailDisconnecting(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading settings...</div>
  }

  if (!settings) {
    return <div className="p-8">Failed to load settings</div>
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      {/* Account Information */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>

        {session?.user?.image && (
          <div className="flex items-center gap-4 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={session.user.image}
              alt={session.user.name || 'Profile picture'}
              className="w-16 h-16 rounded-full"
              referrerPolicy="no-referrer"
            />
            <div>
              <p className="font-medium text-gray-900">{session.user.name}</p>
              <p className="text-sm text-gray-600">{session.user.email}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={settings.email}
              disabled
              className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={settings.name || ''}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CV URL / Resume Link
            </label>
            <input
              type="url"
              value={settings.cvUrl || ''}
              onChange={(e) => setSettings({ ...settings, cvUrl: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
            <p className="text-sm text-gray-600 mt-1">Link to your CV or resume</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Portfolio URL
            </label>
            <input
              type="url"
              value={settings.portfolioUrl || ''}
              onChange={(e) => setSettings({ ...settings, portfolioUrl: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
            <p className="text-sm text-gray-600 mt-1">Link to your portfolio or GitHub</p>
          </div>
        </div>
      </div>

      {/* Gmail Connection */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Gmail Integration</h2>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
          <div>
            <p className="font-medium text-gray-900">Gmail Status</p>
            <p className={settings.gmailConnected ? 'text-green-600' : 'text-gray-600'}>
              {settings.gmailConnected
                ? `✓ Google Connected: ${settings.email}`
                : '✗ Not connected'}
            </p>
          </div>
        </div>

        <p className="text-gray-600 text-sm mb-4">
          Connect your Gmail account to automatically receive job-related email notifications,
          including interview invitations, assessments, and offer letters.
        </p>

        <div className="flex gap-4">
          {settings.gmailConnected ? (
            <button
              onClick={handleDisconnectGmail}
              disabled={gmailDisconnecting}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
            >
              {gmailDisconnecting ? 'Disconnecting...' : 'Disconnect Google'}
            </button>
          ) : (
            <button
              onClick={handleConnectGmail}
              disabled={gmailConnecting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {gmailConnecting ? 'Connecting...' : 'Sign in with Google'}
            </button>
          )}
        </div>

        {settings.gmailConnected && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              ℹ️ Your Gmail account is securely connected using OAuth 2.0. We only read emails
              related to job applications and never store your passwords or sensitive tokens.
            </p>
          </div>
        )}
      </div>

      {/* Search Preferences */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Search Preferences</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Keywords
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="React, Next.js, JavaScript, TypeScript"
            />
            <p className="text-sm text-gray-600 mt-1">Comma-separated list of job keywords</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Locations
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Remote, San Francisco, New York"
            />
            <p className="text-sm text-gray-600 mt-1">Comma-separated list of preferred locations</p>
          </div>
        </div>
      </div>
    </div>
  )
}
