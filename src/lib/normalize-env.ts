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
