'use client'
import '@/lib/normalize-env'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

export interface GmailIssue {
  code: 'api_disabled' | 'scope_missing'
  message: string
}

/** Turn a URL inside the message into a link (the Gmail API activation page). */
function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part.replace(/[.,]$/, '')} target="_blank" rel="noopener noreferrer" className="underline font-medium">
        {part.replace(/[.,]$/, '')}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

/**
 * Explains WHY Gmail is not working (Gmail API not enabled in Google Cloud, or the Gmail
 * permissions were not granted) and lets the user re-verify without waiting for a job to fail.
 */
export function GmailIssueBanner({ issue, onResolved }: { issue: GmailIssue; onResolved?: () => void }) {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function recheck() {
    setChecking(true)
    setResult(null)
    try {
      const res = await fetch('/api/gmail/status?check=1', { cache: 'no-store' })
      const data = await res.json()
      if (data.health?.ok) {
        setResult('Gmail is working.')
        onResolved?.()
      } else {
        setResult(data.health?.message || data.error || 'Gmail is still not working.')
      }
    } catch {
      setResult('Could not reach the server.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="mb-8 bg-amber-50 border border-amber-300 p-4 rounded-lg" role="alert">
      <p className="font-semibold text-amber-900 mb-1">
        {issue.code === 'api_disabled' ? 'Gmail API is not enabled' : 'Gmail permission missing'}
      </p>
      <p className="text-amber-900 text-sm mb-3">{linkify(issue.message)}</p>
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={recheck}
          disabled={checking}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 text-sm"
        >
          {checking ? 'Checking…' : 'Check again'}
        </button>
        {issue.code === 'scope_missing' && (
          <button
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="px-4 py-2 border border-amber-600 text-amber-900 rounded-lg hover:bg-amber-100 text-sm"
          >
            Reconnect Google
          </button>
        )}
        {result && <span className="text-sm text-amber-900">{result}</span>}
      </div>
    </div>
  )
}
