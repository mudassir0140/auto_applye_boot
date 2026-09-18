import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Job Application AI Agent',
  description: 'Automate your job application process',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
