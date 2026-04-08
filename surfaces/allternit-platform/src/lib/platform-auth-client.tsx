"use client"

import { ClerkProvider, SignIn, SignUp, useAuth, useUser, useClerk } from "@clerk/nextjs"
import type { ReactNode } from "react"

const authDisabled = process.env.NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK === "1"

export function isPlatformAuthDisabled() {
  return authDisabled
}

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  if (authDisabled) return <>{children}</>
  return <ClerkProvider>{children}</ClerkProvider>
}

export const usePlatformUser = authDisabled
  ? () => ({ isLoaded: true as const, isSignedIn: true as const, user: null })
  : useUser

export const usePlatformAuth = authDisabled
  ? () => ({
      isLoaded: true as const,
      isSignedIn: true as const,
      userId: "local-user",
      sessionId: null,
      orgId: null,
      actor: null,
      getToken: async () => null as string | null,
    })
  : useAuth

export const usePlatformSignOut = authDisabled
  ? () => async () => {}
  : () => {
      const clerk = useClerk()
      return clerk.signOut
    }

function DisabledAuthCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div
      style={{
        padding: "20px 24px",
        borderRadius: 12,
        border: "1px solid #d1d5db",
        background: "#fff",
        maxWidth: 420,
        width: "100%",
        textAlign: "left",
      }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>{description}</p>
    </div>
  )
}

export function PlatformSignIn(props: {
  forceRedirectUrl?: string
  signUpForceRedirectUrl?: string
}) {
  if (authDisabled) {
    return (
      <DisabledAuthCard
        title="Auth disabled in local shell"
        description="The Electron/UI development shell is running without Clerk so the platform can boot and render locally."
      />
    )
  }

  // Default redirect to shell after sign-in
  const defaultRedirectUrl = "/shell"
  
  return (
    <SignIn 
      forceRedirectUrl={props.forceRedirectUrl || defaultRedirectUrl}
      signUpForceRedirectUrl={props.signUpForceRedirectUrl || defaultRedirectUrl}
      fallbackRedirectUrl={defaultRedirectUrl}
      {...props} 
    />
  )
}

export function PlatformSignUp() {
  if (authDisabled) {
    return (
      <DisabledAuthCard
        title="Sign up unavailable in local shell"
        description="Clerk is disabled in this local development workspace, so sign-up is replaced with a non-blocking placeholder."
      />
    )
  }

  // Default redirect to shell after sign-up
  const defaultRedirectUrl = "/shell"
  
  return (
    <SignUp 
      forceRedirectUrl={defaultRedirectUrl}
      fallbackRedirectUrl={defaultRedirectUrl}
    />
  )
}
