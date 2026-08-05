/**
 * Vault Routes
 *
 * HTTP surface for the Lens context layer — lets a GUI (ai.allternit.com,
 * bundled into Allternit Desktop) manage connected sources without going
 * through the `gizzi vault ...` CLI. See docs/LENS_CONTEXT_LAYER_PLAN.md.
 */

import { Hono } from "hono"
import { validator } from "@/runtime/server/openapi"
import z from "zod/v4"
import { VaultManager } from "@/vault"
import { listConnectors, getConnector, runConnectorSync, getConnectorConfig } from "@/vault/connector"
import { loadSettings, saveSettings } from "@/vault/settings"

export function VaultRoutes() {
  return new Hono()
    // GET /vault/sources — every registered connector with enabled/connected status
    .get("/sources", async (c) => {
      const settings = await loadSettings()
      const sources = await Promise.all(
        listConnectors().map(async (connector) => {
          const status = await connector.status()
          const sourceSettings = settings.sources[connector.meta.id] ?? { enabled: false }
          return {
            id: connector.meta.id,
            name: connector.meta.name,
            description: connector.meta.description,
            authType: connector.meta.authType,
            enabled: sourceSettings.enabled,
            connected: status.connected,
            authenticated: status.authenticated,
            error: status.error ?? null,
            hasApiKey: typeof sourceSettings.apiKey === "string" && sourceSettings.apiKey.length > 0,
          }
        }),
      )
      return c.json({ sources })
    })

    // POST /vault/sources/:id/enable — { enabled: boolean }
    .post(
      "/sources/:id/enable",
      validator("json", z.object({ enabled: z.boolean() })),
      async (c) => {
        const { id } = c.req.param()
        const { enabled } = c.req.valid("json")
        if (!getConnector(id)) {
          return c.json({ name: "NotFound", message: `Unknown source: ${id}`, data: {} }, 404)
        }
        const settings = await loadSettings()
        settings.sources[id] = { ...(settings.sources[id] ?? {}), enabled }
        await saveSettings(settings)
        return c.json({ id, enabled })
      },
    )

    // POST /vault/sources/:id/credentials — { apiKey } for self-serve token sources
    // (Notion "Internal Integration Secret", Linear "Personal API Key", etc —
    // never used for OAuth sources like Gmail, which go through
    // `gizzi vault config auth/login` instead).
    .post(
      "/sources/:id/credentials",
      validator("json", z.object({ apiKey: z.string().min(1) })),
      async (c) => {
        const { id } = c.req.param()
        if (!getConnector(id)) {
          return c.json({ name: "NotFound", message: `Unknown source: ${id}`, data: {} }, 404)
        }
        const { apiKey } = c.req.valid("json")
        const settings = await loadSettings()
        settings.sources[id] = { ...(settings.sources[id] ?? { enabled: false }), apiKey }
        await saveSettings(settings)
        return c.json({ id, saved: true })
      },
    )

    // POST /vault/sources/:id/sync — run a sync now, return the result
    .post("/sources/:id/sync", async (c) => {
      const { id } = c.req.param()
      if (!getConnector(id)) {
        return c.json({ name: "NotFound", message: `Unknown source: ${id}`, data: {} }, 404)
      }
      const vault = new VaultManager()
      await vault.initialize()
      try {
        const result = await runConnectorSync(vault, id)
        return c.json(result)
      } finally {
        vault.close()
      }
    })

    // GET /vault/sources/:id/config — cadence + enabled state (debugging aid)
    .get("/sources/:id/config", async (c) => {
      const { id } = c.req.param()
      if (!getConnector(id)) {
        return c.json({ name: "NotFound", message: `Unknown source: ${id}`, data: {} }, 404)
      }
      const config = await getConnectorConfig(id)
      return c.json(config)
    })
}
