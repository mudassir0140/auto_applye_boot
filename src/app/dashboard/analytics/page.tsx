'use client'

import Link from 'next/link'
import { useCachedFetch } from '@/hooks/useCachedFetch'

interface Stats {
  totalJobs: number
  appliedJobs: number
  interviews: number
  assessments: number
  rejections: number
  offers: number
  savedJobs: number
}

// Same endpoint (and cache) as the Dashboard, so opening Analytics after it is instant.
export default function AnalyticsPage() {
  const { data, error, loading, reload } = useCachedFetch<{ stats: Stats }>('/api/dashboard/stats')
  const stats = data?.stats

  if (!stats) {
    return loading ? (
      <div className="p-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Analytics</h1>
        <div className="h-64 rounded-lg bg-gray-100 animate-pulse" />
      </div>
    ) : (
      <div className="p-8 max-w-2xl">
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-800">
          {error || 'Could not load analytics.'}{' '}
          <button onClick={reload} className="underline">Try again</button>
        </div>
      </div>
    )
  }

  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
  const responded = stats.interviews + stats.assessments + stats.rejections + stats.offers
  const funnel = [
    { label: 'Jobs tracked', value: stats.totalJobs, color: 'bg-gray-400' },
    { label: 'Saved', value: stats.savedJobs, color: 'bg-blue-300' },
    { label: 'Applied', value: stats.appliedJobs, color: 'bg-blue-500' },
    { label: 'Assessments', value: stats.assessments, color: 'bg-yellow-500' },
    { label: 'Interviews', value: stats.interviews, color: 'bg-green-500' },
    { label: 'Offers', value: stats.offers, color: 'bg-purple-500' },
    { label: 'Rejections', value: stats.rejections, color: 'bg-red-500' },
  ]
  const max = Math.max(1, ...funnel.map((f) => f.value))

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
      <p className="text-gray-600 mb-8">How your job search is going, from your tracked jobs and applications.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Metric label="Response rate" value={`${pct(responded, stats.appliedJobs)}%`} hint={`${responded} of ${stats.appliedJobs} applications`} />
        <Metric label="Interview rate" value={`${pct(stats.interviews, stats.appliedJobs)}%`} hint={`${stats.interviews} interviews`} />
        <Metric label="Applied vs tracked" value={`${pct(stats.appliedJobs, stats.totalJobs)}%`} hint={`${stats.appliedJobs} of ${stats.totalJobs} jobs`} />
      </div>

      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Pipeline</h2>
        {stats.totalJobs === 0 && stats.appliedJobs === 0 ? (
          <p className="text-gray-600">
            Nothing to chart yet.{' '}
            <Link href="/dashboard/jobs" className="text-blue-600 hover:underline">Find jobs →</Link>
          </p>
        ) : (
          <div className="space-y-3">
            {funnel.map((f) => (
              <div key={f.label} className="flex items-center gap-4">
                <span className="w-28 text-sm text-gray-700">{f.label}</span>
                <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                  <div className={`${f.color} h-5`} style={{ width: `${(f.value / max) * 100}%` }} />
                </div>
                <span className="w-10 text-right text-sm font-semibold text-gray-900">{f.value}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{hint}</p>
    </div>
  )
}
