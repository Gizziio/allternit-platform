// @ts-nocheck
// Clerk JWT authentication for the standalone gizzi server (phase 1 of iOS
// direct-connect support). Port of cmd/allternit-api/src/auth.rs: JWKS is
// fetched from Clerk and cached (jose's remote JWK set handles TTL + refetch
// on unknown kid), tokens are verified as RS256 with an issuer check.
//
// Precedence (wired into server.ts in place of the old password-only block):
//   1. OPTIONS preflight                 → pass through
//   2. Authorization: Bearer <jwt>       → Clerk JWT validation (401 on failure)
//   3. GIZZI_SERVER_PASSWORD set         → existing HTTP basic auth
//   4. GIZZI_REQUIRE_CLERK_AUTH set      → 401 (Bearer token required)
//   5. otherwise                         → pass through (loopback dev mode)
import { createRemoteJWKSet, jwtVerify } from "jose"
import { basicAuth } from "hono/basic-auth"
import type { MiddlewareHandler } from "hono"
import { Flag } from "@/runtime/context/flag/flag"
import { Log } from "@/shared/util/log"
import { CLOUD_URLS } from "@/shared/constants/cloudUrls"

export namespace ClerkAuth {
  const log = Log.create({ service: "clerk-auth" })

  export const DEFAULT_JWKS_URL = `${CLOUD_URLS.clerk}/.well-known/jwks.json`
  export const DEFAULT_ISSUER = CLOUD_URLS.clerk

  export function jwksUrl(): string {
    return Flag.GIZZI_CLERK_JWKS_URL ?? DEFAULT_JWKS_URL
  }

  export function issuer(): string {
    return Flag.GIZZI_CLERK_ISSUER ?? DEFAULT_ISSUER
  }

  // Whether requests that carry no credentials at all are rejected. JWT
  // validation itself is always active (the defaults are working values), so
  // this flag is what turns "validates tokens when presented" into "requires
  // tokens" — used when the server is intentionally exposed without a
  // password (e.g. non-loopback bind or --tunnel).
  export function required(): boolean {
    return Flag.GIZZI_REQUIRE_CLERK_AUTH
  }

  export interface ClerkUser {
    id: string
    email?: string
    name?: string
    avatarUrl?: string
    orgId?: string
    orgRole?: string
    orgSlug?: string
  }

  // jose's createRemoteJWKSet caches keys and refetches on unknown kid
  // (mirrors JwksManager in auth.rs). Rebuilt if the configured URL changes.
  let cached: { url: string; jwks: ReturnType<typeof createRemoteJWKSet> } | undefined
  function jwks() {
    const url = jwksUrl()
    if (!cached || cached.url !== url) {
      cached = { url, jwks: createRemoteJWKSet(new URL(url)) }
    }
    return cached.jwks
  }

  export async function verify(token: string): Promise<ClerkUser> {
    const { payload } = await jwtVerify(token, jwks(), {
      issuer: issuer(),
      algorithms: ["RS256"],
    })
    // Clerk session token v2 org claim ("o") with v1 fallback (auth.rs parity).
    const org = payload.o as { id?: string; rol?: string; slg?: string } | undefined
    return {
      id: payload.sub!,
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
      avatarUrl: payload.image_url as string | undefined,
      orgId: org?.id ?? (payload.org_id as string | undefined),
      orgRole: org?.rol ?? (payload.org_role as string | undefined),
      orgSlug: org?.slg ?? (payload.org_slug as string | undefined),
    }
  }

  function unauthorized(c: any, message: string) {
    c.header("WWW-Authenticate", "Bearer")
    return c.json({ error: "unauthorized", message, requestID: c.get("requestID") }, 401)
  }

  export function middleware(): MiddlewareHandler {
    return async (c, next) => {
      // Allow CORS preflight requests to succeed without auth.
      if (c.req.method === "OPTIONS") return next()

      const header = c.req.header("authorization")
      if (header?.startsWith("Bearer ")) {
        const token = header.slice("Bearer ".length).trim()
        try {
          const user = await verify(token)
          c.set("clerkUser", user)
          return next()
        } catch (err) {
          log.warn("clerk jwt validation failed", {
            error: err instanceof Error ? err.message : String(err),
          })
          return unauthorized(c, "Invalid or expired Clerk token")
        }
      }

      const password = Flag.GIZZI_SERVER_PASSWORD
      if (password) {
        const username = Flag.GIZZI_SERVER_USERNAME ?? "gizzi"
        return basicAuth({ username, password })(c, next)
      }

      if (required()) return unauthorized(c, "Clerk Bearer token required")
      return next()
    }
  }
}
