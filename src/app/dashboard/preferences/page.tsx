'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCachedFetch } from '@/hooks/useCachedFetch'

interface Profile {
  skills: string[]
  jobKeywords: string[]
  jobLocations: string[]
  preferencesConfirmedAt: string | null
  autoApplyEnabled: boolean
  autoApplyMinScore: number
  autoApplyDailyLimit: number
  gmailConnected: boolean
}

const toList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

export default function JobPreferencesPage() {
  const { data: profile, error: loadError, loading, reload } = useCachedFetch<Profile>('/api/user/profile')
  const [keywords, setKeywords] = useState('')
  const [locations, setLocations] = useState('')
  const [autoApply, setAutoApply] = useState(false)
  const [minScore, setMinScore] = useState(60)
  const [dailyLimit, setDailyLimit] = useState(5)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  // Fill the form once, when the profile first arrives (instantly on a revisit,
  // from the cache), so a background refresh never overwrites what is being typed.
  const [filled, setFilled] = useState(false)
  useEffect(() => {
    if (!profile || filled) return
    setFilled(true)
    setKeywords(profile.jobKeywords.join(', '))
    setLocations(profile.jobLocations.join(', '))
    setAutoApply(profile.autoApplyEnabled)
    setMinScore(profile.autoApplyMinScore)
    setDailyLimit(profile.autoApplyDailyLimit)
  }, [profile, filled])

  async function save(confirm: boolean) {
    setBusy(confirm ? 'confirm' : 'save')
    setMessage(null)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobKeywords: toList(keywords),
          jobLocations: toList(locations),
          autoApplyEnabled: autoApply,
          autoApplyMinScore: minScore,
          autoApplyDailyLimit: dailyLimit,
          confirm,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      await reload()
      setMessage({ kind: 'ok', text: confirm ? 'Confirmed. Boot will now find and track jobs in the background.' : 'Saved.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Save failed' })
    } finally {
      setBusy(null)
    }
  }

  if (!profile) {
    return loading ? (
      <div className="p-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Job Preferences</h1>
        <div className="h-48 rounded-lg bg-gray-100 animate-pulse mb-6" />
        <div className="h-40 rounded-lg bg-gray-100 animate-pulse" />
      </div>
    ) : (
      <div className="p-8 max-w-2xl">
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-800">
          {loadError || 'Could not load your preferences.'}{' '}
          <button onClick={reload} className="underline">Try again</button>
        </div>
      </div>
    )
  }

  const input = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Preferences</h1>
      <p className="text-gray-600 mb-8">
        Choose what to search for. Nothing is searched or sent until you confirm. Skills come from your{' '}
        <Link href="/dashboard/profile" className="text-blue-600 underline">Profile / Resume</Link> ({profile.skills.length} saved).
      </p>

      {message && (
        <div className={`mb-6 p-4 rounded-lg text-sm ${message.kind === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <section className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Search</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job keywords / roles to search</label>
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={input} placeholder="react developer, frontend" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred locations</label>
            <input value={locations} onChange={(e) => setLocations(e.target.value)} className={input} placeholder="Remote" />
          </div>
        </div>
      </section>

      <section className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Automatic applications (optional)</h2>
        <label className="flex items-center gap-3 mb-4">
          <input type="checkbox" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} />
          <span>Email applications from my Gmail for strong matches that list an application email</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Minimum match %</label>
            <input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className={input} />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Max per day</label>
            <input type="number" min={1} max={25} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} className={input} />
          </div>
        </div>
        {autoApply && !profile.gmailConnected && (
          <p className="text-sm text-amber-700 mt-3">Gmail is not connected — sign in with Google again for this to work.</p>
        )}
        <p className="text-sm text-gray-500 mt-3">The same company/job/recipient is never emailed twice within 7 days.</p>
      </section>

      <div className="flex gap-3 items-center">
        <button onClick={() => save(true)} disabled={busy !== null} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
          {busy === 'confirm' ? 'Confirming…' : profile.preferencesConfirmedAt ? 'Save & re-confirm' : 'Confirm & start'}
        </button>
        <button onClick={() => save(false)} disabled={busy !== null} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          Save draft
        </button>
        {profile.preferencesConfirmedAt && (
          <span className="text-sm text-green-700">✓ Confirmed {new Date(profile.preferencesConfirmedAt).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  )
}
