import fs from "fs/promises"
import path from "path"

export type PermissionAction = "ask" | "allow" | "deny"

export const PERMISSION_ACTIONS: PermissionAction[] = ["ask", "allow", "deny"]

export type PermissionProfile = {
  rules: Record<string, PermissionAction>
}

export type PermissionProfiles = {
  active_profile?: string
  profiles: Record<string, PermissionProfile>
}

function quote(value: string): string {
  return JSON.stringify(value)
}

/**
 * Render a permission profile to the policy DSL: one `<tool> <action>` line per rule.
 */
export function renderDsl(profile: PermissionProfile): string {
  const lines = Object.entries(profile.rules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tool, action]) => `${tool} ${action}`)
  return lines.join("\n")
}

/**
 * Parse a policy DSL text into a rule map. Lines starting with `#` are ignored.
 */
export function parseDsl(text: string): Record<string, PermissionAction> {
  const rules: Record<string, PermissionAction> = {}
  for (let line of text.split(/\r?\n/)) {
    line = line.trim()
    if (!line || line.startsWith("#")) continue
    const [tool, action, ...rest] = line.split(/\s+/)
    if (!tool || !action || rest.length > 0) {
      throw new Error(`Invalid permission DSL line: "${line}"`)
    }
    if (!PERMISSION_ACTIONS.includes(action as PermissionAction)) {
      throw new Error(
        `Invalid permission action "${action}" in line "${line}", expected one of ${PERMISSION_ACTIONS.join(", ")}`,
      )
    }
    rules[tool] = action as PermissionAction
  }
  return rules
}

function render(profiles: PermissionProfiles): string {
  const lines = ["[permission_profiles]"]
  if (profiles.active_profile) lines.push(`active_profile = ${quote(profiles.active_profile)}`)

  for (const name of Object.keys(profiles.profiles).sort()) {
    const profile = profiles.profiles[name]!
    // A nested table (not an inline table) since TOML 1.0 inline tables must stay on one line.
    lines.push("", `[permission_profiles.profiles.${quote(name)}.rules]`)
    for (const rule of Object.keys(profile.rules).sort()) {
      lines.push(`${quote(rule)} = ${quote(profile.rules[rule]!)}`)
    }
  }
  return lines.join("\n")
}

function withoutPermissionProfilesSection(text: string): string {
  const lines = text.split(/\r?\n/)
  const kept: string[] = []
  let inSection = false
  for (const line of lines) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/)?.[1]
    if (header) inSection = header === "permission_profiles" || header.startsWith("permission_profiles.")
    if (!inSection) kept.push(line)
  }
  return kept.join("\n").trimEnd()
}

export async function readPermissionProfiles(configPath: string): Promise<PermissionProfiles> {
  const text = await fs.readFile(configPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return ""
    throw error
  })
  if (!text) return { profiles: {} }
  const parsed = Bun.TOML.parse(text) as { permission_profiles?: Partial<PermissionProfiles> }
  return {
    active_profile: parsed.permission_profiles?.active_profile,
    profiles: parsed.permission_profiles?.profiles ?? {},
  }
}

async function writePermissionProfiles(configPath: string, profiles: PermissionProfiles): Promise<void> {
  const text = await fs.readFile(configPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return ""
    throw error
  })
  const prefix = withoutPermissionProfilesSection(text)
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, `${prefix ? `${prefix}\n\n` : ""}${render(profiles)}\n`)
}

export async function addPermissionProfile(
  configPath: string,
  name: string,
  rules: Record<string, PermissionAction>,
): Promise<void> {
  const profiles = await readPermissionProfiles(configPath)
  if (profiles.profiles[name]) throw new Error(`Permission profile already exists: ${name}`)
  profiles.profiles[name] = { rules }
  profiles.active_profile ??= name
  await writePermissionProfiles(configPath, profiles)
}

export async function removePermissionProfile(configPath: string, name: string): Promise<void> {
  const profiles = await readPermissionProfiles(configPath)
  if (!profiles.profiles[name]) throw new Error(`Permission profile not found: ${name}`)
  delete profiles.profiles[name]
  if (profiles.active_profile === name) profiles.active_profile = Object.keys(profiles.profiles).sort()[0]
  await writePermissionProfiles(configPath, profiles)
}

export async function setActivePermissionProfile(configPath: string, name: string): Promise<void> {
  const profiles = await readPermissionProfiles(configPath)
  if (!profiles.profiles[name]) throw new Error(`Permission profile not found: ${name}`)
  profiles.active_profile = name
  await writePermissionProfiles(configPath, profiles)
}

export interface ImportPermissionProfileOptions {
  overwrite?: boolean
}

/**
 * Import a permission profile from a DSL text string.
 */
export async function importPermissionProfile(
  configPath: string,
  name: string,
  dslText: string,
  options: ImportPermissionProfileOptions = {},
): Promise<void> {
  const profiles = await readPermissionProfiles(configPath)
  if (profiles.profiles[name] && !options.overwrite) {
    throw new Error(`Permission profile already exists: ${name}`)
  }
  const rules = parseDsl(dslText)
  profiles.profiles[name] = { rules }
  profiles.active_profile ??= name
  await writePermissionProfiles(configPath, profiles)
}

/**
 * Export a permission profile to a DSL text string.
 */
export async function exportPermissionProfile(configPath: string, name: string): Promise<string> {
  const profiles = await readPermissionProfiles(configPath)
  const profile = profiles.profiles[name]
  if (!profile) throw new Error(`Permission profile not found: ${name}`)
  return renderDsl(profile)
}
