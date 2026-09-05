import fs from "fs/promises"
import path from "path"
import { Auth } from "@/runtime/integrations/auth"
import {
  AutoCredentialWriter,
  createCredentialWriter,
  type CredentialStore,
  type CredentialWriter,
} from "./credential-store"

const AUTH_PROFILE_SERVICE = "gizzi-auth-profile"

let inlinePlaintextWarned = false

function warnInlinePlaintext(configPath: string): void {
  if (inlinePlaintextWarned) return
  inlinePlaintextWarned = true
  const remediation =
    process.platform === "linux"
      ? "Install libsecret / gnome-keyring (e.g. `apt install libsecret-1-0 gnome-keyring`) and run `gizzi auth login` again to move the key into the OS keyring."
      : "Run `gizzi auth login` again once an OS keyring backend is available to move the key out of config.toml."
  console.error(
    `WARNING: API keys are stored inline in ${configPath} because no OS secure store is available.\n` +
      `  The file has been restricted to 0o600, but the keys remain unencrypted.\n` +
      `  ${remediation}\n` +
      "  Inline plaintext keys in config.toml are deprecated and will stop being read in a future release.",
  )
}

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
    // Best-effort removal of the stored key from the credential store.
    const store = auth.credential_store ?? "auto"
    await (writer ?? createCredentialWriter(store))
      .remove(AUTH_PROFILE_SERVICE, targetProfile)
      .catch(() => {})
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
 * The key is NEVER written inline into config.toml. It is delegated to the
 * configured {@link CredentialWriter}, controlled by `auth.credential_store`
 * in config.toml (`"keyring"`, `"file"`, or `"auto"` — the default). `"auto"`
 * prefers the OS keyring and falls back to the marked, 0o600 insecure-
 * fallback file (`~/.gizzi/credentials.json`) with a one-time warning when no
 * OS secure store is available.
 */
export async function loginApiKey(
  configPath: string,
  apiKey: string,
  options: {
    profile?: string
    provider?: string
    credentialStore?: CredentialStore
    writer?: CredentialWriter
    /** Directory for the insecure-fallback file (defaults to ~/.gizzi). */
    fileDir?: string
  } = {},
): Promise<LoginApiKeyResult> {
  const auth = await readAuthProfiles(configPath)
  const profileName = options.profile ?? "default"
  const store = options.credentialStore ?? auth.credential_store ?? "auto"
  const writer =
    options.writer ??
    createCredentialWriter(store, options.fileDir ? { fileDir: options.fileDir } : undefined)

  const existing = auth.profiles[profileName]
  const profile: AuthProfile = {
    provider: options.provider ?? existing?.provider ?? "allternit",
    api_key_env: existing?.api_key_env,
    base_url: existing?.base_url,
  }

  let storedIn: "file" | "keyring"

  if (store === "auto") {
    try {
      await writer.write(AUTH_PROFILE_SERVICE, profileName, apiKey)
      storedIn =
        writer instanceof AutoCredentialWriter
          ? (writer.lastWriteTarget ?? "file")
          : writer.name === "keyring"
            ? "keyring"
            : "file"
    } catch {
      // Explicit writer failed (e.g. keyring unavailable): degrade to the
      // marked insecure-fallback file rather than config.toml.
      const fallback = createCredentialWriter(
        "file",
        options.fileDir ? { fileDir: options.fileDir } : undefined,
      )
      await fallback.write(AUTH_PROFILE_SERVICE, profileName, apiKey)
      storedIn = "file"
    }
  } else {
    await writer.write(AUTH_PROFILE_SERVICE, profileName, apiKey)
    storedIn = store === "keyring" || writer.name === "keyring" ? "keyring" : "file"
  }

  auth.profiles[profileName] = profile
  auth.active_profile = profileName
  auth.credential_store = store
  await writeAuthProfiles(configPath, auth)
  return { profile: profileName, method: storedIn }
}

/**
 * Store an API key for an existing (or about-to-be-created) named profile
 * without changing the active profile. Used by `gizzi auth profile add
 * --api-key`; the key goes to the credential store, never config.toml.
 */
export async function storeApiKeyForProfile(
  configPath: string,
  name: string,
  apiKey: string,
  writer?: CredentialWriter,
): Promise<void> {
  const auth = await readAuthProfiles(configPath)
  const store = auth.credential_store ?? "auto"
  const w = writer ?? createCredentialWriter(store)
  await w.write(AUTH_PROFILE_SERVICE, name, apiKey)
}

export type InlineKeyMigrationResult = { migrated: string[]; failed: string[] }

/**
 * Migrate inline plaintext API keys out of config.toml and into the
 * credential store. Called on read (via {@link resolveApiKey}) so legacy
 * configs self-heal.
 *
 * - On success the key is moved into the store and stripped from config.toml.
 * - On failure (no OS secure store and the key cannot be written anywhere but
 *   config.toml) the file is tightened to 0o600 and a one-time deprecation
 *   warning is printed; the inline key remains readable for continuity.
 */
export async function migrateInlineApiKeys(
  configPath: string,
  writer?: CredentialWriter,
): Promise<InlineKeyMigrationResult> {
  const auth = await readAuthProfiles(configPath)
  const candidates = Object.entries(auth.profiles).filter(
    ([, profile]) => typeof profile.api_key === "string" && profile.api_key.length > 0,
  )
  if (candidates.length === 0) return { migrated: [], failed: [] }

  const store = auth.credential_store ?? "auto"
  const w = writer ?? createCredentialWriter(store)
  const migrated: string[] = []
  const failed: string[] = []

  for (const [name, profile] of candidates) {
    try {
      await w.write(AUTH_PROFILE_SERVICE, name, profile.api_key!)
      migrated.push(name)
    } catch {
      failed.push(name)
    }
  }

  if (migrated.length > 0) {
    for (const name of migrated) {
      delete auth.profiles[name]!.api_key
    }
    await writeAuthProfiles(configPath, auth)
  }

  if (failed.length > 0) {
    await fs.chmod(configPath, 0o600).catch(() => {})
    warnInlinePlaintext(configPath)
  }

  return { migrated, failed }
}

export type ApiKeySource = "config" | "keyring" | "env" | "none"

/**
 * Resolve the API key for a profile, respecting the configured credential store.
 *
 * Before resolving, attempts to migrate any legacy inline `api_key` entries
 * out of config.toml and into the credential store (see
 * {@link migrateInlineApiKeys}).
 */
export async function resolveApiKey(
  configPath: string,
  name?: string,
  writer?: CredentialWriter,
): Promise<{ source: ApiKeySource; key: string | null; profile?: AuthProfile; profileName?: string }> {
  await migrateInlineApiKeys(configPath, writer)

  const auth = await readAuthProfiles(configPath)
  const profileName = name ?? auth.active_profile
  if (!profileName) return { source: "none", key: null }
  const profile = auth.profiles[profileName]
  if (!profile) return { source: "none", key: null, profileName }

  if (profile.api_key_env && process.env[profile.api_key_env]) {
    return { source: "env", key: process.env[profile.api_key_env]!, profile, profileName }
  }

  if (profile.api_key) {
    // Legacy inline key that could not be migrated (no writable store).
    return { source: "config", key: profile.api_key, profile, profileName }
  }

  const store = auth.credential_store ?? "auto"
  if (store === "keyring" || store === "auto" || store === "file") {
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
      ALLTERNIT_API_KEY: Boolean(process.env.ALLTERNIT_API_KEY),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      GIZZI_API_KEY: Boolean(process.env.GIZZI_API_KEY),
      DISABLE_TELEMETRY: Boolean(process.env.DISABLE_TELEMETRY),
    },
  }
}
