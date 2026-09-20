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
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
}

module.exports = nextConfig
