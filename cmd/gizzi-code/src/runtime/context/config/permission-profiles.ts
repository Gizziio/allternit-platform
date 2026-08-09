import fs from "fs/promises"
import path from "path"

export type PermissionAction = "ask" | "allow" | "deny"

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
