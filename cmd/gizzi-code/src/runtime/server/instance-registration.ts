// @ts-nocheck
// Tunnel self-registration for `gizzi serve --tunnel`. Once cloudflared hands
// us a public URL, we PUT it to the platform's instance registry so signed-in
// clients (iOS app) can discover this machine. Strictly best-effort: any
// failure logs a warning and never blocks or fails server startup.
//
// Token precedence:
// 1. Paired runtime-device token from runtime-device.json (`gizzi pair`).
//    Durable (~90 days), so registration is refreshed on an interval while the
//    server runs — this is the heartbeat that keeps the registry entry fresh.
//    The token is also rotated (Pairing.rotateIfNeeded) before each resolve
//    once it nears expiry, so the registry always sees the fresh token.
// 2. ALLTERNIT_API_TOKEN env var (outbound Bearer convention)
// 3. Stored Clerk session JWT from the browser login bridge (auth.json
//    wellknown entries). These are short-lived (~60s), so the JWT payload is
//    decoded and expired tokens are treated as missing.
// Clerk/env-token registration stays one-shot: those tokens die too quickly
// for a refresh loop to mean anything.
import os from "node:os"
import { Log } from "@/shared/util/log"
import { Flag } from "@/runtime/context/flag/flag"
import { Auth } from "@/runtime/integrations/auth"
import { Pairing } from "@/runtime/services/pairing/pairing"

export namespace InstanceRegistration {
  const log = Log.create({ service: "instance-registration" })

  const REGISTER_TIMEOUT_MS = 10_000
  // Re-PUT cadence when a durable device token is in use; env override exists
  // for tests (GIZZI_REGISTER_INTERVAL_MS).
  const REGISTER_INTERVAL_MS = Number(process.env.GIZZI_REGISTER_INTERVAL_MS) || 5 * 60 * 1000

  let refreshTimer: ReturnType<typeof setInterval> | undefined

  // Decodes the JWT payload segment (base64url, no library) and returns true
  // only when the token carries an `exp` that is still in the future.
  function isUsableJwt(token: string): boolean {
    const parts = token.split(".")
    if (parts.length !== 3) return false
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))
      return typeof payload.exp === "number" && payload.exp * 1000 > Date.now()
    } catch {
      return false
    }
  }

  async function resolveToken(): Promise<{ token: string; durable: boolean; name?: string } | undefined> {
    const device = await Pairing.load()
    if (Pairing.tokenUsable(device)) {
      return { token: device.deviceToken!, durable: true, name: device.name }
    }
    const envToken = process.env.ALLTERNIT_API_TOKEN?.trim()
    if (envToken) return { token: envToken, durable: false }
    // auth.json wellknown entries are keyed by the platform URL the user logged
    // in against; any of them holds a Clerk session JWT accepted by the registry.
    const all = await Auth.all()
    for (const info of Object.values(all)) {
      if (info.type !== "wellknown" || !info.token) continue
      if (!isUsableJwt(info.token)) continue
      return { token: info.token, durable: false }
    }
    return undefined
  }

  async function putRegistration(token: string, name: string, url: string): Promise<boolean> {
    const platform = Flag.GIZZI_PLATFORM_API_URL.replace(/\/+$/, "")
    try {
      const response = await fetch(`${platform}/api/v1/gizzi-instances/self`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url, name }),
        signal: AbortSignal.timeout(REGISTER_TIMEOUT_MS),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => "")
        log.warn("instance registration failed", { status: response.status, body })
        if (response.status === 401) {
          log.warn("the registry rejected the credential; if this machine was paired, run `gizzi pair` to re-pair")
        }
        return false
      }
      log.info(`gizzi instance registered as ${name} (${url})`)
      return true
    } catch (err) {
      log.warn("instance registration failed", { error: err instanceof Error ? err.message : String(err) })
      return false
    }
  }

  export async function register(opts: { url: string; name?: string }): Promise<void> {
    // Rotate a soon-to-expire device token before resolving, so the very first
    // registration PUT already carries the fresh token. Best-effort: a failed
    // rotation leaves the old token in place and registration proceeds with it.
    await Pairing.rotateIfNeeded()
    const credential = await resolveToken()
    if (!credential) {
      log.warn(
        "no auth token available; this instance will not be discoverable by the iOS app. " +
          "Run `gizzi pair` to pair this machine as a runtime device (preferred), " +
          "run the TUI login flow (gizzi), or set ALLTERNIT_API_TOKEN to a valid token.",
      )
      return
    }

    const name = credential.name ?? opts.name ?? os.hostname()
    await putRegistration(credential.token, name, opts.url)

    // Only the durable device token gets a refresh loop; Clerk JWTs and env
    // tokens are short-lived and stay one-shot.
    if (credential.durable) {
      stop()
      refreshTimer = setInterval(async () => {
        // Cheap local expiry check on every tick; only hits the network when
        // the token is actually within the rotation window.
        await Pairing.rotateIfNeeded()
        const current = await resolveToken()
        if (!current?.durable) {
          log.warn("paired device token no longer usable; stopping registration refresh. Run `gizzi pair` to re-pair.")
          stop()
          return
        }
        await putRegistration(current.token, current.name ?? name, opts.url)
      }, REGISTER_INTERVAL_MS)
      refreshTimer.unref()
    }
  }

  // Clears the refresh loop. Called from Server.stop alongside Tunnel.stop so a
  // graceful shutdown never leaves the interval dangling (it is also unref'd,
  // so it can never keep the process alive on its own).
  export function stop() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = undefined
    }
  }
}
