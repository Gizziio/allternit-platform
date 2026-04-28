"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
  useUser,
} from "@clerk/clerk-react"

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""
const SIGN_IN_URL = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "/sign-in"
const SIGN_UP_URL = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? "/sign-up"
const desktopAuthEnabled = process.env.NEXT_PUBLIC_ALLTERNIT_DESKTOP_AUTH === "1"
const authDisabled =
  process.env.NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK === "1" ||
  (!desktopAuthEnabled && !PUBLISHABLE_KEY)
const DESKTOP_BROWSER_AUTH_PATH_PREFIXES = ["/sign-in", "/sign-up", "/oauth", "/terminal/clerk", "/clerk_"]

type DesktopSession = {
  userId: string
  userEmail: string
  accessToken: string
  expiresAt: number
}

export interface PlatformUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  userEmail?: string;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: Array<{ emailAddress: string }>;
  imageUrl?: string | null;
}

function useDesktopSession() {
  const [session, setSession] = useState<DesktopSession | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!desktopAuthEnabled) {
      setIsLoaded(true)
      return
    }

    let active = true
    window.allternit?.auth?.getSession()
      .then((nextSession: DesktopSession | null) => {
        if (!active) return
        setSession(nextSession)
        setIsLoaded(true)
      })
      .catch(() => {
        if (!active) return
        setSession(null)
        setIsLoaded(true)
      })

    return () => {
      active = false
    }
  }, [])

  return { session, isLoaded }
}

function useDesktopBrowserAuthSurface() {
  const pathname = usePathname()
  return desktopAuthEnabled &&
    DESKTOP_BROWSER_AUTH_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function isPlatformAuthDisabled() {
  return authDisabled
}

const clerkAppearance = {
  variables: {
    colorBackground: "#17120E",
    colorPrimary: "#D97757",
    colorText: "#F5EDE3",
    colorTextSecondary: "#A98A75",
    colorInputBackground: "#110D0A",
    colorInputText: "#F5EDE3",
    colorNeutral: "#A98A75",
    colorDanger: "#f87171",
    borderRadius: "16px",
    fontFamily: "inherit",
  },
  elements: {
    cardBox: {
      background: "transparent",
      border: "none",
      boxShadow: "none",
      width: "100%",
      maxWidth: "100%",
    },
    rootBox: {
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
    },
    card: {
      background: "transparent",
      border: "none",
      boxShadow: "none",
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      padding: "0",
    },
    headerTitle: {
      color: "#F5EDE3",
      fontSize: "28px",
      fontWeight: "700",
      letterSpacing: "-0.03em",
    },
    headerSubtitle: {
      color: "#A98A75",
    },
    socialButtonsBlockButton: {
      background: "#110D0A",
      border: "1px solid var(--ui-border-muted)",
      color: "#F5EDE3",
      boxShadow: "none",
    },
    socialButtonsBlockButtonText: {
      color: "#F5EDE3",
    },
    dividerLine: {
      background: "var(--ui-border-muted)",
    },
    dividerText: {
      color: "#7E6556",
    },
    formFieldLabel: {
      color: "#D6C2B1",
    },
    formFieldInput: {
      background: "#110D0A",
      border: "1px solid var(--ui-border-muted)",
      color: "#F5EDE3",
      boxShadow: "none",
    },
    formFieldInputShowPasswordButton: {
      color: "#A98A75",
    },
    footerActionText: {
      color: "#A98A75",
    },
    footerActionLink: {
      color: "#D97757",
    },
    footer: {
      background: "transparent",
      padding: "20px 0 0",
      margin: "0",
    },
    form: {
      gap: "14px",
    },
    main: {
      gap: "18px",
    },
    formButtonPrimary: {
      background: "#D97757",
      color: "#140F0B",
      boxShadow: "none",
      fontWeight: "700",
    },
    identityPreviewText: {
      color: "#F5EDE3",
    },
    formResendCodeLink: {
      color: "#D97757",
    },
    otpCodeFieldInput: {
      background: "#110D0A",
      border: "1px solid var(--ui-border-muted)",
      color: "#F5EDE3",
    },
    alertText: {
      color: "#F5EDE3",
    },
    alertClerkError: {
      background: "rgba(248,113,113,0.12)",
      border: "1px solid rgba(248,113,113,0.24)",
    },
  },
} as const

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  if (authDisabled || !PUBLISHABLE_KEY) return <>{children}</>
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={clerkAppearance}
      signInUrl={SIGN_IN_URL}
      signUpUrl={SIGN_UP_URL}
    >
      {children}
    </ClerkProvider>
  )
}

export function usePlatformUser(): {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: PlatformUser | null;
} {
  const { session, isLoaded } = useDesktopSession()
  const browserAuthSurface = useDesktopBrowserAuthSurface()

  if (desktopAuthEnabled && !browserAuthSurface) {
    return {
      isLoaded,
      isSignedIn: Boolean(session),
      user: session ? {
        id: session.userId,
        userEmail: session.userEmail,
        primaryEmailAddress: { emailAddress: session.userEmail },
        emailAddresses: [{ emailAddress: session.userEmail }],
      } : null,
    }
  }

  if (authDisabled) {
    return { isLoaded: true as const, isSignedIn: true as const, user: null }
  }

  const clerkUser = useUser()
  return {
    isLoaded: clerkUser.isLoaded,
    isSignedIn: clerkUser.isSignedIn ?? false,
    user: (clerkUser.user as PlatformUser | null | undefined) ?? null,
  }
}

export function usePlatformSessions() {
  const { isLoaded, isSignedIn } = usePlatformAuth()
  const clerk = useClerk()
  const [sessions, setSessions] = useState<any[]>([])

  useEffect(() => {
    if (isSignedIn && clerk.client) {
      setSessions(clerk.client.sessions)
    }
  }, [isSignedIn, clerk.client])

  return { isLoaded, sessions }
}

export { useClerk }

export function usePlatformAuth() {
  const { session, isLoaded } = useDesktopSession()
  const browserAuthSurface = useDesktopBrowserAuthSurface()

  if (desktopAuthEnabled && !browserAuthSurface) {
    return {
      isLoaded,
      isSignedIn: Boolean(session),
      userId: session?.userId ?? null,
      sessionId: null,
      orgId: null,
      actor: null,
      getToken: async () => session?.accessToken ?? null,
    }
  }

  if (authDisabled) {
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

  return useAuth()
}

export function usePlatformSignOut() {
  const browserAuthSurface = useDesktopBrowserAuthSurface()

  if (desktopAuthEnabled && !browserAuthSurface) {
    return async (_options?: unknown) => {
      await window.allternit?.auth?.signOut()
    }
  }

  if (authDisabled) {
    return async (_options?: unknown) => {}
  }

  const clerk = useClerk()
  return clerk.signOut
}

export function usePlatformHardSignOut() {
  if (desktopAuthEnabled) {
    return async () => {
      if (window.allternit?.auth?.hardSignOut) {
        await window.allternit.auth.hardSignOut()
        return
      }
      await window.allternit?.auth?.signOut()
    }
  }

  if (authDisabled) {
    return async () => {}
  }

  const clerk = useClerk()
  return async (options?: unknown) => {
    await clerk.signOut(options as never)
  }
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
  signUpUrl?: string
}) {
  const browserAuthSurface = useDesktopBrowserAuthSurface()

  if (desktopAuthEnabled && !browserAuthSurface) {
    const [starting, setStarting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleDesktopSignIn = async () => {
      setError(null)
      setStarting(true)
      try {
        await window.allternit?.auth?.startLogin?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to start desktop sign-in")
        setStarting(false)
      }
    }

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
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600 }}>Sign in with Allternit Desktop</h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
          Continue in your browser to complete the real Allternit account sign-in flow, then return to the desktop app automatically.
        </p>
        <button
          onClick={() => void handleDesktopSignIn()}
          disabled={starting}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background: "#D97757",
            color: "#140F0B",
            fontSize: 14,
            fontWeight: 700,
            cursor: starting ? "not-allowed" : "pointer",
            opacity: starting ? 0.7 : 1,
          }}
        >
          {starting ? "Opening browser…" : "Continue in browser"}
        </button>
        {error ? (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#dc2626", lineHeight: 1.5 }}>{error}</p>
        ) : null}
      </div>
    )
  }

  if (authDisabled) {
    return (
      <DisabledAuthCard
        title="Auth disabled in local shell"
        description="The Electron/UI development shell is running without Clerk so the platform can boot and render locally."
      />
    )
  }

  const redirectUrl = props.forceRedirectUrl || "/shell"
  return (
    <SignIn
      appearance={clerkAppearance}
      forceRedirectUrl={redirectUrl}
      path={SIGN_IN_URL}
      routing="path"
      signUpForceRedirectUrl={props.signUpForceRedirectUrl || redirectUrl}
      signUpUrl={props.signUpUrl || "/sign-up"}
    />
  )
}

export function PlatformSignUp(props: {
  forceRedirectUrl?: string
  signInForceRedirectUrl?: string
  signInUrl?: string
}) {
  const browserAuthSurface = useDesktopBrowserAuthSurface()

  if (desktopAuthEnabled && !browserAuthSurface) {
    return (
      <DisabledAuthCard
        title="Sign-up is handled on the hosted platform"
        description="Create the account in the browser-backed flow, then return to the desktop app after authorization completes."
      />
    )
  }

  if (authDisabled) {
    return (
      <DisabledAuthCard
        title="Sign up unavailable in local shell"
        description="Clerk is disabled in this local development workspace, so sign-up is replaced with a non-blocking placeholder."
      />
    )
  }

  const redirectUrl = props.forceRedirectUrl || "/shell"
  return (
    <SignUp
      appearance={clerkAppearance}
      forceRedirectUrl={redirectUrl}
      path={SIGN_UP_URL}
      routing="path"
      signInForceRedirectUrl={props.signInForceRedirectUrl || redirectUrl}
      signInUrl={props.signInUrl || "/sign-in"}
    />
  )
}
