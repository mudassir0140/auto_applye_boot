import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export interface GmailConnectionStatus {
  connected: boolean
  email: string | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useGmailConnection(): GmailConnectionStatus {
  const { data: session, status } = useSession()
  const [connected, setConnected] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkConnection = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/me')
      if (!response.ok) {
        throw new Error('Failed to check connection status')
      }

      const data = await response.json()
      setConnected(data.connected)
      setEmail(data.email)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      setConnected(false)
      setEmail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Check connection when session is authenticated
    if (status === 'authenticated' && session) {
      checkConnection()
    } else if (status === 'unauthenticated') {
      setConnected(false)
      setEmail(null)
      setLoading(false)
    }
  }, [status, session])

  // Also check connection after OAuth callback redirect
  useEffect(() => {
    // Check if we're returning from OAuth callback
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

    if (code || error) {
      // Wait a moment for session to update, then check connection
      const timer = setTimeout(() => {
        checkConnection()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [])

  return {
    connected,
    email,
    loading,
    error,
    refetch: checkConnection,
  }
}
