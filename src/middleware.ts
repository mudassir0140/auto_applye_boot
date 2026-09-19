import { withAuth } from 'next-auth/middleware'

export const middleware = withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    // Must match authOptions.pages.signIn in src/lib/auth.ts, otherwise an
    // unauthenticated /dashboard visit redirects to NextAuth's unstyled
    // default sign-in page instead of the app's home page.
    signIn: '/',
  },
})

export const config = {
  matcher: ['/dashboard/:path*'],
}
