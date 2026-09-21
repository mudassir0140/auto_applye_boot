import type { Metadata } from 'next'
import './globals.css'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Job Application AI Agent',
  description: 'Automate your job application process',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Cookie/JWT only — no database. If it fails, the client falls back to fetching the session itself.
  const session = await getServerSession(authOptions).catch(() => undefined)

  return (
    <html lang="en">
      <body className="bg-gray-50">
        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
