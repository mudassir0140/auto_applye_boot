'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCachedFetch } from '@/hooks/useCachedFetch'

interface Profile {
  cvFile: { fileName: string; size: number } | null
  portfolioUrl: string | null
  skills: string[]
}

const toList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

export default function ProfilePage() {
  const { data: profile, error: loadError, loading, reload } = useCachedFetch<Profile>('/api/user/profile')
  const [skills, setSkills] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  // Re-fill the form only when the stored values actually change (first load, or a
  // CV/portfolio read), never on a plain background refresh that would drop typing.
  const skillsKey = profile?.skills.join('\u0000')
  useEffect(() => {
    if (profile) setSkills(profile.skills.join(', '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillsKey])
  useEffect(() => {
    if (profile) setPortfolioUrl(profile.portfolioUrl || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.portfolioUrl])

  async function uploadCv(file: File) {
    setBusy('upload')
    setMessage(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/user/resume', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      await reload()
      setMessage({ kind: 'ok', text: `Read ${data.skills.length} skills from ${data.fileName}. Review them below, then confirm on Job Preferences.` })
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
      await reload()
      setMessage({ kind: 'ok', text: 'Portfolio read. Review the skills below.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Could not read portfolio' })
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    setBusy('save')
    setMessage(null)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: toList(skills), portfolioUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      await reload()
      setMessage({ kind: 'ok', text: 'Saved.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Save failed' })
    } finally {
      setBusy(null)
    }
  }

  if (!profile) {
    return loading ? (
      <div className="p-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile / Resume</h1>
        <div className="h-48 rounded-lg bg-gray-100 animate-pulse mb-6" />
        <div className="h-40 rounded-lg bg-gray-100 animate-pulse" />
      </div>
    ) : (
      <div className="p-8 max-w-2xl">
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-800">
          {loadError || 'Could not load your profile.'}{' '}
          <button onClick={reload} className="underline">Try again</button>
        </div>
      </div>
    )
  }

  const input = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile / Resume</h1>
      <p className="text-gray-600 mb-8">
        Upload your CV and review the skills Boot found. Search keywords and automatic applying are set on{' '}
        <Link href="/dashboard/preferences" className="text-blue-600 underline">Job Preferences</Link>.
      </p>

      {message && (
        <div className={`mb-6 p-4 rounded-lg text-sm ${message.kind === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <section className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">CV / portfolio</h2>
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
        <h2 className="text-xl font-semibold mb-4">Skills</h2>
        <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma separated)</label>
        <textarea value={skills} onChange={(e) => setSkills(e.target.value)} rows={3} className={input} />
      </section>

      <button onClick={save} disabled={busy !== null} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
        {busy === 'save' ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
