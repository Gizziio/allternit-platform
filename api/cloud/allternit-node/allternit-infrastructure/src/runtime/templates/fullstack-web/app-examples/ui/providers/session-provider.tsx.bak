// NextAuth Session Provider
// Place this in src/components/providers/session-provider.tsx

'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { type ReactNode } from 'react'

interface SessionProviderProps {
  children: ReactNode
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider
      refetchInterval={5 * 60} // Refetch session every 5 minutes
      refetchOnWindowFocus={false}
    >
      {children}
    </NextAuthSessionProvider>
  )
}
