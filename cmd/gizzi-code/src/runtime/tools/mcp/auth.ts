import path from "path"
import z from "zod/v4"
import { Global } from "@/runtime/context/global"
import { Filesystem } from "@/shared/util/filesystem"
import { xdgData } from "xdg-basedir"
import fs from "fs/promises"
import { randomUUID } from "crypto"

export namespace McpAuth {
  export const Tokens = z.object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    expiresAt: z.number().optional(),
    scope: z.string().optional(),
  })
  export type Tokens = z.infer<typeof Tokens>

  export const ClientInfo = z.object({
    clientId: z.string(),
    clientSecret: z.string().optional(),
    clientIdIssuedAt: z.number().optional(),
    clientSecretExpiresAt: z.number().optional(),
  })
  export type ClientInfo = z.infer<typeof ClientInfo>

  export const Entry = z.object({
    tokens: Tokens.optional(),
    clientInfo: ClientInfo.optional(),
    codeVerifier: z.string().optional(),
    oauthState: z.string().optional(),
    serverUrl: z.string().optional(), // Track the URL these credentials are for
    revoked: z.boolean().optional(),
  })
  export type Entry = z.infer<typeof Entry>

  const filepath = path.join(Global.Path.data, "mcp-auth.json")
  const legacyFilepath = path.join(
    xdgData ?? path.join(Global.Path.home(), ".local/share"),
    "gizzi",
    "mcp-auth.json",
  )
  let writeQueue: Promise<void> = Promise.resolve()

  export async function get(mcpName: string): Promise<Entry | undefined> {
    const data = await all()
    return data[mcpName]
  }

  /**
   * Get auth entry and validate it's for the correct URL.
   * Returns undefined if URL has changed (credentials are invalid).
   */
  export async function getForUrl(mcpName: string, serverUrl: string): Promise<Entry | undefined> {
    const entry = await get(mcpName)
    if (!entry) return undefined

    // If no serverUrl is stored, this is from an old version - consider it invalid
    if (!entry.serverUrl) return undefined

    // If URL has changed, credentials are invalid
    if (entry.serverUrl !== serverUrl) return undefined

    return entry
  }

  function normalize(input: Record<string, unknown>) {
    return Object.entries(input).reduce(
      (acc, [key, value]) => {
        const parsed = Entry.safeParse(value)
        if (!parsed.success) return acc
        acc[key] = parsed.data
        return acc
      },
      {} as Record<string, Entry>,
    )
  }

  export async function all(): Promise<Record<string, Entry>> {
    const [legacyRaw, currentRaw] = await Promise.all([
      Filesystem.readJson<Record<string, unknown>>(legacyFilepath).catch(() => ({})),
      Filesystem.readJson<Record<string, unknown>>(filepath).catch(() => ({})),
    ])
    const merged = { ...normalize(legacyRaw), ...normalize(currentRaw) }
    return Object.fromEntries(Object.entries(merged).filter(([, entry]) => entry.revoked !== true))
  }

  export async function set(mcpName: string, entry: Entry, serverUrl?: string): Promise<void> {
    await serializeWrite(async () => {
      const current = normalize(await Filesystem.readJson<Record<string, unknown>>(filepath).catch(() => ({})))
      const existing = (await all())[mcpName] ?? {}
      const next = { ...existing, ...entry, ...(serverUrl ? { serverUrl } : {}), revoked: false }
      await writeAtomic({ ...current, [mcpName]: next })
    })
  }

  export async function remove(mcpName: string): Promise<void> {
    await serializeWrite(async () => {
      const current = normalize(await Filesystem.readJson<Record<string, unknown>>(filepath).catch(() => ({})))
      // A tombstone prevents a legacy credential with the same name from being merged back in.
      await writeAtomic({ ...current, [mcpName]: { revoked: true } })
    })
  }

  export async function updateTokens(mcpName: string, tokens: Tokens, serverUrl?: string): Promise<void> {
    await patchEntry(mcpName, { tokens }, serverUrl)
  }

  export async function updateClientInfo(mcpName: string, clientInfo: ClientInfo, serverUrl?: string): Promise<void> {
    await patchEntry(mcpName, { clientInfo }, serverUrl)
  }

  export async function updateCodeVerifier(mcpName: string, codeVerifier: string): Promise<void> {
    await patchEntry(mcpName, { codeVerifier })
  }

  export async function clearCodeVerifier(mcpName: string): Promise<void> {
    const entry = await get(mcpName)
    if (entry) {
      await patchEntry(mcpName, { codeVerifier: undefined })
    }
  }

  export async function updateOAuthState(mcpName: string, oauthState: string): Promise<void> {
    await patchEntry(mcpName, { oauthState })
  }

  export async function getOAuthState(mcpName: string): Promise<string | undefined> {
    const entry = await get(mcpName)
    return entry?.oauthState
  }

  export async function clearOAuthState(mcpName: string): Promise<void> {
    const entry = await get(mcpName)
    if (entry) {
      await patchEntry(mcpName, { oauthState: undefined })
    }
  }

  /**
   * Check if stored tokens are expired.
   * Returns null if no tokens exist, false if no expiry or not expired, true if expired.
   */
  export async function isTokenExpired(mcpName: string): Promise<boolean | null> {
    const entry = await get(mcpName)
    if (!entry?.tokens) return null
    if (!entry.tokens.expiresAt) return false
    return entry.tokens.expiresAt < Date.now() / 1000
  }

  async function writeAtomic(data: Record<string, Entry>) {
    await fs.mkdir(path.dirname(filepath), { recursive: true })
    const temporary = `${filepath}.${process.pid}.${randomUUID()}.tmp`
    await fs.writeFile(temporary, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 })
    await fs.chmod(temporary, 0o600)
    await fs.rename(temporary, filepath)
  }

  async function patchEntry(mcpName: string, patch: Partial<Entry>, serverUrl?: string) {
    await serializeWrite(async () => {
      const current = normalize(await Filesystem.readJson<Record<string, unknown>>(filepath).catch(() => ({})))
      const existing = (await all())[mcpName] ?? {}
      const next = { ...existing, ...patch, ...(serverUrl ? { serverUrl } : {}), revoked: false }
      await writeAtomic({ ...current, [mcpName]: next })
    })
  }

  async function serializeWrite(work: () => Promise<void>) {
    const next = writeQueue.then(work, work)
    writeQueue = next.catch(() => {})
    return next
  }
}
