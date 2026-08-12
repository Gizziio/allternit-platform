/**
 * Brain Routes
 *
 * HTTP surface for provisioning and importing a hosted second brain from the
 * web UI. One request performs local init (if needed), authenticated creation
 * in allternit-api, remote linking, and an initial sync.
 *
 * Auth: an explicit Clerk Bearer token is forwarded to allternit-api when the
 * caller supplies one (web Clerk sessions). When no Bearer token is present
 * — the normal desktop/ACI case — gizzi-code falls back to its own
 * allternit-api auth (runtime device token or local-dev bootstrap), so the
 * desktop shell does not need to expose a Clerk JWT to the renderer.
 */

import { Hono } from "hono"
import {
  initBrain,
  cloneBrain,
  getBrainStatus,
  setBrainRemote,
  syncBrain,
  BrainError,
  DEFAULT_BRAIN_PATH,
} from "@/cli/commands/brain/lib"
import { getAllternitApiConfigWithDeviceToken, apiFetchJson } from "@/runtime/services/api/allternitApi"

async function createBrainRemote(explicitAuthHeader?: string): Promise<{
  brain_id: string
  clone_url: string
  created_at: string
}> {
  const config = await getAllternitApiConfigWithDeviceToken()
  const headers: Record<string, string> = {}
  if (explicitAuthHeader) {
    headers.Authorization = explicitAuthHeader
  } else if (config.token) {
    headers.Authorization = `Bearer ${config.token}`
  }
  return apiFetchJson<{
    brain_id: string
    clone_url: string
    created_at: string
  }>(config, "/api/v1/brains", {
    method: "POST",
    headers,
  })
}

async function provisionAt(path: string, explicitAuthHeader?: string) {
  const status = await getBrainStatus(path)
  if (!status.exists) {
    await initBrain(path)
  }

  const created = await createBrainRemote(explicitAuthHeader)
  await setBrainRemote(path, created.clone_url)
  const syncResult = await syncBrain(path)

  return {
    brain_id: created.brain_id,
    clone_url: created.clone_url,
    created_at: created.created_at,
    sync: syncResult,
  }
}

export function BrainRoutes() {
  return new Hono()
    .post("/provision", async (c) => {
      // In web mode the caller may forward its Clerk token explicitly; in
      // desktop/ACI mode gizzi-code's own allternit-api auth is used instead.
      const authHeader = c.req.header("authorization")
      const upstreamAuthHeader = authHeader?.startsWith("Bearer ") ? authHeader : undefined

      try {
        const result = await provisionAt(DEFAULT_BRAIN_PATH, upstreamAuthHeader)
        return c.json(result)
      } catch (err) {
        if (err instanceof BrainError) {
          return c.json(
            { name: "BrainError", message: err.message, data: {} },
            400,
          )
        }
        const message = err instanceof Error ? err.message : String(err)
        return c.json(
          { name: "InternalError", message, data: {} },
          500,
        )
      }
    })
    .post("/import", async (c) => {
      let body: { clone_url?: string }
      try {
        body = await c.req.json()
      } catch {
        return c.json({ name: "BadRequest", message: "JSON body required", data: {} }, 400)
      }
      const cloneUrl = body.clone_url?.trim()
      if (!cloneUrl) {
        return c.json({ name: "BadRequest", message: "clone_url is required", data: {} }, 400)
      }

      try {
        const status = await getBrainStatus(DEFAULT_BRAIN_PATH)
        if (status.exists) {
          return c.json(
            { name: "BrainError", message: "A second brain already exists at the default path", data: {} },
            409,
          )
        }

        await cloneBrain(DEFAULT_BRAIN_PATH, cloneUrl)
        const syncResult = await syncBrain(DEFAULT_BRAIN_PATH)

        return c.json({
          clone_url: cloneUrl,
          sync: syncResult,
        })
      } catch (err) {
        if (err instanceof BrainError) {
          return c.json(
            { name: "BrainError", message: err.message, data: {} },
            400,
          )
        }
        const message = err instanceof Error ? err.message : String(err)
        return c.json(
          { name: "InternalError", message, data: {} },
          500,
        )
      }
    })
}
