/**
 * Organization access command
 *
 * Usage:
 *   gizzi org              # Show current user + organization profile
 *   gizzi org create       # Create a personal organization (self-hosted/no-Clerk fallback)
 */

import type { Argv } from "yargs"
import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { EOL } from "os"
import { Flag } from "@/runtime/context/flag/flag"

const API_BASE = Flag.GIZZI_PLATFORM_API_URL.replace(/\/+$/, "")

// Real shape of GET /api/v1/auth/me (allternit-cloud-api
// src/routes/auth.rs::get_current_user).
type AuthMeResponse = {
  user_id: string
  token_id?: string | null
  permissions?: string[]
  is_development?: boolean
}

async function apiCall<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE}${path}`
  let token = process.env.ALLTERNIT_API_TOKEN
  if (!token) {
    try {
      const fs = require("fs")
      const path = require("path")
      const os = require("os")
      const configDir = process.env.GIZZI_CONFIG_DIR ?? path.join(os.homedir(), ".config", "gizzi-code")
      const sessionPath = path.join(configDir, "session.json")
      if (fs.existsSync(sessionPath)) {
        const session = JSON.parse(fs.readFileSync(sessionPath, "utf8"))
        token = session?.accessToken || null
      }
    } catch {
      // Ignore reading error
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ""}`)
  }

  return (await response.json()) as T
}

const OrgShowCommand = cmd({
  command: "$0",
  describe: "show current user and organization profile",
  async handler() {
    const me = await apiCall<AuthMeResponse>("GET", "/api/v1/auth/me")

    UI.println(UI.Style.TEXT_BOLD + "User" + UI.Style.TEXT_NORMAL)
    UI.println(`  ID:          ${me.user_id}`)
    UI.println(`  Token ID:    ${me.token_id ?? "—"}`)
    UI.println(`  Permissions: ${me.permissions?.length ? me.permissions.join(", ") : "—"}`)
    UI.println(`  Environment: ${me.is_development ? "development" : "production"}`)

    UI.println("")
    UI.println(UI.Style.TEXT_BOLD + "Organization" + UI.Style.TEXT_NORMAL)
    UI.println(`  Organization details are not yet available from the platform API.`)
  },
})

const OrgCreateCommand = cmd({
  command: "create",
  describe: "create a personal organization (self-hosted / no-Clerk fallback)",
  async handler() {
    throw new Error(
      "`gizzi org create` is not yet available: the platform API does not expose an organization-creation route yet.",
    )
  },
})

export const OrgCommand = cmd({
  command: "org",
  describe: "organization and access management",
  builder: (yargs: Argv) => yargs.command(OrgShowCommand).command(OrgCreateCommand).demandCommand(),
  async handler() {},
})
