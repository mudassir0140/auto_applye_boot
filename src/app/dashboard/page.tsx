'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useGmailConnection } from '@/hooks/useGmailConnection'

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
  last24Hours?: {
    applicationsSubmitted: number
    jobsFound: number
    emailsReceived: number
    interviewInvites: number
    assessments: number
    rejections: number
    uniqueCompanies: number
  }
}

interface RecentApplication {
  id: string
  status: string
  appliedAt: string
  job: {
    title: string
    company: string
    url: string
  }
}

interface RecentEmail {
  id: string
  from: string
  subject: string
  emailType: string
  receivedAt: string
}

interface UserProfile {
  email: string
  name: string | null
  cvUrl: string | null
  portfolioUrl: string | null
  gmailEmail: string | null
  skills: string[]
  preferredRoles: string[]
}

interface ApplicationHistory {
  id: string
  company: string
  jobTitle: string
  appliedAt: Date
  status: string | null
  method: string
}

export default function Dashboard() {
  const { data: session } = useSession()
  const gmailStatus = useGmailConnection()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentApplications, setRecentApplications] = useState<RecentApplication[]>([])
  const [recentEmails, setRecentEmails] = useState<RecentEmail[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [applicationHistory, setApplicationHistory] = useState<ApplicationHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const response = await fetch('/api/dashboard/stats', {
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) throw new Error('Failed to fetch dashboard data')
        const data = await response.json()

        setStats(data.stats)
        setRecentApplications(data.recentApplications || [])
        setRecentEmails(data.recentEmails || [])
        setUserProfile(data.user)
        setApplicationHistory(data.applicationHistory || [])
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMsg)
        setStats({
          totalJobs: 0,
          appliedJobs: 0,
          interviews: 0,
          assessments: 0,
          rejections: 0,
          offers: 0,
          savedJobs: 0,
          unreadNotifications: 0,
          gmailConnected: false,
          last24Hours: {
            applicationsSubmitted: 0,
            jobsFound: 0,
            emailsReceived: 0,
            interviewInvites: 0,
            assessments: 0,
            rejections: 0,
            uniqueCompanies: 0,
          },
        })
      } finally {
        setLoading(false)
      }
    }

    if (session) {
      fetchDashboardData()
    }
  }, [session])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return <div className="p-8">No data available</div>
  }

  const handleGmailConnect = () => {
    window.location.href = '/api/auth/signin'
  }

  const handleGmailDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect Gmail?')) {
      try {
        const response = await fetch('/api/gmail/disconnect', {
          method: 'POST',
        })
        if (response.ok) {
          await gmailStatus.refetch()
          alert('Gmail account disconnected')
        } else {
          alert('Failed to disconnect Gmail')
        }
      } catch (error) {
        console.error('Disconnect error:', error)
        alert('Error disconnecting Gmail')
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back, <span className="font-semibold">{session?.user?.name || 'User'}</span>! 👋
            </p>
          </div>

          {/* Gmail Connection Status */}
          <div className="flex items-center gap-4">
            {gmailStatus.connected ? (
              <div className="flex items-center gap-3 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
                <span className="text-lg">✅</span>
                <div className="text-sm">
                  <p className="font-medium text-green-900">Gmail Connected</p>
                  <p className="text-green-700 text-xs">{gmailStatus.email}</p>
                </div>
                <button
                  onClick={handleGmailDisconnect}
                  className="ml-2 text-xs px-2 py-1 text-red-600 hover:bg-red-100 rounded transition"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleGmailConnect}
                disabled={gmailStatus.loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                <span>📧</span>
                <span>{gmailStatus.loading ? 'Checking...' : 'Connect Gmail'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {error && (
            <div className="mb-8 bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-yellow-800"><strong>⚠️ Warning:</strong> {error}</p>
              <p className="text-yellow-700 text-sm mt-1">Dashboard is showing default values.</p>
            </div>
          )}

          {/* 24-Hour Activity Stats */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Last 24 Hours Activity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon="📝"
                title="Applications"
                value={stats.last24Hours?.applicationsSubmitted || 0}
                color="blue"
              />
              <StatCard
                icon="💼"
                title="Jobs Found"
                value={stats.last24Hours?.jobsFound || 0}
                color="green"
              />
              <StatCard
                icon="📧"
                title="Emails Received"
                value={stats.last24Hours?.emailsReceived || 0}
                color="purple"
              />
              <StatCard
                icon="🎯"
                title="Interviews"
                value={stats.last24Hours?.interviewInvites || 0}
                color="orange"
              />
              <StatCard
                icon="✅"
                title="Assessments"
                value={stats.last24Hours?.assessments || 0}
                color="yellow"
              />
              <StatCard
                icon="💬"
                title="Replies"
                value={stats.last24Hours?.emailsReceived || 0}
                color="indigo"
              />
              <StatCard
                icon="❌"
                title="Rejections"
                value={stats.last24Hours?.rejections || 0}
                color="red"
              />
              <StatCard
                icon="⏳"
                title="Pending"
                value={stats.appliedJobs - stats.interviews - stats.rejections - stats.offers}
                color="gray"
              />
            </div>
          </div>

          {/* Overall Stats */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Overall Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <InfoCard label="Total Jobs" value={stats.totalJobs} />
              <InfoCard label="Applied" value={stats.appliedJobs} />
              <InfoCard label="Interviews" value={stats.interviews} />
              <InfoCard label="Offers" value={stats.offers} />
            </div>
          </div>

          {/* Application Activity */}
          <div className="mb-8 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Recent Applications</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Job Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Applied Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentApplications.length > 0 ? (
                    recentApplications.map((app) => (
                      <tr key={app.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{app.job.company}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <a href={app.job.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {app.job.title}
                          </a>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(app.appliedAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        No applications yet. <Link href="/dashboard/jobs" className="text-blue-600 hover:underline">Find jobs →</Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {recentApplications.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 text-right">
                <Link href="/dashboard/applications" className="text-blue-600 hover:underline text-sm font-medium">
                  View all applications →
                </Link>
              </div>
            )}
          </div>

          {/* Email Activity */}
          <div className="mb-8 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Job-Related Emails</h2>
            </div>
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
                  {recentEmails.length > 0 ? (
                    recentEmails.map((email) => (
                      <tr key={email.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm text-gray-900">{email.from}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{email.subject}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEmailTypeColor(email.emailType)}`}>
                            {email.emailType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(email.receivedAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        {stats.gmailConnected
                          ? 'No job-related emails yet'
                          : 'Connect Gmail to see job-related emails'
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {recentEmails.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 text-right">
                <Link href="/dashboard/emails" className="text-blue-600 hover:underline text-sm font-medium">
                  View all emails →
                </Link>
              </div>
            )}
          </div>

          {/* Profile Card */}
          {userProfile && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Your Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="mb-6">
                    <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">Name</p>
                    <p className="text-lg font-medium text-gray-900 mt-1">{userProfile.name || 'Not set'}</p>
                  </div>
                  <div className="mb-6">
                    <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">Email</p>
                    <p className="text-lg font-medium text-gray-900 mt-1">{userProfile.email}</p>
                  </div>
                  <div className="mb-6">
                    <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">Preferred Roles</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {userProfile.preferredRoles && userProfile.preferredRoles.length > 0 ? (
                        userProfile.preferredRoles.map((role, i) => (
                          <span key={i} className="px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm">
                            {role}
                          </span>
                        ))
                      ) : (
                        <p className="text-gray-600 text-sm">Not set</p>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="mb-6">
                    <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">Skills</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {userProfile.skills && userProfile.skills.length > 0 ? (
                        userProfile.skills.slice(0, 8).map((skill, i) => (
                          <span key={i} className="px-3 py-1 bg-green-100 text-green-900 rounded-full text-sm">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <p className="text-gray-600 text-sm">Not set</p>
                      )}
                    </div>
                    {userProfile.skills && userProfile.skills.length > 8 && (
                      <p className="text-xs text-gray-500 mt-2">+{userProfile.skills.length - 8} more</p>
                    )}
                  </div>
                  <div className="mb-6">
                    <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">Resume / Portfolio</p>
                    <div className="flex gap-2 mt-2">
                      {userProfile.cvUrl && (
                        <a href={userProfile.cvUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                          📄 View Resume
                        </a>
                      )}
                      {userProfile.portfolioUrl && (
                        <a href={userProfile.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                          🌐 View Portfolio
                        </a>
                      )}
                      {!userProfile.cvUrl && !userProfile.portfolioUrl && (
                        <p className="text-gray-600 text-sm">Not added yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Link href="/dashboard/settings" className="text-blue-600 hover:underline text-sm font-medium">
                  Edit Profile Settings →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  title,
  value,
  color,
}: {
  icon: string
  title: string
  value: number
  color: string
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    purple: 'bg-purple-50 border-purple-200',
    indigo: 'bg-indigo-50 border-indigo-200',
    orange: 'bg-orange-50 border-orange-200',
    gray: 'bg-gray-50 border-gray-200',
  }

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  )
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    applied: 'bg-blue-100 text-blue-800',
    interview: 'bg-green-100 text-green-800',
    assessment: 'bg-yellow-100 text-yellow-800',
    rejected: 'bg-red-100 text-red-800',
    offer: 'bg-purple-100 text-purple-800',
  }
  return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-800'
}

function getEmailTypeColor(type: string): string {
  const colors: Record<string, string> = {
    confirmation: 'bg-blue-100 text-blue-800',
    interview: 'bg-green-100 text-green-800',
    assessment: 'bg-yellow-100 text-yellow-800',
    rejection: 'bg-red-100 text-red-800',
    offer: 'bg-purple-100 text-purple-800',
    recruiter_reply: 'bg-indigo-100 text-indigo-800',
    application_update: 'bg-orange-100 text-orange-800',
    other: 'bg-gray-100 text-gray-800',
  }
  return colors[type.toLowerCase()] || 'bg-gray-100 text-gray-800'
}
