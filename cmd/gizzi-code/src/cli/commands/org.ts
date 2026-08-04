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

const API_BASE = process.env.Allternit_API_URL || "http://localhost:3001"

type UserProfile = {
  id: string
  clerk_id?: string | null
  email: string
  name?: string | null
  avatar_url?: string | null
  role: string
  status: string
  created_at: string
  organization_id?: string | null
  organization_role?: string | null
}

type ProfileResponse = { user: UserProfile }
type CreateOrgResponse = { organization_id: string; created: boolean }

async function apiCall<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE}${path}`
  let token = process.env.Allternit_API_TOKEN
  if (!token) {
    try {
      const fs = require("fs")
      const path = require("path")
      const os = require("os")
      const sessionPath = path.join(os.homedir(), ".config", "gizzi", "session.json")
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

  if (process.env.Allternit_DEV_MODE === "true") {
    headers["x-allternit-user-id"] = "gizzi-agent-1"
    headers["x-allternit-desktop-access-token"] = "dev-bootstrap-token"
    headers["x-allternit-user-email"] = "test@allternit.com"
    headers["x-allternit-user-name"] = "Org Tester"
  } else if (token) {
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

function normalizeRole(role?: string | null): string {
  return role?.replace(/^org:/, "") || "member"
}

const OrgShowCommand = cmd({
  command: "$0",
  describe: "show current user and organization profile",
  async handler() {
    const { user } = await apiCall<ProfileResponse>("GET", "/api/v1/me")

    UI.println(UI.Style.TEXT_BOLD + "User" + UI.Style.TEXT_NORMAL)
    UI.println(`  ID:     ${user.id}`)
    UI.println(`  Email:  ${user.email}`)
    UI.println(`  Name:   ${user.name || "—"}`)
    UI.println(`  Role:   ${user.role}`)
    UI.println(`  Status: ${user.status}`)

    UI.println("")
    UI.println(UI.Style.TEXT_BOLD + "Organization" + UI.Style.TEXT_NORMAL)
    if (user.organization_id) {
      UI.println(`  ID:   ${user.organization_id}`)
      UI.println(`  Role: ${normalizeRole(user.organization_role)}`)
    } else {
      UI.println(`  No organization resolved for this account.`)
      UI.println(`  Run ${UI.Style.TEXT_DIM}gizzi org create${UI.Style.TEXT_NORMAL} to create a personal organization.`)
    }
  },
})

const OrgCreateCommand = cmd({
  command: "create",
  describe: "create a personal organization (self-hosted / no-Clerk fallback)",
  async handler() {
    const result = await apiCall<CreateOrgResponse>("POST", "/api/v1/me/organization", {})
    if (result.created) {
      UI.println(UI.Style.TEXT_SUCCESS + `Created organization ${result.organization_id}` + UI.Style.TEXT_NORMAL)
    } else {
      UI.println(UI.Style.TEXT_DIM + `Organization already exists: ${result.organization_id}` + UI.Style.TEXT_NORMAL)
    }
  },
})

export const OrgCommand = cmd({
  command: "org",
  describe: "organization and access management",
  builder: (yargs: Argv) => yargs.command(OrgShowCommand).command(OrgCreateCommand).demandCommand(),
  async handler() {},
})
