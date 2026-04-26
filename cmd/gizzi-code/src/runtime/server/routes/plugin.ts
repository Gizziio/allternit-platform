/**
 * Plugin marketplace routes
 *
 * GET  /plugin          — list installed plugins + registry catalog
 * POST /plugin/install  — install a plugin (add to config + bun install)
 * POST /plugin/remove   — remove a plugin from config
 * GET  /plugin/registry — full curated + remote registry (categories, metadata)
 */

import { Hono } from "hono"
import z from "zod/v4"
import { validator } from "@/runtime/server/openapi"
import { Config } from "@/runtime/context/config/config"
import { Global } from "@/runtime/context/global"
import { Filesystem } from "@/shared/util/filesystem"
import { BunProc } from "@/shared/bun"
import { PluginRegistry } from "@/runtime/integrations/plugin/registry"
import { Log } from "@/shared/util/log"
import { modify, applyEdits } from "jsonc-parser"
import path from "path"

const log = Log.create({ service: "plugin-routes" })

async function getConfigPath(): Promise<string> {
  const candidates = [
    path.join(Global.Path.config, "gizzi.jsonc"),
    path.join(Global.Path.config, "gizzi.json"),
    path.join(Global.Path.config, "config.json"),
  ]
  for (const p of candidates) {
    if (await Filesystem.exists(p)) return p
  }
  return candidates[1]
}

async function getInstalledList(): Promise<string[]> {
  const config = await Config.global()
  return (config as any).plugin ?? []
}

async function writeInstalledList(plugins: string[]): Promise<void> {
  const configPath = await getConfigPath()
  let text = "{}"
  if (await Filesystem.exists(configPath)) {
    text = await Filesystem.readText(configPath)
  }
  const edits = modify(text, ["plugin"], plugins, {
    formattingOptions: { tabSize: 2, insertSpaces: true },
  })
  await Filesystem.write(configPath, applyEdits(text, edits))
}

export function PluginRoutes() {
  return new Hono()

    // ── GET /plugin — installed plugins + status ──────────────────────────
    .get("/", async (c) => {
      const installed = await getInstalledList()
      const registry = await PluginRegistry.all().catch(() => PluginRegistry.curated())

      const installedNames = new Set(
        installed.map((p) => {
          const lastAt = p.lastIndexOf("@")
          return lastAt > 0 ? p.substring(0, lastAt) : p
        }),
      )

      return c.json({
        installed,
        registry: registry.map((e) => ({
          ...e,
          installed: installedNames.has(e.name),
        })),
      })
    })

    // ── GET /plugin/registry — full catalog (with remote refresh) ─────────
    .get("/registry", async (c) => {
      const category = c.req.query("category")
      const query = c.req.query("q")

      let entries = await PluginRegistry.all().catch(() => PluginRegistry.curated())
      if (category) entries = entries.filter((e) => e.category === category)
      if (query) entries = PluginRegistry.search(entries, query)

      return c.json({ entries, categories: PluginRegistry.categories(await PluginRegistry.all().catch(() => PluginRegistry.curated())) })
    })

    // ── POST /plugin/install — install and add to config ──────────────────
    .post(
      "/install",
      validator("json", z.object({ package: z.string() })),
      async (c) => {
        const { package: pkg } = c.req.valid("json" as never) as { package: string }
        log.info("installing plugin", { pkg })

        const lastAt = pkg.lastIndexOf("@")
        const pkgName = lastAt > 0 ? pkg.substring(0, lastAt) : pkg
        const version = lastAt > 0 ? pkg.substring(lastAt + 1) : "latest"

        try {
          // Install via BunProc (same as plugin.ts CLI + plugin loader)
          await BunProc.install(pkgName, version)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          log.error("plugin install failed", { pkg, error: msg })
          return c.json({ error: `Install failed: ${msg}` }, 500)
        }

        // Add to config
        const plugins = await getInstalledList()
        const existing = plugins.findIndex((p) => {
          const n = p.lastIndexOf("@") > 0 ? p.substring(0, p.lastIndexOf("@")) : p
          return n === pkgName
        })

        if (existing >= 0) {
          plugins[existing] = pkg
        } else {
          plugins.push(pkg)
        }

        await writeInstalledList(plugins)
        log.info("plugin installed and added to config", { pkg })

        return c.json({ ok: true, installed: plugins })
      },
    )

    // ── POST /plugin/remove — remove from config ──────────────────────────
    .post(
      "/remove",
      validator("json", z.object({ package: z.string() })),
      async (c) => {
        const { package: pkg } = c.req.valid("json" as never) as { package: string }

        const pkgName = pkg.lastIndexOf("@") > 0 ? pkg.substring(0, pkg.lastIndexOf("@")) : pkg
        const plugins = await getInstalledList()

        const filtered = plugins.filter((p) => {
          const n = p.lastIndexOf("@") > 0 ? p.substring(0, p.lastIndexOf("@")) : p
          return n !== pkgName
        })

        if (filtered.length === plugins.length) {
          return c.json({ error: `Plugin "${pkg}" not found in config` }, 404)
        }

        await writeInstalledList(filtered)
        log.info("plugin removed from config", { pkg })

        return c.json({ ok: true, installed: filtered })
      },
    )
}
