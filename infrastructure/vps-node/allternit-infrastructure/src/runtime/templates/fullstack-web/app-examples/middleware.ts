// Next.js Middleware for Route Protection
// Place this in src/middleware.ts

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Protect admin routes
    if (pathname.startsWith('/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    // Protect API routes
    if (pathname.startsWith('/api/admin') && token?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ req, token }) {
        // Allow public paths
        const publicPaths = ['/auth/signin', '/auth/register', '/api/auth']
        if (publicPaths.some((path) => req.nextUrl.pathname.startsWith(path))) {
          return true
        }

        // Require authentication for protected paths
        if (req.nextUrl.pathname.startsWith('/dashboard')) {
          return token !== null
        }

        return true
      },
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/protected/:path*',
  ],
}
