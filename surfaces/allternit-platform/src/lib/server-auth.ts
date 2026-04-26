import { headers } from "next/headers"
import { validateAccessToken } from "@/lib/oauth-tokens"

const clerkDisabled = process.env.ALLTERNIT_PLATFORM_DISABLE_CLERK === "1"
type AuthState = {
  userId: string | null
  sessionId: string | null
  orgId: string | null
}

async function getDesktopAuth(): Promise<AuthState | null> {
  const requestHeaders = await headers()
  const bearerHeader =
    requestHeaders.get("x-allternit-desktop-access-token") ||
    requestHeaders.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null

  if (!bearerHeader) {
    return null
  }

  const payload = await validateAccessToken(bearerHeader)
  if (!payload) {
    console.warn("[server-auth] Desktop bearer present but access token validation failed")
    return null
  }

  console.info("[server-auth] Authenticated via desktop access token", {
    userId: payload.userId,
    clientId: payload.clientId,
  })
  return {
    userId: payload.userId,
    sessionId: null,
    orgId: null,
  }
}

async function getClerkBearerAuth(): Promise<AuthState | null> {
  const requestHeaders = await headers()
  const bearerHeader =
    requestHeaders.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    requestHeaders.get("x-clerk-session-token") ||
    null

  if (!bearerHeader) {
    return null
  }

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    return null
  }

  try {
    const { verifyToken } = await import("@clerk/backend")
    const claims = await verifyToken(bearerHeader, { secretKey })
    const userId = typeof claims.sub === "string" ? claims.sub : null

    if (!userId) {
      console.warn("[server-auth] Clerk bearer verified but no user id claim was present", {
        claimKeys: Object.keys(claims ?? {}),
      })
      return null
    }

    console.info("[server-auth] Authenticated via Clerk bearer token", {
      userId,
      sessionId: typeof claims.sid === "string" ? claims.sid : null,
      orgId: typeof claims.org_id === "string" ? claims.org_id : null,
      claimKeys: Object.keys(claims ?? {}),
    })
    return {
      userId,
      sessionId: typeof claims.sid === "string" ? claims.sid : null,
      orgId: typeof claims.org_id === "string" ? claims.org_id : null,
    }
  } catch (error) {
    console.warn("[server-auth] Clerk bearer verification failed", error)
    return null
  }
}

function isClerkContextError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.message.includes("clerkMiddleware") ||
    error.message.includes("auth() was called but Clerk can't detect usage of clerkMiddleware")
  )
}

export async function getAuth(): Promise<AuthState> {
  const desktopAuth = await getDesktopAuth()
  if (desktopAuth) {
    return desktopAuth
  }

  const clerkBearerAuth = await getClerkBearerAuth()
  if (clerkBearerAuth) {
    return clerkBearerAuth
  }

  if (clerkDisabled) {
    return { userId: "local-user", sessionId: null, orgId: null }
  }

  const clerkModule = await import("@clerk/nextjs/server").catch(async () =>
    import("@/stubs/clerk/nextjs-server"),
  )

  try {
    const authState = await clerkModule.auth() as unknown as AuthState
    console.info("[server-auth] Authenticated via Clerk server session", {
      userId: authState.userId,
      sessionId: authState.sessionId,
      orgId: authState.orgId,
    })
    return authState
  } catch (error) {
    if (isClerkContextError(error)) {
      console.warn("[server-auth] Clerk server session unavailable because middleware context was missing")
      return { userId: null, sessionId: null, orgId: null }
    }
    throw error
  }
}
