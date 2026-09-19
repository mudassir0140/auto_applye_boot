/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
