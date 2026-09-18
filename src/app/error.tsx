'use client'

import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">500</h1>
        <p className="text-2xl text-gray-600 mb-4">Something went wrong</p>
        <p className="text-gray-600 mb-8">{error.message}</p>
        <div className="space-x-4">
          <button
            onClick={() => reset()}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try again
          </button>
          <Link href="/" className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
