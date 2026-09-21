import { useCallback, useEffect, useRef, useState } from 'react'

// Module-level cache: data a page already loaded is shown instantly when the user
// navigates back to it (or to another page that reads the same endpoint) while a
// fresh copy is fetched in the background. A loader is only ever needed the very
// first time an endpoint is requested.
const cache = new Map<string, unknown>()
const inFlight = new Map<string, Promise<unknown>>()

async function request<T>(url: string): Promise<T> {
  const pending = inFlight.get(url)
  if (pending) return pending as Promise<T>
  const promise = fetch(url, { cache: 'no-store' })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.message || body.error || `Request failed (${res.status})`)
      cache.set(url, body)
      return body as T
    })
    .finally(() => inFlight.delete(url))
  inFlight.set(url, promise)
  return promise
}

export function useCachedFetch<T>(url: string, enabled = true) {
  const [data, setData] = useState<T | undefined>(() => cache.get(url) as T | undefined)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    setError(null)
    setRefreshing(true)
    try {
      const next = await request<T>(url)
      if (alive.current) setData(next)
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      if (alive.current) setRefreshing(false)
    }
  }, [url])

  useEffect(() => {
    if (enabled) reload()
  }, [enabled, reload])

  // Update local state and cache together after a mutation (save, apply, ...).
  const mutate = useCallback(
    (update: (current: T | undefined) => T) => {
      setData((current) => {
        const next = update(current)
        cache.set(url, next)
        return next
      })
    },
    [url]
  )

  return {
    data,
    error,
    // True only when there is nothing to show yet.
    loading: data === undefined && error === null,
    refreshing,
    reload,
    mutate,
  }
}
