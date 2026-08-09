import fs from "fs/promises"
import path from "path"

export type AuthProfile = {
  provider: string
  api_key?: string
  api_key_env?: string
  base_url?: string
}

export type AuthProfiles = {
  active_profile?: string
  profiles: Record<string, AuthProfile>
}

function quote(value: string): string {
  return JSON.stringify(value)
}

function render(auth: AuthProfiles): string {
  const lines = ["[auth]"]
  if (auth.active_profile) lines.push(`active_profile = ${quote(auth.active_profile)}`)

  for (const name of Object.keys(auth.profiles).sort()) {
    const profile = auth.profiles[name]!
    lines.push("", `[auth.profiles.${quote(name)}]`, `provider = ${quote(profile.provider)}`)
    if (profile.api_key) lines.push(`api_key = ${quote(profile.api_key)}`)
    if (profile.api_key_env) lines.push(`api_key_env = ${quote(profile.api_key_env)}`)
    if (profile.base_url) lines.push(`base_url = ${quote(profile.base_url)}`)
  }
  return lines.join("\n")
}

function withoutAuthSection(text: string): string {
  const lines = text.split(/\r?\n/)
  const kept: string[] = []
  let inAuth = false
  for (const line of lines) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/)?.[1]
    if (header) inAuth = header === "auth" || header.startsWith("auth.")
    if (!inAuth) kept.push(line)
  }
  return kept.join("\n").trimEnd()
}

export async function readAuthProfiles(configPath: string): Promise<AuthProfiles> {
  const text = await fs.readFile(configPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return ""
    throw error
  })
  if (!text) return { profiles: {} }
  const parsed = Bun.TOML.parse(text) as { auth?: Partial<AuthProfiles> }
  return {
    active_profile: parsed.auth?.active_profile,
    profiles: parsed.auth?.profiles ?? {},
  }
}

async function writeAuthProfiles(configPath: string, auth: AuthProfiles): Promise<void> {
  const text = await fs.readFile(configPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return ""
    throw error
  })
  const prefix = withoutAuthSection(text)
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, `${prefix ? `${prefix}\n\n` : ""}${render(auth)}\n`, { mode: 0o600 })
  await fs.chmod(configPath, 0o600)
}

export async function addAuthProfile(configPath: string, name: string, profile: AuthProfile): Promise<void> {
  const auth = await readAuthProfiles(configPath)
  if (auth.profiles[name]) throw new Error(`Auth profile already exists: ${name}`)
  auth.profiles[name] = profile
  auth.active_profile ??= name
  await writeAuthProfiles(configPath, auth)
}

export async function removeAuthProfile(configPath: string, name: string): Promise<void> {
  const auth = await readAuthProfiles(configPath)
  if (!auth.profiles[name]) throw new Error(`Auth profile not found: ${name}`)
  delete auth.profiles[name]
  if (auth.active_profile === name) auth.active_profile = Object.keys(auth.profiles).sort()[0]
  await writeAuthProfiles(configPath, auth)
}

export async function setActiveAuthProfile(configPath: string, name: string): Promise<void> {
  const auth = await readAuthProfiles(configPath)
  if (!auth.profiles[name]) throw new Error(`Auth profile not found: ${name}`)
  auth.active_profile = name
  await writeAuthProfiles(configPath, auth)
}
