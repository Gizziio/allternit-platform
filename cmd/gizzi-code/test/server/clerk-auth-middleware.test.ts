/**
 * Auth hardening tests: ClerkAuth middleware token acceptance parity,
 * shared server-exposure guard, and the GIZZI_DEV_CORS gate.
 *
 * Flag values freeze when the flag module is first evaluated, so the env
 * vars below are set before the dynamic src/ imports in beforeAll — do not
 * add static src/ imports to this file. GIZZI_DEV_CORS is a dynamic getter
 * (see flag.ts), so the dev-CORS tests toggle it per-test.
 */
import { afterEach, beforeAll, describe, expect, test } from "bun:test"

process.env.GIZZI_REQUIRE_CLERK_AUTH = "true"
process.env.GIZZI_SERVER_PASSWORD = "test-password"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ClerkAuth: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Hono: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Server: any

const originalFetch = globalThis.fetch

function stubFetch(impl: (url: unknown, init?: unknown) => Promise<Response>) {
  globalThis.fetch = impl as typeof fetch
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

beforeAll(async () => {
  ClerkAuth = (await import("../../src/runtime/server/middleware/clerk-auth")).ClerkAuth
  Hono = (await import("hono")).Hono
  Server = (await import("../../src/runtime/server/server")).Server
  app = new Hono()
    .use(ClerkAuth.middleware())
    .get("/t", (c: any) => c.json({ ok: true, user: c.get("clerkUser") ?? null }))
})

const AUTHED = { authorization: `Basic ${btoa("gizzi:test-password")}` }

describe("ClerkAuth.middleware — Bearer alt_ Allternit gateway tokens", () => {
  test("valid alt_ token is accepted and sets clerkUser", async () => {
    stubFetch(async () => new Response(JSON.stringify({ valid: true, user_id: "u_123", name: "Dev" }), { status: 200 }))
    const res = await app.request("http://localhost/t", {
      headers: { authorization: "Bearer alt_validtoken123" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toEqual({ id: "u_123", name: "Dev" })
  })

  test("invalid alt_ token gets 401, not a Clerk JWKS attempt", async () => {
    let called = false
    stubFetch(async () => {
      called = true
      return new Response(JSON.stringify({ valid: false }), { status: 200 })
    })
    const res = await app.request("http://localhost/t", {
      headers: { authorization: "Bearer alt_revokedtoken" },
    })
    expect(res.status).toBe(401)
    expect(called).toBe(true)
  })

  test("unreachable validation endpoint fails closed with 401", async () => {
    stubFetch(async () => {
      throw new Error("network down")
    })
    const res = await app.request("http://localhost/t", {
      headers: { authorization: "Bearer alt_anything" },
    })
    expect(res.status).toBe(401)
  })

  test("validation endpoint HTTP error fails closed with 401", async () => {
    stubFetch(async () => new Response("boom", { status: 502 }))
    const res = await app.request("http://localhost/t", {
      headers: { authorization: "Bearer alt_anything" },
    })
    expect(res.status).toBe(401)
  })
})

describe("ClerkAuth.middleware — unauthenticated 401 parity", () => {
  test("no credentials with GIZZI_REQUIRE_CLERK_AUTH set → 401", async () => {
    const res = await app.request("http://localhost/t")
    expect(res.status).toBe(401)
    // GIZZI_SERVER_PASSWORD is also set in this file, so the challenge is
    // Basic-auth first; Bearer validation applies to Authorization headers.
    expect(res.headers.get("WWW-Authenticate")).toBe('Basic realm="Secure Area"')
  })

  test("wrong basic-auth password → 401", async () => {
    const res = await app.request("http://localhost/t", {
      headers: { authorization: `Basic ${btoa("gizzi:wrong")}` },
    })
    expect(res.status).toBe(401)
  })

  test("correct basic-auth password → 200", async () => {
    const res = await app.request("http://localhost/t", { headers: AUTHED })
    expect(res.status).toBe(200)
  })

  test("OPTIONS preflight passes without credentials", async () => {
    const res = await app.request("http://localhost/t", { method: "OPTIONS" })
    expect(res.status).not.toBe(401)
  })
})

describe("ClerkAuth.middleware — alt_ token result caching", () => {
  test("second request with same token does not re-hit the validation endpoint", async () => {
    let calls = 0
    stubFetch(async () => {
      calls++
      return new Response(JSON.stringify({ valid: true, user_id: "u_cached" }), { status: 200 })
    })
    const headers = { authorization: "Bearer alt_cachedtoken" }
    await app.request("http://localhost/t", { headers })
    await app.request("http://localhost/t", { headers })
    expect(calls).toBe(1)
  })
})

describe("server CORS — default allowlist policy (GIZZI_DEV_CORS off)", () => {
  test("disallowed origin gets no Access-Control-Allow-Origin", async () => {
    delete process.env.GIZZI_DEV_CORS
    const res = await Server.App().fetch(
      new Request("http://localhost/health", { headers: { ...AUTHED, origin: "https://evil.example" } }),
    )
    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })

  test("loopback dev origin is reflected", async () => {
    delete process.env.GIZZI_DEV_CORS
    const res = await Server.App().fetch(
      new Request("http://localhost/health", { headers: { ...AUTHED, origin: "http://localhost:5173" } }),
    )
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173")
  })

  test("unauthenticated 401 still carries CORS headers for allowed origins", async () => {
    delete process.env.GIZZI_DEV_CORS
    const res = await Server.App().fetch(
      new Request("http://localhost/health", { headers: { origin: "http://127.0.0.1:5173" } }),
    )
    expect(res.status).toBe(401)
    expect(res.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173")
  })
})

describe("server CORS — GIZZI_DEV_CORS gate", () => {
  test("arbitrary origin is reflected only because the dev flag is set", async () => {
    process.env.GIZZI_DEV_CORS = "true"
    try {
      const res = await Server.App().fetch(
        new Request("http://localhost/health", { headers: { origin: "https://evil.example" } }),
      )
      expect(res.headers.get("access-control-allow-origin")).toBe("https://evil.example")
    } finally {
      delete process.env.GIZZI_DEV_CORS
    }
  })
})

describe("assertSafeServerExposure — shared by `gizzi serve` and `gizzi web`", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exposure: any
  beforeAll(async () => {
    exposure = await import("../../src/cli/server-exposure")
  })

  // This file sets GIZZI_SERVER_PASSWORD / GIZZI_REQUIRE_CLERK_AUTH for the
  // auth tests; the exposure tests exercise the unauthenticated path, so
  // hide those vars for their duration.
  function withoutAuthEnv(fn: () => void) {
    const savedPassword = process.env.GIZZI_SERVER_PASSWORD
    const savedRequire = process.env.GIZZI_REQUIRE_CLERK_AUTH
    delete process.env.GIZZI_SERVER_PASSWORD
    delete process.env.GIZZI_REQUIRE_CLERK_AUTH
    try {
      fn()
    } finally {
      if (savedPassword === undefined) delete process.env.GIZZI_SERVER_PASSWORD
      else process.env.GIZZI_SERVER_PASSWORD = savedPassword
      if (savedRequire === undefined) delete process.env.GIZZI_REQUIRE_CLERK_AUTH
      else process.env.GIZZI_REQUIRE_CLERK_AUTH = savedRequire
    }
  }

  test("loopback bind without auth is allowed", () => {
    withoutAuthEnv(() => {
      expect(() => exposure.assertSafeServerExposure({ command: "web", hostname: "127.0.0.1" })).not.toThrow()
      expect(() => exposure.assertSafeServerExposure({ command: "web", hostname: "localhost" })).not.toThrow()
    })
  })

  test("non-loopback bind without auth throws", () => {
    withoutAuthEnv(() => {
      expect(() => exposure.assertSafeServerExposure({ command: "web", hostname: "0.0.0.0" })).toThrow(
        /Refusing to expose an unauthenticated Gizzi server/,
      )
      expect(() =>
        exposure.assertSafeServerExposure({ command: "serve", hostname: "0.0.0.0", tunnel: false }),
      ).toThrow(/GIZZI_SERVER_PASSWORD/)
    })
  })

  test("tunnel counts as exposed", () => {
    withoutAuthEnv(() => {
      expect(() =>
        exposure.assertSafeServerExposure({ command: "serve", hostname: "127.0.0.1", tunnel: true }),
      ).toThrow(/via --tunnel/)
    })
  })

  test("explicit --allow-insecure-network opt-out passes with a warning", () => {
    withoutAuthEnv(() => {
      expect(() =>
        exposure.assertSafeServerExposure({ command: "serve", hostname: "0.0.0.0", allowInsecureNetwork: true }),
      ).not.toThrow()
    })
  })
})
