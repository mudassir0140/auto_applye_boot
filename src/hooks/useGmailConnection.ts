import '@/lib/normalize-env'
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

// One /api/me request is shared by every component/page that asks within 20s
// (dashboard + settings + re-mounts used to each fire their own).
type MeResponse = { connected?: boolean; needsReconnect?: boolean }
let meCache: { at: number; data: MeResponse } | null = null
let meInFlight: Promise<MeResponse> | null = null

async function fetchMe(force: boolean): Promise<MeResponse> {
  if (!force && meCache && Date.now() - meCache.at < 20_000) return meCache.data
  if (meInFlight) return meInFlight
  meInFlight = fetch('/api/me')
    .then(async (response) => {
      if (!response.ok) throw new Error('Failed to check connection status')
      const data = (await response.json()) as MeResponse
      meCache = { at: Date.now(), data }
      return data
    })
    .finally(() => {
      meInFlight = null
    })
  return meInFlight
}

export interface GmailConnectionStatus {
  connected: boolean
  email: string | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * "Connected" is decided by the authenticated Google session (the JWT cookie),
 * so it never flips back to "Sign in with Google" because the database is slow
 * or unreachable. /api/me adds the MongoDB view: it saves the Google account if
 * it is missing and reports an explicit disconnect / dead grant.
 */
export function useGmailConnection(): GmailConnectionStatus {
  const { data: session, status } = useSession()
  // null = not known yet / API unavailable; false = MongoDB says disconnected.
  const [storedConnected, setStoredConnected] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkConnection = useCallback(async () => {
    try {
      setError(null)
      // Explicit refetch() calls (e.g. after Disconnect) bypass the cache.
      const data = await fetchMe(true)
      setStoredConnected(data.needsReconnect ? false : data.connected ? true : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStoredConnected(null)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchMe(false)
        .then((data) => setStoredConnected(data.needsReconnect ? false : data.connected ? true : null))
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setStoredConnected(null)
        })
    }
    else if (status === 'unauthenticated') {
      meCache = null
      setStoredConnected(null)
    }
  }, [status, checkConnection])

  const sessionConnected = status === 'authenticated' && !!session?.googleConnected
  return {
    connected: sessionConnected && storedConnected !== false,
    email: sessionConnected ? session?.user?.email ?? null : null,
    loading: status === 'loading',
    error,
    refetch: checkConnection,
  }
}
