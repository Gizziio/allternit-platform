/**
 * Allternit token classification helpers.
 *
 * The Allternit platform issues two kinds of bearer credentials:
 * - Scoped API keys minted by allternit-cloud-api, prefixed `alt_`, durable
 *   and sha256-hashed server-side. These are safe to store long-term.
 * - Clerk session JWTs (standard JWT shape, ~1 minute lifetime, refreshable).
 *   These are ephemeral; persisting them is a footgun.
 *
 * gizzi-code additionally mints its own local-only session tokens (prefixed
 * `gizzi_`) for the `gizzi server` / `gizzi serve` bearer auth. These are
 * never sent to any cloud service; the server that minted them validates
 * them locally.
 *
 * @module allternitToken
 */

import { randomBytes } from "crypto"

export type AllternitTokenKind = "apiKey" | "jwt" | "sessionToken" | "unknown"

export const GIZZI_SESSION_TOKEN_PREFIX = "gizzi_"

/**
 * Mint a local-only bearer token for gizzi server commands. Deliberately
 * uses the `gizzi_` prefix (not the cloud `alt_` prefix) so a locally minted
 * token can never be confused with an Allternit gateway API key — the
 * clerk-auth middleware sends `alt_` tokens to cloud validation, which a
 * local token would fail.
 */
export function mintGizziSessionToken(): string {
  return `${GIZZI_SESSION_TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`
}

export interface AllternitTokenInfo {
  kind: AllternitTokenKind
  expiresAt?: Date
}

const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/

function base64urlDecodeJson(segment: string): unknown {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  const binary =
    typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary")
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

export function classifyAllternitToken(token: string): AllternitTokenInfo {
  if (typeof token !== "string" || token.length === 0) return { kind: "unknown" }
  if (token.startsWith("alt_")) return { kind: "apiKey" }
  if (token.startsWith(GIZZI_SESSION_TOKEN_PREFIX)) return { kind: "sessionToken" }

  const segments = token.split(".")
  if (segments.length === 3 && segments.every((s) => s.length > 0 && BASE64URL_SEGMENT.test(s))) {
    try {
      const payload = base64urlDecodeJson(segments[1]) as { exp?: unknown }
      const exp = typeof payload?.exp === "number" ? payload.exp : undefined
      return { kind: "jwt", expiresAt: exp !== undefined ? new Date(exp * 1000) : undefined }
    } catch {
      return { kind: "jwt" }
    }
  }

  return { kind: "unknown" }
}

export function maskToken(token: string): string {
  if (typeof token !== "string" || token.length === 0) return "(empty)"
  if (token.length <= 10) return "*".repeat(token.length)
  return `${token.slice(0, 6)}…${token.slice(-4)}`
}
