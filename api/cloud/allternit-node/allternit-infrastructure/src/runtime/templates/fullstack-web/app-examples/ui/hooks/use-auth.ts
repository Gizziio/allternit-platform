// Custom Hook for Authentication
// Place this in src/hooks/use-auth.ts

'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export function useAuth() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const isLoading = status === 'loading'
  const isAuthenticated = status === 'authenticated'
  const user = session?.user

  const login = useCallback(
    async (provider: string, options?: { callbackUrl?: string }) => {
      await signIn(provider, {
        callbackUrl: options?.callbackUrl || '/',
      })
    },
    []
  )

  const loginWithCredentials = useCallback(
    async (email: string, password: string, callbackUrl?: string) => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: callbackUrl || '/',
      })

      if (result?.ok) {
        router.push(callbackUrl || '/')
        router.refresh()
      }

      return result
    },
    [router]
  )

  const logout = useCallback(
    async (callbackUrl?: string) => {
      await signOut({ callbackUrl: callbackUrl || '/auth/signin' })
    },
    []
  )

  const updateSession = useCallback(
    async (data: { name?: string; image?: string }) => {
      await update(data)
    },
    [update]
  )

  const hasRole = useCallback(
    (role: string) => {
      return user?.role === role
    },
    [user]
  )

  return {
    user,
    session,
    status,
    isLoading,
    isAuthenticated,
    login,
    loginWithCredentials,
    logout,
    updateSession,
    hasRole,
    isAdmin: hasRole('ADMIN'),
  }
}
