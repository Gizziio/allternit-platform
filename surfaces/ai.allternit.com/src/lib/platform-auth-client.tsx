"use client"

import React, { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom"
import {
  ClerkProvider,
  OrganizationSwitcher,
  SignIn,
  SignUp,
  useAuth,
  useClerk as useClerkReact,
  useOrganization,
  useSignIn,
  useUser,
} from "@clerk/clerk-react"
import { cn } from "@/lib/utils"
import { useCompanyConfig } from "@/providers/company-config-provider"
import { api } from "@/integration/api-client"
import {
  env,
  envFlag,
  getBuildTimeClerkPublishableKey,
  isClerkDisabledByEnv,
  isDesktopAuthEnabled,
} from "@/lib/env"

const ENV_PUBLISHABLE_KEY = getBuildTimeClerkPublishableKey()
const SIGN_IN_URL = env("NEXT_PUBLIC_CLERK_SIGN_IN_URL") ?? "/sign-in"
const SIGN_UP_URL = env("NEXT_PUBLIC_CLERK_SIGN_UP_URL") ?? "/sign-up"
// The mounted path for the embedded <SignIn>/<SignUp> components must be a
// path, not a full URL. The full URL above is only for ClerkProvider redirects.
const SIGN_IN_PATH = "/sign-in"
const SIGN_UP_PATH = "/sign-up"
const desktopAuthEnabled = isDesktopAuthEnabled()
const clerkDisabledByEnv = isClerkDisabledByEnv()
const DESKTOP_BROWSER_AUTH_PATH_PREFIXES = ["/sign-in", "/sign-up", "/pair", "/oauth", "/terminal/clerk", "/clerk_"]

const STATIC_ALLOWED_REDIRECT_ORIGINS = [
  "https://remotecontrol.allternit.com",
  "https://platform.allternit.com",
  "https://ai.allternit.com",
  "http://localhost:3013",
  "http://localhost:5173",
  "http://localhost:4173",
]

export function getAllowedRedirectOrigins(): string[] {
  const current = typeof window !== "undefined" ? window.location.origin : "https://platform.allternit.com"
  return Array.from(new Set([current, ...STATIC_ALLOWED_REDIRECT_ORIGINS]))
}

type DesktopSession = {
  userId: string
  userEmail: string
  expiresAt: number
  runtimeId: string
  organizationId?: string
  organizationRole?: string
  capabilities: string[]
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

export interface PlatformOrganization {
  id: string;
  name: string;
  slug?: string | null;
  imageUrl?: string | null;
}

export interface PlatformOrganizationMembership {
  role?: string | null;
}

type PlatformAuthShape = ReturnType<typeof buildDisabledAuthValue>

const PlatformAuthContext = createContext<PlatformAuthShape | null>(null)

function useDesktopSession() {
  const [session, setSession] = useState<DesktopSession | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!desktopAuthEnabled || !isDesktopShell()) {
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
  return desktopAuthEnabled && isDesktopShell() &&
    DESKTOP_BROWSER_AUTH_PATH_PREFIXES.some((prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`))
}

export function isPlatformAuthDisabled() {
  // When no Clerk key is baked in and desktop runtime pairing is not enabled,
  // the PlatformAuthProvider falls back to buildDisabledAuthValue(). The auth
  // gate must match that decision regardless of shell, otherwise a local-dev
  // Electron build with no cloud credentials redirects to /sign-in and cannot
  // proceed.
  return clerkDisabledByEnv || !ENV_PUBLISHABLE_KEY
}

const clerkAppearance = {
  variables: {
    colorBackground: "#FFFEFC",
    colorPrimary: "#1A1916",
    colorText: "#0D0C0A",
    colorTextSecondary: "#74716B",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#0D0C0A",
    colorNeutral: "#74716B",
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
      color: "#0D0C0A",
      fontSize: "28px",
      fontWeight: "700",
      letterSpacing: "-0.03em",
    },
    headerSubtitle: {
      color: "#74716B",
    },
    socialButtonsBlockButton: {
      background: "#FFFFFF",
      border: "1px solid #E1E0DC",
      color: "#1A1916",
      boxShadow: "none",
    },
    socialButtonsBlockButtonText: {
      color: "#1A1916",
    },
    dividerLine: {
      background: "#E1E0DC",
    },
    dividerText: {
      color: "#989590",
    },
    formFieldLabel: {
      color: "#403E39",
    },
    formFieldInput: {
      background: "#FFFFFF",
      border: "1px solid #D7D5D0",
      color: "#0D0C0A",
      boxShadow: "none",
    },
    formFieldInputShowPasswordButton: {
      color: "#74716B",
    },
    formFieldInputShowPasswordButtonIcon: {
      color: "#74716B",
    },
    footerActionText: {
      color: "#74716B",
    },
    footerActionLink: {
      color: "#9A7658",
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
      background: "#1A1916",
      color: "#FAF9F7",
      boxShadow: "none",
      fontWeight: "700",
    },
    identityPreviewText: {
      color: "#0D0C0A",
    },
    formResendCodeLink: {
      color: "#9A7658",
    },
    otpCodeFieldInput: {
      background: "#FFFFFF",
      border: "1px solid #D7D5D0",
      color: "#0D0C0A",
    },
    alertText: {
      color: "#0D0C0A",
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
  const selfHosted = companyConfig?.selfHosted ?? false
  const authDisabled = clerkDisabledByEnv || selfHosted || (!desktopAuthEnabled && !publishableKey)

  if (desktopAuthEnabled && isDesktopShell() && !browserAuthSurface) {
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
      allowedRedirectOrigins={getAllowedRedirectOrigins()}
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

export function usePlatformOrganization(): {
  isLoaded: boolean;
  organization: PlatformOrganization | null;
  membership: PlatformOrganizationMembership | null;
} {
  return usePlatformAuthContext().organization
}

/**
 * Clerk's organization picker, kept behind the platform-auth boundary so the
 * desktop and self-hosted shells never render a Clerk component without a
 * ClerkProvider. Selecting an organization refreshes the active session token
 * and therefore the org-scoped BYOC/billing permissions used by Settings.
 */
export function PlatformOrganizationSwitcher() {
  const { clerk } = usePlatformAuthContext()
  if (!clerk) return null
  return (
    <OrganizationSwitcher
      appearance={{
        elements: {
          rootBox: { width: "100%" },
          organizationSwitcherTrigger: {
            width: "100%",
            justifyContent: "space-between",
            border: "1px solid var(--border-subtle)",
            borderRadius: "10px",
            padding: "9px 11px",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            boxShadow: "none",
          },
        },
      }}
    />
  )
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
    organization: {
      isLoaded: true as boolean,
      organization: null as PlatformOrganization | null,
      membership: null as PlatformOrganizationMembership | null,
    },
    auth: {
      isLoaded: true as boolean,
      isSignedIn: false as boolean | undefined,
      userId: null as string | null | undefined,
      sessionId: null as string | null | undefined,
      orgId: null as string | null | undefined,
      orgRole: null as string | null | undefined,
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
    organization: {
      isLoaded,
      organization: session?.organizationId ? {
        id: session.organizationId,
        name: "Active organization",
      } : null,
      membership: session?.organizationRole ? {
        role: session.organizationRole,
      } : null,
    },
    auth: {
      isLoaded,
      isSignedIn: Boolean(session),
      userId: session?.userId ?? null,
      sessionId: session?.runtimeId ?? null,
      orgId: session?.organizationId ?? null,
      orgRole: session?.organizationRole ?? null,
      actor: null as unknown,
      // Runtime credentials remain in Electron main. Requests to the local API
      // are authorized by the desktop broker, never by renderer JavaScript.
      getToken: async () => null,
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
  const clerkOrganization = useOrganization()
  const clerk = useClerkReact()
  const { signIn, setActive } = useSignIn()
  const [sessions, setSessions] = useState<any[]>([])

  useEffect(() => {
    if (clerkAuth.isSignedIn && clerk.client) {
      setSessions(clerk.client.sessions)
      return
    }
    setSessions([])
  }, [clerkAuth.isSignedIn, clerk.client])

  // DEBUG-only seeded auto-login: if VITE_CLERK_SEED_EMAIL/PASSWORD are set,
  // sign in automatically so dev/test runs don't sit at the sign-in page.
  // Organizations are enabled on this Clerk instance; a seeded account with no
  // memberships ends up in a pending session. We pick an existing membership or
  // create a personal seed org and make it active so the JWT is active.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (!clerkAuth.isLoaded || clerkAuth.isSignedIn) return
    if (!signIn || !setActive || !clerk) return
    const email = import.meta.env.VITE_CLERK_SEED_EMAIL as string | undefined
    const password = import.meta.env.VITE_CLERK_SEED_PASSWORD as string | undefined
    if (!email || !password) return
    let active = true
    const run = async () => {
      try {
        const result = await signIn.create({ identifier: email, password })
        if (!active) return
        if (result.status === "complete" && result.createdSessionId) {
          const memberships = clerk.user?.organizationMemberships
          let orgId: string | undefined = memberships?.[0]?.organization.id
          if (!orgId) {
            try {
              const org = await clerk.createOrganization({ name: "Allternit Seed" })
              orgId = org.id
            } catch (orgErr) {
              console.warn("[SeedAuth] Failed to create seed organization:", orgErr)
            }
          }
          await clerk.setActive({ session: result.createdSessionId, organization: orgId })
        } else {
          console.warn("[SeedAuth] Clerk sign-in requires extra steps:", result.status)
        }
      } catch (err) {
        console.error("[SeedAuth] Auto sign-in failed:", err)
      }
    }
    void run()
    return () => { active = false }
  }, [clerkAuth.isLoaded, clerkAuth.isSignedIn, signIn, setActive, clerk])

  // Sync Clerk's short-lived session JWT into the runtime API client. The
  // token is refreshed just before Clerk's ~60s TTL expires so local gizzi
  // requests stay authenticated; on sign-out the stored token is cleared.
  useEffect(() => {
    if (!clerkAuth.isSignedIn || typeof clerkAuth.getToken !== 'function') {
      api.clearToken()
      return
    }

    let active = true
    const syncToken = async () => {
      try {
        const token = await clerkAuth.getToken()
        if (!active) return
        if (token) {
          api.setToken(token)
        } else {
          api.clearToken()
        }
      } catch {
        if (active) api.clearToken()
      }
    }

    void syncToken()
    const interval = setInterval(syncToken, 50_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [clerkAuth.isSignedIn, clerkAuth.getToken])

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
    organization: {
      isLoaded: clerkOrganization.isLoaded,
      organization: clerkOrganization.organization ? {
        id: clerkOrganization.organization.id,
        name: clerkOrganization.organization.name,
        slug: clerkOrganization.organization.slug,
        imageUrl: clerkOrganization.organization.imageUrl,
      } : null,
      membership: clerkOrganization.membership ? {
        role: clerkOrganization.membership.role,
      } : null,
    },
    auth: clerkAuth,
    signOut: clerk.signOut,
    hardSignOut: async (options?: unknown) => {
      await clerk.signOut(options as never)
    },
    clerk,
  }), [clerk, clerkAuth, clerkOrganization, clerkUser, sessions])

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

/** True only inside the Allternit desktop shell (preload exposes window.allternit). */
export function isDesktopShell(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).allternit?.auth?.startLogin)
}

/**
 * Fires Clerk's OAuth redirect (e.g. ?strategy=oauth_google) exactly once per
 * browser session, then lets the normal <SignIn> component below complete the
 * OAuth callback when the provider returns to this page. Used by the desktop
 * startup wizard's "Continue with Google" button to jump straight to Google.
 */
function ClerkOAuthRedirectOnce({
  strategy,
  redirectCompleteUrl,
}: {
  strategy: "oauth_google"
  redirectCompleteUrl: string
}) {
  const { isLoaded, signIn } = useSignIn()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !signIn) return
    const guardKey = `allternit-oauth-redirect:${strategy}`
    if (sessionStorage.getItem(guardKey)) return
    sessionStorage.setItem(guardKey, "1")
    signIn
      .authenticateWithRedirect({
        strategy,
        redirectUrl: window.location.href,
        redirectUrlComplete: redirectCompleteUrl,
      })
      .catch((err) => {
        sessionStorage.removeItem(guardKey)
        const message = (err as { errors?: Array<{ message?: string }> })?.errors?.[0]?.message
        setError(message || "Unable to start Google sign-in")
      })
  }, [isLoaded, signIn, strategy, redirectCompleteUrl])

  if (error) {
    return <p className="m-0 mb-3 text-[13px] text-[#f87171] leading-relaxed">{error}</p>
  }
  return null
}

export function PlatformSignIn(props: {
  forceRedirectUrl?: string
  signUpForceRedirectUrl?: string
  signUpUrl?: string
}) {
  const location = useLocation()
  const { config: companyConfig } = useCompanyConfig()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const publishableKey = companyConfig?.clerkPublishableKey ?? ENV_PUBLISHABLE_KEY
  const selfHosted = companyConfig?.selfHosted ?? false
  const authDisabled = clerkDisabledByEnv || selfHosted || (!desktopAuthEnabled && !publishableKey)

  // Inside the desktop shell always offer the browser-backed desktop sign-in,
  // including on /sign-in itself — otherwise a signed-out shell dead-ends here.
  if (desktopAuthEnabled && isDesktopShell()) {

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
            "w-full p-3 px-4 rounded-[10px] border-none bg-[#1A1916] text-[#FAF9F7] text-[14px] font-bold transition-all",
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
  const strategy = new URLSearchParams(location.search).get("strategy")
  return (
    <>
      {strategy === "oauth_google" ? (
        <ClerkOAuthRedirectOnce strategy="oauth_google" redirectCompleteUrl={redirectUrl} />
      ) : null}
      <SignIn
        appearance={clerkAppearance}
        forceRedirectUrl={redirectUrl}
        routing="path"
        path={SIGN_IN_PATH}
        signUpForceRedirectUrl={props.signUpForceRedirectUrl || redirectUrl}
        signUpUrl={props.signUpUrl || SIGN_UP_PATH}
      />
    </>
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
  const selfHosted = companyConfig?.selfHosted ?? false
  const authDisabled = clerkDisabledByEnv || selfHosted || (!desktopAuthEnabled && !publishableKey)

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
      routing="path"
      path={SIGN_UP_PATH}
      signInForceRedirectUrl={props.signInForceRedirectUrl || redirectUrl}
      signInUrl={props.signInUrl || SIGN_IN_PATH}
    />
  )
}
