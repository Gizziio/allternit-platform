// @ts-nocheck
import { Hono } from "hono"
import { upgradeWebSocket } from "hono/bun"
import { describeRoute, validator, resolver } from "@/runtime/server/openapi"
import z from "zod/v4"
import { Pty } from "@/runtime/integrations/pty"
import { PtyPortWatch } from "@/runtime/integrations/pty/port-watch"
import { errors } from "@/runtime/server/error"

const decoder = new TextDecoder()

// ── Dev-server preview: short-lived capability tokens ──────────────────────
// Mirrors terminal-clerk-auth.ts's in-memory random-secret + TTL + Map
// pattern (the only precedent for short-lived tokens in this codebase) —
// scoped to one pty+port pair rather than a login session. Minting requires
// the normal Bearer auth already enforced globally; the token itself just
// says "may fetch this pty's this port for a few minutes," carried via
// query param on the WKWebView's first request and via cookie afterward
// (see the `/preview` relay below — a WKWebView can't attach a header to
// the sub-resource requests a loaded page's own JS/CSS/images trigger, but
// it does forward cookies for same-origin requests).
const PREVIEW_TOKEN_TTL_MS = 5 * 60 * 1000
const PREVIEW_TOKEN_RETENTION_MS = 15 * 60 * 1000

type PreviewTokenState = {
  ptyID: string
  port: number
  expiresAt: number
}

const previewTokens = new Map<string, PreviewTokenState>()

function randomPreviewToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("hex")
}

function cleanupPreviewTokens() {
  const cutoff = Date.now() - PREVIEW_TOKEN_RETENTION_MS
  for (const [token, state] of previewTokens.entries()) {
    if (state.expiresAt < cutoff) previewTokens.delete(token)
  }
}

/// Valid only for the exact ptyID+port it was minted for, and not expired.
function checkPreviewToken(token: string | undefined, ptyID: string, port: number): boolean {
  if (!token) return false
  const state = previewTokens.get(token)
  if (!state) return false
  if (state.ptyID !== ptyID || state.port !== port) return false
  return state.expiresAt >= Date.now()
}

/// Parses `gizzi_preview=<token>` out of a raw Cookie header.
function readPreviewCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === "gizzi_preview") return rest.join("=")
  }
  return undefined
}

// Adapt hono's WSContext to the minimal Socket shape Pty.connect expects. A
// unique connId is attached so Pty.connect's cross-connection guard works even
// if a client object were ever reused.
function toSocket(ws: any, connId: string) {
  return {
    readyState: 1,
    data: { connId },
    send: (data: string | Uint8Array | ArrayBuffer) => ws.send(data),
    close: (code?: number, reason?: string) => ws.close(code, reason),
  }
}

export const PtyRoutes = () =>
  new Hono()
    .get(
      "/list",
      describeRoute({
        summary: "List PTYs",
        description: "Retrieve a list of all active PTY (Pseudo-Terminal) sessions.",
        operationId: "pty.list",
        responses: {
          200: {
            description: "List of active PTYs",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        const ptys = await Pty.list()
        return c.json(ptys)
      },
    )
    .post(
      "/create",
      describeRoute({
        summary: "Create PTY",
        description: "Create a new PTY (Pseudo-Terminal) session.",
        operationId: "pty.create",
        responses: {
          200: {
            description: "Newly created PTY session",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", z.any()),
      async (c) => {
        const input = c.req.valid("json") as any
        const pty = await Pty.create(input)
        return c.json(pty)
      },
    )
    .get(
      "/:ptyID/connect",
      describeRoute({
        summary: "Connect to PTY (WebSocket)",
        description:
          "Upgrade to a WebSocket and attach to the PTY's live output. Replays scrollback first, then streams raw terminal output. Send text/binary messages to write input. Optional `cursor` query param is reserved for incremental scrollback resume.",
        operationId: "pty.connect",
        responses: {
          101: {
            description: "WebSocket upgrade",
          },
        },
      }),
      upgradeWebSocket((c) => {
        const ptyID = c.req.param("ptyID")
        const cursorParam = c.req.query("cursor")
        const cursor = cursorParam === undefined ? undefined : Number(cursorParam)
        const connId = `${ptyID}:${Date.now()}:${Math.random().toString(36).slice(2)}`
        let bridge: { onMessage?: (message: string | ArrayBuffer) => void; onClose?: () => void } | undefined
        return {
          async onOpen(_evt, ws) {
            bridge = await Pty.connect(ptyID, toSocket(ws, connId), Number.isFinite(cursor) ? cursor : undefined)
            if (!bridge) ws.close()
          },
          onMessage(evt) {
            if (!bridge?.onMessage) return
            const data = evt.data
            bridge.onMessage(typeof data === "string" ? data : decoder.decode(data as ArrayBuffer))
          },
          onClose() {
            bridge?.onClose?.()
          },
        }
      }),
    )
    .get(
      describeRoute({
        summary: "Get PTY details",
        description: "Retrieve detailed information about a specific PTY session by its ID.",
        operationId: "pty.get",
        responses: {
          200: {
            description: "PTY details",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.any()),
      async (c) => {
        const { ptyID } = c.req.valid("param") as any
        const pty = await Pty.get(ptyID)
        return c.json(pty)
      },
    )
    .put(
      "/:ptyID",
      describeRoute({
        summary: "Update PTY",
        description: "Update a PTY session — rename it or resize the terminal (size: { rows, cols }).",
        operationId: "pty.update",
        responses: {
          200: {
            description: "Updated PTY session",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.any()),
      validator("json", z.any()),
      async (c) => {
        const { ptyID } = c.req.valid("param") as any
        const input = c.req.valid("json") as any
        const pty = await Pty.update(ptyID, input)
        return c.json(pty)
      },
    )
    .delete(
      "/:ptyID",
      describeRoute({
        summary: "Kill PTY",
        description: "Terminate an active PTY (Pseudo-Terminal) session.",
        operationId: "pty.kill",
        responses: {
          200: {
            description: "PTY terminated successfully",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.any()),
      async (c) => {
        const { ptyID } = c.req.valid("param") as any
        await Pty.remove(ptyID)
        return c.json(true)
      },
    )
    .get(
      "/:ptyID/ports",
      describeRoute({
        summary: "List detected dev-server ports",
        description:
          "Best-effort list of TCP ports opened by processes whose cwd is under this PTY's own working directory (e.g. `npm run dev` started inside the session). macOS/Linux only — always empty on Windows.",
        operationId: "pty.ports",
        responses: {
          200: {
            description: "Currently detected ports",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.any()),
      async (c) => {
        const { ptyID } = c.req.valid("param") as any
        const info = await Pty.get(ptyID)
        if (!info) return c.json({ error: "PTY not found" }, 404)
        const ports = await PtyPortWatch.detect(ptyID, info.pid)
        return c.json(ports)
      },
    )
    .post(
      "/:ptyID/preview/token",
      describeRoute({
        summary: "Mint a dev-server preview token",
        description:
          "Short-lived (5 minute) capability token scoped to one PTY+port pair, for the `/preview` relay's initial load — see `/preview/:port/*` below.",
        operationId: "pty.previewToken",
        responses: {
          200: {
            description: "Minted token",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.any()),
      validator("json", z.any()),
      async (c) => {
        const { ptyID } = c.req.valid("param") as any
        const { port } = c.req.valid("json") as any
        if (typeof port !== "number" || !Number.isInteger(port) || port <= 0) {
          return c.json({ error: "port must be a positive integer" }, 400)
        }
        const info = await Pty.get(ptyID)
        if (!info) return c.json({ error: "PTY not found" }, 404)

        cleanupPreviewTokens()
        const detected = await PtyPortWatch.detect(ptyID, info.pid)
        if (!detected.some((p) => p.port === port)) {
          return c.json({ error: "Port is not currently open for this PTY" }, 400)
        }

        const token = randomPreviewToken()
        const expiresAt = Date.now() + PREVIEW_TOKEN_TTL_MS
        previewTokens.set(token, { ptyID, port, expiresAt })
        return c.json({ token, expiresAt: new Date(expiresAt).toISOString() })
      },
    )
    .get(
      "/:ptyID/preview/:port/:assetPath{.*}",
      describeRoute({
        summary: "Relay a dev-server preview",
        description:
          "Server-side fetch of `http://127.0.0.1:<port>/<assetPath>` on this machine, relayed back unmodified (HTML gets a <base> tag injected so relative asset/link paths keep resolving through this same route). The phone never reaches the dev server directly — only this already-authenticated connection to gizzi-code itself. Auth via `token` query param on the first request or the `gizzi_preview` cookie it sets in response afterward.",
        operationId: "pty.preview",
        responses: {
          200: { description: "Relayed response" },
          ...errors(400, 403, 404, 502),
        },
      }),
      validator("param", z.any()),
      async (c) => {
        const { ptyID, port: portParam, assetPath } = c.req.valid("param") as any
        const port = Number(portParam)
        if (!Number.isInteger(port) || port <= 0) {
          return c.json({ error: "port must be a positive integer" }, 400)
        }

        const info = await Pty.get(ptyID)
        if (!info) return c.json({ error: "PTY not found" }, 404)

        const incomingURL = new URL(c.req.url)
        const queryToken = incomingURL.searchParams.get("token") ?? undefined
        incomingURL.searchParams.delete("token")

        const cookieToken = readPreviewCookie(c.req.header("cookie"))
        const token = cookieToken ?? queryToken
        if (!checkPreviewToken(token, ptyID, port)) {
          return c.json({ error: "Invalid or expired preview token" }, 403)
        }

        // Re-check the port is still one this PTY's process tree actually
        // holds open — the token proves intent at mint time, this proves
        // it's still true now.
        const detected = await PtyPortWatch.detect(ptyID, info.pid)
        if (!detected.some((p) => p.port === port)) {
          return c.json({ error: "Port is no longer open for this PTY" }, 403)
        }

        const upstreamPath = `/${assetPath ?? ""}${incomingURL.search}`

        let upstream: Response
        try {
          upstream = await fetch(`http://127.0.0.1:${port}${upstreamPath}`, {
            redirect: "follow",
            signal: AbortSignal.timeout(15_000),
          })
        } catch (err: any) {
          const message = err?.name === "TimeoutError" ? "Dev server request timed out" : "Failed to reach dev server"
          return c.json({ error: message }, 502)
        }

        const contentType = upstream.headers.get("content-type") ?? ""
        const isHtml = contentType.includes("text/html") || contentType === ""

        const responseHeaders = new Headers()
        for (const [key, value] of upstream.headers.entries()) {
          const lower = key.toLowerCase()
          if (lower === "content-encoding") continue
          if (lower === "transfer-encoding") continue
          if (lower === "connection") continue
          if (lower === "set-cookie") continue // never forward the dev server's own cookies
          responseHeaders.set(key, value)
        }
        // First successful request (query-param token, no cookie yet) sets
        // the cookie every subsequent same-origin sub-resource load will
        // carry automatically.
        if (!cookieToken && queryToken) {
          const cookiePath = `/v1/pty/${encodeURIComponent(ptyID)}/preview/${port}`
          responseHeaders.append(
            "Set-Cookie",
            `gizzi_preview=${queryToken}; Path=${cookiePath}; Max-Age=${Math.floor(PREVIEW_TOKEN_TTL_MS / 1000)}; HttpOnly; SameSite=Lax`,
          )
        }

        if (!isHtml) {
          return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders })
        }

        let bodyText: string
        try {
          bodyText = await upstream.text()
        } catch {
          return c.json({ error: "Failed to read dev server response" }, 502)
        }

        // Relative asset/link paths keep resolving through THIS relay route
        // — same <base> technique web-proxy.ts uses (web-proxy.ts:159-219),
        // sized down: no nav-link rewriting or JS-navigation interception,
        // since this is our own dev server, not an arbitrary third-party
        // site being sandboxed inside an iframe. Trailing slash matters —
        // relative resolution against a base whose path doesn't end in "/"
        // replaces the last segment instead of extending it.
        const baseHref = `/v1/pty/${encodeURIComponent(ptyID)}/preview/${port}/`
        const baseTag = `<base href="${baseHref}">`
        if (/<head(\s[^>]*)?>/i.test(bodyText)) {
          bodyText = bodyText.replace(/(<head(\s[^>]*)?>)/i, `$1${baseTag}`)
        } else if (/<html(\s[^>]*)?>/i.test(bodyText)) {
          bodyText = bodyText.replace(/(<html(\s[^>]*)?>)/i, `$1<head>${baseTag}</head>`)
        } else {
          bodyText = `<head>${baseTag}</head>\n${bodyText}`
        }

        responseHeaders.set("Content-Type", "text/html; charset=utf-8")
        return new Response(bodyText, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders })
      },
    )
