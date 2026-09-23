// Vercel never runs `next dev`; every build and every serverless invocation there is
// production. If a project-level "NODE_ENV" environment variable was ever added in the
// Vercel dashboard (Next.js sets this itself and none should be added), a value other
// than "production" makes Next.js mix its dev and prod renderers in the same process,
// which crashes EVERY route — including ones with no code of ours on the stack, like a
// plain `/favicon.ico` request — with "<Html> should not be imported outside of
// pages/_document" / "Cannot read properties of null (reading 'useContext')".
// Reproduced locally: `next build` with NODE_ENV=development set exits non-zero with
// exactly that error; unset (or "production"), the same build succeeds.
if (process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  console.warn(`[next.config] NODE_ENV was "${process.env.NODE_ENV}" on Vercel; forcing "production". Remove any NODE_ENV project environment variable in the Vercel dashboard — Vercel sets it automatically.`)
  process.env.NODE_ENV = 'production'
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets `NEXT_DIST_DIR=.next-build npm run build` run without clobbering a live dev server's .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
  swcMinify: true,
  experimental: {
    // Native/CJS parsers must not be bundled by webpack.
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.linkedin.com' },
      { protocol: 'https', hostname: '**.google.com' },
    ],
  },
  env: {
    // Local default only; never bake a localhost URL into a production build.
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000'),
  },
}

module.exports = nextConfig
