"use client"

import type { ReactNode } from "react"

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

export function ClerkProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function SignIn() {
  return (
    <DisabledAuthCard
      title="Auth unavailable in local shell"
      description="Clerk is not installed in this workspace, so the Electron shell uses a local development fallback."
    />
  )
}

export function SignUp() {
  return (
    <DisabledAuthCard
      title="Sign up unavailable in local shell"
      description="Clerk is not installed in this workspace, so sign-up is replaced with a non-blocking placeholder."
    />
  )
}

export function useAuth() {
  return {
    isLoaded: true as const,
    isSignedIn: true as const,
    userId: "local-user",
    sessionId: null,
    orgId: null,
    actor: null,
    getToken: async () => null as string | null,
  }
}

export function useUser() {
  return {
    isLoaded: true as const,
    isSignedIn: true as const,
    user: null,
  }
}

export function useClerk() {
  return {
    signOut: async () => {},
  }
}
