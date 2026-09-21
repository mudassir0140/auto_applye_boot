'use client'

import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { ReactNode } from 'react'

// `session` is resolved on the server (from the cookie, no database) and handed
// over, so the first render already knows who is signed in. Without it every page
// waited for a client round trip to /api/auth/session before it could even start
// its own data fetch. Window-focus refetching is off: it re-ran that request (and
// every effect keyed on the session) each time the tab regained focus.
export function Providers({ children, session }: { children: ReactNode; session?: Session | null }) {
  return (
    <SessionProvider session={session} refetchInterval={10 * 60} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  )
}
