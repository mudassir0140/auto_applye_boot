'use client'

import { useEffect, useState } from 'react'

interface Profile {
  name: string | null
  cvUrl: string | null
  portfolioUrl: string | null
  cvFile: { fileName: string; size: number } | null
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

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [skills, setSkills] = useState('')
  const [keywords, setKeywords] = useState('')
  const [locations, setLocations] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [autoApply, setAutoApply] = useState(false)
  const [minScore, setMinScore] = useState(60)
  const [dailyLimit, setDailyLimit] = useState(5)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  function apply(p: Profile) {
    setProfile(p)
    setSkills(p.skills.join(', '))
    setKeywords(p.jobKeywords.join(', '))
    setLocations(p.jobLocations.join(', '))
    setPortfolioUrl(p.portfolioUrl || '')
    setAutoApply(p.autoApplyEnabled)
    setMinScore(p.autoApplyMinScore)
    setDailyLimit(p.autoApplyDailyLimit)
  }

  async function load() {
    const res = await fetch('/api/user/profile')
    if (res.ok) apply(await res.json())
  }

  useEffect(() => {
    load()
  }, [])

  async function uploadCv(file: File) {
    setBusy('upload')
    setMessage(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/user/resume', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      await load()
      setMessage({ kind: 'ok', text: `Read ${data.skills.length} skills from ${data.fileName}. Review them below, then confirm.` })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Upload failed' })
    } finally {
      setBusy(null)
    }
  }

  async function parsePortfolio() {
    setBusy('portfolio')
    setMessage(null)
    try {
      const res = await fetch('/api/user/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not read portfolio')
      await load()
      setMessage({ kind: 'ok', text: 'Portfolio read. Review the skills below, then confirm.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Could not read portfolio' })
    } finally {
      setBusy(null)
    }
  }

  async function save(confirm: boolean) {
    setBusy(confirm ? 'confirm' : 'save')
    setMessage(null)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: toList(skills),
          jobKeywords: toList(keywords),
          jobLocations: toList(locations),
          portfolioUrl,
          autoApplyEnabled: autoApply,
          autoApplyMinScore: minScore,
          autoApplyDailyLimit: dailyLimit,
          confirm,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      await load()
      setMessage({ kind: 'ok', text: confirm ? 'Confirmed. Boot will now find and track jobs in the background.' : 'Saved.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Save failed' })
    } finally {
      setBusy(null)
    }
  }

  if (!profile) return <div className="p-8">Loading profile…</div>

  const input = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
      <p className="text-gray-600 mb-8">
        Upload your CV, review what Boot found, and confirm. Nothing is searched or sent until you confirm.
      </p>

      {message && (
        <div className={`mb-6 p-4 rounded-lg text-sm ${message.kind === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <section className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">1. CV / portfolio</h2>
        <label className="block text-sm font-medium text-gray-700 mb-1">CV (PDF, DOCX or TXT, max 4 MB)</label>
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md"
          disabled={busy === 'upload'}
          onChange={(e) => e.target.files?.[0] && uploadCv(e.target.files[0])}
          className="block text-sm"
        />
        {busy === 'upload' && <p className="text-sm text-gray-500 mt-2">Reading your CV…</p>}
        {profile.cvFile && (
          <p className="text-sm text-gray-600 mt-2">
            Stored: {profile.cvFile.fileName} ({Math.round(profile.cvFile.size / 1024)} KB) — attached to application emails.
          </p>
        )}
        <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">Portfolio URL</label>
        <div className="flex gap-3">
          <input type="url" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} className={input} placeholder="https://…" />
          <button
            onClick={parsePortfolio}
            disabled={!portfolioUrl || busy === 'portfolio'}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
          >
            {busy === 'portfolio' ? 'Reading…' : 'Read portfolio'}
          </button>
        </div>
      </section>

      <section className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">2. Skills &amp; preferences</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma separated)</label>
            <textarea value={skills} onChange={(e) => setSkills(e.target.value)} rows={3} className={input} />
          </div>
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
        <h2 className="text-xl font-semibold mb-4">3. Automatic applications (optional)</h2>
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
