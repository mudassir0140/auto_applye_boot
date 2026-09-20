import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    // Set when the Google token could not be refreshed; the user must sign in again.
    error?: string
    // True while the cookie holds a usable Google grant (no tokens are exposed).
    googleConnected?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string // MongoDB User id
    access_token?: string
    refresh_token?: string
    expires_at?: number // seconds since epoch
    error?: string
  }
}
