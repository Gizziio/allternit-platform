import { Hono } from "hono"
import { describeRoute, resolver, validator } from "@/runtime/server/openapi"
import z from "zod/v4"
import open from "open"
import { Log } from "@/shared/util/log"
import { Auth } from "@/runtime/integrations/auth"
import { errors } from "@/runtime/server/error"
import { lazy } from "@/shared/util/lazy"

const log = Log.create({ service: "terminal-clerk-auth" })

const SESSION_TTL_MS = 10 * 60 * 1000
const SESSION_RETENTION_MS = 60 * 60 * 1000
const DEFAULT_BRIDGE_PATH = "/terminal/clerk"

const StartInput = z.object({
  platformURL: z.string().min(1),
  bridgePath: z.string().optional(),
})

const CallbackParam = z.object({
  sessionID: z.string(),
})

const PollResponse = z.object({
  sessionID: z.string(),
  status: z.enum(["pending", "completed", "claimed", "failed", "expired"]),
  platformURL: z.string(),
  browserURL: z.string(),
  callbackURL: z.string(),
  expiresAt: z.number(),
  claimedAt: z.number().optional(),
  error: z.string().optional(),
  openError: z.string().optional(),
})

const StartResponse = PollResponse.extend({
  opened: z.boolean(),
  pollIntervalMs: z.number(),
})

type SessionStatus = "pending" | "completed" | "claimed" | "failed" | "expired"

type SessionState = {
  sessionID: string
  secret: string
  platformURL: string
  browserURL: string
  callbackURL: string
  status: SessionStatus
  token?: string
  error?: string
  openError?: string
  createdAt: number
  updatedAt: number
  expiresAt: number
  claimedAt?: number
}

const sessions = new Map<string, SessionState>()

function now() {
  return Date.now()
}

function normalizePlatformURL(value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error("A platform URL is required")

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(withProtocol)
  } catch {
    throw new Error("Invalid platform URL")
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Platform URL must use http:// or https://")
  }

  parsed.search = ""
  parsed.hash = ""
  parsed.pathname = parsed.pathname.replace(/\/+$/g, "")

  const normalized = parsed.toString()
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized
}

function normalizeBridgePath(value: string | undefined) {
  const raw = value?.trim()
  if (!raw) return DEFAULT_BRIDGE_PATH

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(raw)) return raw
  if (raw.startsWith("/")) return raw
  return `/${raw}`
}

function randomSecret() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("hex")
}

function cleanupSessions() {
  const cutoff = now() - SESSION_RETENTION_MS
  for (const [sessionID, session] of sessions.entries()) {
    if (session.updatedAt < cutoff) {
      sessions.delete(sessionID)
    }
  }
}

function setExpiredIfNeeded(session: SessionState) {
  if (session.status !== "pending") return
  if (session.expiresAt > now()) return
  session.status = "expired"
  session.error = "Login session expired"
  session.updatedAt = now()
}

function snapshot(session: SessionState) {
  setExpiredIfNeeded(session)
  return {
    sessionID: session.sessionID,
    status: session.status,
    platformURL: session.platformURL,
    browserURL: session.browserURL,
    callbackURL: session.callbackURL,
    expiresAt: session.expiresAt,
    claimedAt: session.claimedAt,
    error: session.error,
    openError: session.openError,
  }
}

function htmlPage(input: { title: string; body: string; color: string }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${input.title}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #0f1115; color: #d4d9e1; }
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { width: min(520px, 100%); border: 1px solid #2a2f3a; border-radius: 12px; background: #151a23; padding: 20px; }
    h1 { margin: 0 0 10px; font-size: 20px; color: ${input.color}; }
    p { margin: 0; line-height: 1.5; color: #b8c0cc; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>${input.title}</h1>
      <p>${input.body}</p>
    </div>
  </div>
  <script>setTimeout(() => window.close(), 2500)</script>
</body>
</html>`
}

function callbackResponse(input: { ok: boolean; message: string; status?: number }) {
  const html = htmlPage({
    title: input.ok ? "GIZZI Terminal Connected" : "GIZZI Terminal Login Failed",
    body: input.message,
    color: input.ok ? "#36d399" : "#f87171",
  })

  return new Response(html, {
    status: input.status ?? (input.ok ? 200 : 400),
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  })
}

async function readTokenFromCallbackRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    const payload = (await request.json().catch(() => ({}))) as { token?: unknown }
    if (typeof payload.token === "string" && payload.token.trim()) return payload.token.trim()
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => undefined)
    const value = formData?.get("token")
    if (typeof value === "string" && value.trim()) return value.trim()
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (token?.trim()) return token.trim()

  return ""
}

export const TerminalClerkAuthRoutes = lazy(() =>
  new Hono()
    .post(
      "/start",
      describeRoute({
        summary: "Start terminal Clerk login",
        description: "Create a pending terminal login request, then open Clerk sign-in in the browser.",
        operationId: "terminal.clerk.start",
        responses: {
          200: {
            description: "Pending login session created",
            content: {
              "application/json": {
                schema: resolver(StartResponse),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", StartInput),
      async (c) => {
        cleanupSessions()

        const input = c.req.valid("json")
        const platformURL = normalizePlatformURL(input.platformURL)
        const bridgePath = normalizeBridgePath(input.bridgePath)

        const sessionID = crypto.randomUUID()
        const secret = randomSecret()
        const origin = new URL(c.req.url).origin

        const callbackURL = new URL(`/auth/terminal/clerk/callback/${sessionID}`, origin)
        callbackURL.searchParams.set("secret", secret)

        const browserURL = new URL(bridgePath, platformURL)
        browserURL.searchParams.set("request_id", sessionID)
        browserURL.searchParams.set("callback_url", callbackURL.toString())
        browserURL.searchParams.set("platform_url", platformURL)

        const createdAt = now()
        const state: SessionState = {
          sessionID,
          secret,
          platformURL,
          browserURL: browserURL.toString(),
          callbackURL: callbackURL.toString(),
          status: "pending",
          createdAt,
          updatedAt: createdAt,
          expiresAt: createdAt + SESSION_TTL_MS,
        }
        sessions.set(sessionID, state)

        let opened = true
        try {
          await open(state.browserURL)
        } catch (error) {
          opened = false
          state.openError = error instanceof Error ? error.message : String(error)
          state.updatedAt = now()
          log.warn("failed to open browser for clerk login", {
            sessionID,
            platformURL,
            error: state.openError,
          })
        }

        return c.json({
          ...snapshot(state),
          opened,
          pollIntervalMs: 1200,
        })
      },
    )
    .get(
      "/poll/:sessionID",
      describeRoute({
        summary: "Poll terminal Clerk login",
        description: "Get the status for a pending terminal login request.",
        operationId: "terminal.clerk.poll",
        responses: {
          200: {
            description: "Current login status",
            content: {
              "application/json": {
                schema: resolver(PollResponse),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", CallbackParam),
      async (c) => {
        cleanupSessions()
        const { sessionID } = c.req.valid("param")
        const state = sessions.get(sessionID)
        if (!state) {
          return c.json({ name: "NotFound", message: "Unknown login session", data: {} }, { status: 404 })
        }
        return c.json(snapshot(state))
      },
    )
    .post(
      "/claim/:sessionID",
      describeRoute({
        summary: "Claim terminal Clerk login",
        description: "Persist completed Clerk login into local auth storage.",
        operationId: "terminal.clerk.claim",
        responses: {
          200: {
            description: "Credentials saved",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    sessionID: z.string(),
                    providerID: z.string(),
                    envKey: z.string(),
                    status: z.literal("claimed"),
                  }),
                ),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", CallbackParam),
      async (c) => {
        cleanupSessions()

        const { sessionID } = c.req.valid("param")
        const state = sessions.get(sessionID)
        if (!state) {
          return c.json({ name: "NotFound", message: "Unknown login session", data: {} }, { status: 404 })
        }

        setExpiredIfNeeded(state)

        if (state.status === "claimed") {
          const existing = await Auth.get(state.platformURL)
          const envKey = existing?.type === "wellknown" ? existing.key : ""
          return c.json({
            sessionID,
            providerID: state.platformURL,
            envKey,
            status: "claimed" as const,
          })
        }

        if (state.status !== "completed") {
          const message = state.error ?? `Login session is ${state.status}`
          return c.json({ name: "BadRequest", message, data: {} }, { status: 400 })
        }

        if (!state.token) {
          state.status = "failed"
          state.error = "Missing Clerk token"
          state.updatedAt = now()
          return c.json({ name: "BadRequest", message: state.error, data: {} }, { status: 400 })
        }

        const wellKnownURL = `${state.platformURL}/.well-known/gizzi`
        const wellKnownResponse = await fetch(wellKnownURL)
        if (!wellKnownResponse.ok) {
          const message = `Failed to read ${wellKnownURL} (${wellKnownResponse.status})`
          state.status = "failed"
          state.error = message
          state.updatedAt = now()
          return c.json({ name: "BadRequest", message, data: {} }, { status: 400 })
        }

        const wellKnown = (await wellKnownResponse.json()) as {
          auth?: {
            env?: unknown
          }
        }

        const envKey = typeof wellKnown.auth?.env === "string" ? wellKnown.auth.env.trim() : ""
        if (!envKey) {
          const message = "Platform did not provide auth.env in .well-known/gizzi"
          state.status = "failed"
          state.error = message
          state.updatedAt = now()
          return c.json({ name: "BadRequest", message, data: {} }, { status: 400 })
        }

        await Auth.set(state.platformURL, {
          type: "wellknown",
          key: envKey,
          token: state.token,
        })

        state.status = "claimed"
        state.claimedAt = now()
        state.updatedAt = state.claimedAt

        return c.json({
          sessionID,
          providerID: state.platformURL,
          envKey,
          status: "claimed" as const,
        })
      },
    )
    .post(
      "/callback/:sessionID",
      describeRoute({
        summary: "Complete terminal Clerk login",
        description: "Browser callback endpoint that posts Clerk token back to local runtime.",
        operationId: "terminal.clerk.callback",
        responses: {
          200: {
            description: "Login token accepted",
            content: {
              "text/html": {
                schema: resolver(z.string()),
              },
            },
          },
        },
      }),
      validator("param", CallbackParam),
      async (c) => {
        cleanupSessions()

        const { sessionID } = c.req.valid("param")
        const state = sessions.get(sessionID)
        if (!state) {
          return callbackResponse({
            ok: false,
            message: "Unknown or expired terminal login session.",
            status: 404,
          })
        }

        const secret = c.req.query("secret") ?? ""
        if (!secret || secret !== state.secret) {
          return callbackResponse({
            ok: false,
            message: "Invalid callback secret.",
            status: 403,
          })
        }

        setExpiredIfNeeded(state)

        if (state.status === "expired") {
          return callbackResponse({
            ok: false,
            message: "This terminal login session has expired. Start login again from GIZZI Code.",
            status: 400,
          })
        }

        if (state.status === "claimed" || state.status === "completed") {
          return callbackResponse({
            ok: true,
            message: "Sign-in already completed for this terminal session.",
          })
        }

        if (state.status === "failed") {
          return callbackResponse({
            ok: false,
            message: state.error ?? "Login session is in a failed state.",
            status: 400,
          })
        }

        const token = await readTokenFromCallbackRequest(c.req.raw)
        if (!token) {
          return callbackResponse({
            ok: false,
            message: "Missing Clerk session token in callback payload.",
            status: 400,
          })
        }

        state.token = token
        state.status = "completed"
        state.error = undefined
        state.updatedAt = now()

        return callbackResponse({
          ok: true,
          message: "Sign-in confirmed. Return to GIZZI Code; terminal setup will continue automatically.",
        })
      },
    ),
)
