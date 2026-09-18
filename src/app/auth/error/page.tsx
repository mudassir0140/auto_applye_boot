import Link from 'next/link'

export default function AuthError() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Authentication Error</h1>
        <p className="text-gray-600 mb-8">
          There was an error during authentication. Please try again.
        </p>
        <Link href="/" className="text-blue-600 hover:underline">
          Go back to home
        </Link>
      </div>
    </div>
  )
}
