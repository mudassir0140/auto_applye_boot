import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

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
      const response = await fetch('/api/me')
      if (!response.ok) throw new Error('Failed to check connection status')
      const data = await response.json()
      setStoredConnected(data.needsReconnect ? false : data.connected ? true : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStoredConnected(null)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') checkConnection()
    else if (status === 'unauthenticated') setStoredConnected(null)
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
