import fs from "fs/promises"
import path from "path"
import { Auth } from "@/runtime/integrations/auth"
import {
  createCredentialWriter,
  type CredentialStore,
  type CredentialWriter,
} from "./credential-store"

const AUTH_PROFILE_SERVICE = "gizzi-auth-profile"

export type AuthProfile = {
  provider: string
  api_key?: string
  api_key_env?: string
  base_url?: string
}

export type AuthProfiles = {
  active_profile?: string
  credential_store?: CredentialStore
  profiles: Record<string, AuthProfile>
}

function quote(value: string): string {
  return JSON.stringify(value)
}

function render(auth: AuthProfiles): string {
  const lines = ["[auth]"]
  if (auth.active_profile) lines.push(`active_profile = ${quote(auth.active_profile)}`)
  if (auth.credential_store) lines.push(`credential_store = ${quote(auth.credential_store)}`)

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
    credential_store: parsed.auth?.credential_store,
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

/**
 * Sign out the active session.
 *
 * Removes the active API-key profile from config.toml and clears any OAuth
 * credentials stored in the runtime auth store. If a profile name is supplied,
 * only that profile is removed.
 */
export async function logout(configPath: string, name?: string, writer?: CredentialWriter): Promise<{ method: AuthMethod; profile?: string }> {
  const status = await getAuthStatus(configPath, writer)
  const targetProfile = name ?? status.profile

  if (status.method === "oauth_token") {
    const runtimeAuth = await Auth.all()
    for (const key of Object.keys(runtimeAuth)) {
      await Auth.remove(key)
    }
  }

  if (targetProfile) {
    const auth = await readAuthProfiles(configPath)
    if (auth.profiles[targetProfile]) {
      delete auth.profiles[targetProfile]
      if (auth.active_profile === targetProfile) {
        auth.active_profile = Object.keys(auth.profiles).sort()[0]
      }
      await writeAuthProfiles(configPath, auth)
    }
  }

  return { method: status.method, profile: targetProfile }
}

export type LoginApiKeyResult = {
  profile: string
  method: "file" | "keyring"
}

/**
 * Store an API key for CLI authentication.
 *
 * The key is written to the active/default auth profile. The storage location
 * is controlled by `auth.credential_store` in config.toml (`"file"`,
 * `"keyring"`, or `"auto"`). When the store is `"file"` the key is written
 * inline in config.toml; for `"keyring"` it is delegated to the configured
 * {@link CredentialWriter}. `"auto"` prefers keyring and falls back to file.
 */
export async function loginApiKey(
  configPath: string,
  apiKey: string,
  options: {
    profile?: string
    provider?: string
    baseURL?: string
    credentialStore?: CredentialStore
    writer?: CredentialWriter
  } = {},
): Promise<LoginApiKeyResult> {
  const auth = await readAuthProfiles(configPath)
  const profileName = options.profile ?? "default"
  const store = options.credentialStore ?? auth.credential_store ?? "file"
  const writer = options.writer ?? createCredentialWriter(store)

  const existing = auth.profiles[profileName]
  const profile: AuthProfile = {
    provider: options.provider ?? existing?.provider ?? "anthropic",
    api_key_env: existing?.api_key_env,
    base_url: options.baseURL ?? existing?.base_url,
  }

  let storedIn: "file" | "keyring" = "file"

  if (store === "keyring") {
    await writer.write(AUTH_PROFILE_SERVICE, profileName, apiKey)
    storedIn = "keyring"
  } else if (store === "auto") {
    try {
      await writer.write(AUTH_PROFILE_SERVICE, profileName, apiKey)
      storedIn = "keyring"
    } catch {
      profile.api_key = apiKey
      storedIn = "file"
    }
  } else {
    profile.api_key = apiKey
  }

  auth.profiles[profileName] = profile
  auth.active_profile = profileName
  auth.credential_store = store
  await writeAuthProfiles(configPath, auth)
  return { profile: profileName, method: storedIn }
}

export type ApiKeySource = "config" | "keyring" | "env" | "none"

/**
 * Resolve the API key for a profile, respecting the configured credential store.
 */
export async function resolveApiKey(
  configPath: string,
  name?: string,
  writer?: CredentialWriter,
): Promise<{ source: ApiKeySource; key: string | null; profile?: AuthProfile; profileName?: string }> {
  const auth = await readAuthProfiles(configPath)
  const profileName = name ?? auth.active_profile
  if (!profileName) return { source: "none", key: null }
  const profile = auth.profiles[profileName]
  if (!profile) return { source: "none", key: null, profileName }

  if (profile.api_key_env && process.env[profile.api_key_env]) {
    return { source: "env", key: process.env[profile.api_key_env]!, profile, profileName }
  }

  if (profile.api_key) {
    return { source: "config", key: profile.api_key, profile, profileName }
  }

  const store = auth.credential_store ?? "file"
  if (store === "keyring" || store === "auto") {
    const key = await (writer ?? createCredentialWriter(store)).read(AUTH_PROFILE_SERVICE, profileName)
    if (key) return { source: "keyring", key, profile, profileName }
  }

  return { source: "none", key: null, profile, profileName }
}

export type AuthMethod = "none" | "oauth_token" | "api_key"

/**
 * Determine the active authentication method.
 *
 * OAuth tokens stored in the runtime auth store take precedence. Otherwise, a
 * resolved API key from config.toml or keyring is reported as `api_key`.
 */
export async function getAuthStatus(
  configPath: string,
  writer?: CredentialWriter,
): Promise<{ method: AuthMethod; profile?: string }> {
  const runtimeAuth = await Auth.all()
  const hasOAuth = Object.values(runtimeAuth).some((info) => info.type === "oauth")
  if (hasOAuth) return { method: "oauth_token" }

  const resolved = await resolveApiKey(configPath, undefined, writer)
  if (resolved.key !== null) {
    return { method: "api_key", profile: resolved.profileName }
  }

  return { method: "none" }
}

export type AuthDiagnosis = {
  config_path: string
  config_exists: boolean
  active_profile?: string
  credential_store?: CredentialStore
  profile_count: number
  profile_names: string[]
  method: AuthMethod
  runtime_auth_keys: string[]
  env_vars: Record<string, boolean>
}

/**
 * Collect diagnostic information about the current authentication setup.
 */
export async function diagnoseAuth(configPath: string, writer?: CredentialWriter): Promise<AuthDiagnosis> {
  const auth = await readAuthProfiles(configPath)
  const runtimeAuth = await Auth.all()
  const status = await getAuthStatus(configPath, writer)

  return {
    config_path: configPath,
    config_exists: await fs.access(configPath).then(() => true).catch(() => false),
    active_profile: auth.active_profile,
    credential_store: auth.credential_store,
    profile_count: Object.keys(auth.profiles).length,
    profile_names: Object.keys(auth.profiles).sort(),
    method: status.method,
    runtime_auth_keys: Object.keys(runtimeAuth),
    env_vars: {
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      GIZZI_API_KEY: Boolean(process.env.GIZZI_API_KEY),
      DISABLE_TELEMETRY: Boolean(process.env.DISABLE_TELEMETRY),
    },
  }
}
