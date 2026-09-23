// Import this BEFORE anything from 'next-auth'.
//
// next-auth/react and next-auth/middleware call `new URL(...)` on NEXTAUTH_URL,
// NEXTAUTH_URL_INTERNAL and VERCEL_URL while their module is being loaded. A value
// that is set-but-empty (a blank variable in the Vercel dashboard) or malformed
// (pasted with quotes/whitespace) throws `TypeError: Invalid URL` and fails every
// page that touches auth, at build time and at runtime.
//
// Normalise what can be recovered (trim, quotes, missing scheme), drop what cannot
// (so next-auth falls back to its own detection from VERCEL_URL / request headers),
// and never invent a localhost URL for production.

// This app runs next-auth v4, which reads NEXTAUTH_URL / NEXTAUTH_SECRET (and
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET for the Google provider). Auth.js v5
// renamed these to AUTH_URL / AUTH_SECRET / AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET,
// and that naming is what current NextAuth/Vercel setup guides show — a variable
// saved under the v5 name is invisible to this v4 app and looks identical to it
// simply being unset ("There is a problem with the server configuration" on every
// /api/auth/* route). Fill in the v4 name from its v5 alias when only the alias
// is set, so either naming works; the v4 name always wins when both are present.
function alias(v4: string, v5: string): void {
  if (!process.env[v4] && process.env[v5]) process.env[v4] = process.env[v5]
}
alias('NEXTAUTH_URL', 'AUTH_URL')
alias('NEXTAUTH_SECRET', 'AUTH_SECRET')
alias('GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_ID')
alias('GOOGLE_CLIENT_SECRET', 'AUTH_GOOGLE_SECRET')

function normalise(name: string): void {
  const raw = process.env[name]
  if (raw === undefined) return

  let value = raw.trim().replace(/^["']+|["']+$/g, '').trim()
  if (value && !/^https?:\/\//i.test(value)) value = `https://${value}`

  try {
    if (!value) throw new Error('empty')
    new URL(value)
    process.env[name] = value
  } catch {
    if (raw.trim()) {
      console.warn(`[env] ${name} is not a valid URL ("${raw}") and was ignored. Set it to your site URL, e.g. https://your-app.vercel.app`)
    }
    delete process.env[name]
  }
}

normalise('NEXTAUTH_URL')
normalise('NEXTAUTH_URL_INTERNAL')
normalise('VERCEL_URL')
normalise('NEXT_PUBLIC_APP_URL')

// On Vercel with no usable NEXTAUTH_URL, use the project's production domain
// (provided by Vercel itself, without a scheme) rather than guessing.
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`
  normalise('NEXTAUTH_URL')
}

export {}
