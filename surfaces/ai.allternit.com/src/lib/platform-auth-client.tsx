import React, { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";

"use client"
import { useLocation } from "react-router-dom"
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useAuth,
  useClerk as useClerkReact,
  useUser,
} from "@clerk/clerk-react"
import { cn } from "@/lib/utils"
import { useCompanyConfig } from "@/providers/company-config-provider"

const ENV_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""
const SIGN_IN_URL = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "/sign-in"
const SIGN_UP_URL = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? "/sign-up"
const desktopAuthEnabled = process.env.NEXT_PUBLIC_ALLTERNIT_DESKTOP_AUTH === "1"
const clerkDisabledByEnv = process.env.NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK === "1"
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

type PlatformAuthShape = ReturnType<typeof buildDisabledAuthValue>

const PlatformAuthContext = createContext<PlatformAuthShape | null>(null)

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
  const location = useLocation()
  return desktopAuthEnabled &&
    DESKTOP_BROWSER_AUTH_PATH_PREFIXES.some((prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`))
}

export function isPlatformAuthDisabled() {
  return clerkDisabledByEnv || (!desktopAuthEnabled && !ENV_PUBLISHABLE_KEY)
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
    formFieldInputShowPasswordButtonIcon: {
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
  const { session, isLoaded: desktopIsLoaded } = useDesktopSession()
  const browserAuthSurface = useDesktopBrowserAuthSurface()
  const { config: companyConfig, isLoading: companyConfigLoading } = useCompanyConfig()

  if (companyConfigLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--surface-canvas)] text-[var(--text-primary)]">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent mx-auto" />
          <div className="text-sm font-medium">Loading platform configuration…</div>
        </div>
      </div>
    )
  }

  const publishableKey = companyConfig?.clerkPublishableKey ?? ENV_PUBLISHABLE_KEY
  const authDisabled = clerkDisabledByEnv || (!desktopAuthEnabled && !publishableKey)

  if (desktopAuthEnabled && !browserAuthSurface) {
    const value = buildDesktopAuthValue(session, desktopIsLoaded)
    return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>
  }

  if (authDisabled || !publishableKey) {
    const value = buildDisabledAuthValue()
    return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={clerkAppearance}
      signInUrl={SIGN_IN_URL}
      signUpUrl={SIGN_UP_URL}
    >
      <ClerkPlatformAuthBridge>{children}</ClerkPlatformAuthBridge>
    </ClerkProvider>
  )
}

export function usePlatformUser(): {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: PlatformUser | null;
} {
  const { user } = usePlatformAuthContext()
  return user
}

export function usePlatformSessions() {
  const { sessions } = usePlatformAuthContext()
  return sessions
}

export function useClerk() {
  return usePlatformAuthContext().clerk
}

export function usePlatformAuth() {
  const { auth } = usePlatformAuthContext()
  return auth
}

export function usePlatformSignOut() {
  return usePlatformAuthContext().signOut
}

export function usePlatformHardSignOut() {
  return usePlatformAuthContext().hardSignOut
}

function buildDesktopUser(session: DesktopSession | null) {
  return session ? {
    id: session.userId,
    userEmail: session.userEmail,
    primaryEmailAddress: { emailAddress: session.userEmail },
    emailAddresses: [{ emailAddress: session.userEmail }],
  } satisfies PlatformUser : null
}

function buildDisabledAuthValue() {
  return {
    user: {
      isLoaded: true as boolean,
      isSignedIn: false as boolean,
      user: null as PlatformUser | null,
    },
    sessions: {
      isLoaded: true as boolean,
      sessions: [] as any[],
    },
    auth: {
      isLoaded: true as boolean,
      isSignedIn: false as boolean | undefined,
      userId: null as string | null | undefined,
      sessionId: null as string | null | undefined,
      orgId: null as string | null | undefined,
      actor: null as unknown,
      getToken: async () => null as string | null,
    },
    signOut: async (_options?: any) => {},
    hardSignOut: async (_options?: any) => {},
    clerk: null as any,
  }
}

function buildDesktopAuthValue(session: DesktopSession | null, isLoaded: boolean) {
  const user = buildDesktopUser(session)
  return {
    user: {
      isLoaded,
      isSignedIn: Boolean(session),
      user,
    },
    sessions: {
      isLoaded,
      sessions: [] as any[],
    },
    auth: {
      isLoaded,
      isSignedIn: Boolean(session),
      userId: session?.userId ?? null,
      sessionId: null as string | null,
      orgId: null as string | null,
      actor: null as unknown,
      getToken: async () => session?.accessToken ?? null,
    },
    signOut: async (_options?: unknown) => {
      await window.allternit?.auth?.signOut()
    },
    hardSignOut: async (_options?: unknown) => {
      if (window.allternit?.auth?.hardSignOut) {
        await window.allternit.auth.hardSignOut()
        return
      }
      await window.allternit?.auth?.signOut()
    },
    clerk: null as any,
  }
}

function ClerkPlatformAuthBridge({ children }: { children: ReactNode }) {
  const clerkUser = useUser()
  const clerkAuth = useAuth()
  const clerk = useClerkReact()
  const [sessions, setSessions] = useState<any[]>([])

  useEffect(() => {
    if (clerkAuth.isSignedIn && clerk.client) {
      setSessions(clerk.client.sessions)
      return
    }
    setSessions([])
  }, [clerkAuth.isSignedIn, clerk.client])

  const value = useMemo(() => ({
    user: {
      isLoaded: clerkUser.isLoaded,
      isSignedIn: clerkUser.isSignedIn ?? false,
      user: (clerkUser.user as PlatformUser | null | undefined) ?? null,
    },
    sessions: {
      isLoaded: clerkAuth.isLoaded,
      sessions,
    },
    auth: clerkAuth,
    signOut: clerk.signOut,
    hardSignOut: async (options?: unknown) => {
      await clerk.signOut(options as never)
    },
    clerk,
  }), [clerk, clerkAuth, clerkUser, sessions])

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>
}

function usePlatformAuthContext() {
  const context = useContext(PlatformAuthContext)
  if (!context) {
    throw new Error("PlatformAuthProvider is missing")
  }
  return context
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
      className="p-5 px-6 rounded-xl border border-solid border-[#d1d5db] bg-white max-w-[420px] w-full text-left"
    >
      <h2 className="m-0 mb-2 text-[18px] font-semibold">{title}</h2>
      <p className="m-0 text-[14px] text-[#6b7280] leading-relaxed">{description}</p>
    </div>
  )
}

export function PlatformSignIn(props: {
  forceRedirectUrl?: string
  signUpForceRedirectUrl?: string
  signUpUrl?: string
}) {
  const browserAuthSurface = useDesktopBrowserAuthSurface()
  const { config: companyConfig } = useCompanyConfig()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const publishableKey = companyConfig?.clerkPublishableKey ?? ENV_PUBLISHABLE_KEY
  const authDisabled = clerkDisabledByEnv || (!desktopAuthEnabled && !publishableKey)

  if (desktopAuthEnabled && !browserAuthSurface) {

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
        className="p-5 px-6 rounded-xl border border-solid border-[#d1d5db] bg-white max-w-[420px] w-full text-left"
      >
        <h2 className="m-0 mb-2 text-[18px] font-semibold">Sign in with Allternit Desktop</h2>
        <p className="m-0 mb-4 text-[14px] text-[#6b7280] leading-relaxed">
          Continue in your browser to complete the real Allternit account sign-in flow, then return to the desktop app automatically.
        </p>
        <button type="button"
          onClick={() => void handleDesktopSignIn()}
          disabled={starting}
          className={cn(
            "w-full p-3 px-4 rounded-[10px] border-none bg-[#D97757] text-[#140F0B] text-[14px] font-bold transition-all",
            starting ? "cursor-not-allowed opacity-70" : "cursor-pointer"
          )}
        >
          {starting ? "Opening browser…" : "Continue in browser"}
        </button>
        {error ? (
          <p className="m-0 mt-3 text-[12px] text-[#dc2626] leading-relaxed">{error}</p>
        ) : null}
      </div>
    )
  }

  if (authDisabled) {
    return (
      <DisabledAuthCard
        title="Authentication is unavailable in this build"
        description="This shell is running without a configured browser or desktop auth provider, so sign-in cannot complete here."
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
  const { config: companyConfig } = useCompanyConfig()

  const publishableKey = companyConfig?.clerkPublishableKey ?? ENV_PUBLISHABLE_KEY
  const authDisabled = clerkDisabledByEnv || (!desktopAuthEnabled && !publishableKey)

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
        title="Authentication is unavailable in this build"
        description="This shell is running without a configured browser or desktop auth provider, so sign-up cannot complete here."
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
