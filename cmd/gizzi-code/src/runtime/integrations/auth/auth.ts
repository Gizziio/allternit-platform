// @ts-nocheck
import path from "path"
import { Global } from "@/runtime/context/global/index"
import z from "zod/v4"
import { Filesystem } from "@/runtime/util/filesystem"
import { xdgData } from "xdg-basedir"

export const OAUTH_DUMMY_KEY = "gizzi-oauth-dummy-key"

export namespace Auth {
  export const Oauth = z
    .object({
      type: z.literal("oauth"),
      refresh: z.string(),
      access: z.string(),
      expires: z.number(),
      accountId: z.string().optional(),
      enterpriseUrl: z.string().optional(),
    })
    

  export const Api = z
    .object({
      type: z.literal("api"),
      key: z.string(),
    })
    

  export const WellKnown = z
    .object({
      type: z.literal("wellknown"),
      key: z.string(),
      token: z.string(),
    })
    

  export const Info = z.discriminatedUnion("type", [Oauth, Api, WellKnown])
  export type Info = z.infer<typeof Info>

  const filepath = path.join(Global.Path.data, "auth.json")
  const legacyFilepath = path.join(xdgData ?? path.join(Global.Path.home, ".local/share"), "gizzi", "auth.json")

  export async function get(providerID: string) {
    const auth = await all()
    return auth[providerID]
  }

  async function loadAuthFile(file: string): Promise<Record<string, Info>> {
    const data = await Filesystem.readJson<Record<string, unknown>>(file).catch(() => ({}))
    return Object.entries(data).reduce(
      (acc, [key, value]) => {
        const parsed = Info.safeParse(value)
        if (!parsed.success) return acc
        acc[key] = parsed.data
        return acc
      },
      {} as Record<string, Info>,
    )
  }

  export async function all(): Promise<Record<string, Info>> {
    const [legacy, current] = await Promise.all([loadAuthFile(legacyFilepath), loadAuthFile(filepath)])
    return { ...legacy, ...current }
  }

  export async function set(key: string, info: Info) {
    const data = await all()
    await Filesystem.writeJson(filepath, { ...data, [key]: info }, 0o600)
  }

  export async function remove(key: string) {
    const data = await all()
    delete data[key]
    await Filesystem.writeJson(filepath, data, 0o600)
  }

  // ── Named auth profiles store (separate from legacy provider-key auth) ─────

  export const Profile = z.object({
    id: z.string(),
    providerID: z.string(),
    name: z.string().optional(),
    type: z.enum(["api", "oauth", "token"]),
    apiKey: z.string().optional(),
    token: z.string().optional(),
    extraHeaders: z.record(z.string(), z.string()).optional(),
    order: z.number().optional(),
  })
  export type Profile = z.infer<typeof Profile>

  export type ProfileStore = {
    profiles: Record<string, Profile>
    order?: string[]
  }

  const profileFilepath = path.join(Global.Path.data, "auth-profiles.json")

  async function loadProfiles(): Promise<ProfileStore> {
    const data = await Filesystem.readJson<ProfileStore>(profileFilepath).catch(() => ({}))
    return {
      profiles: data.profiles ?? {},
      order: data.order,
    }
  }

  async function saveProfiles(store: ProfileStore) {
    await Filesystem.writeJson(profileFilepath, store, 0o600)
  }

  export async function getProfile(profileId: string): Promise<Profile | undefined> {
    const store = await loadProfiles()
    return store.profiles[profileId]
  }

  export async function profilesForProvider(providerID: string): Promise<Profile[]> {
    const store = await loadProfiles()
    const profiles = Object.values(store.profiles).filter((p) => p.providerID === providerID)
    const order = store.order ?? []
    return profiles.sort((a, b) => {
      const ai = order.indexOf(a.id)
      const bi = order.indexOf(b.id)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return (a.order ?? 0) - (b.order ?? 0)
    })
  }

  export async function setProfile(profile: Profile) {
    const store = await loadProfiles()
    store.profiles[profile.id] = profile
    await saveProfiles(store)
  }

  export async function removeProfile(profileId: string) {
    const store = await loadProfiles()
    delete store.profiles[profileId]
    store.order = store.order?.filter((id) => id !== profileId)
    await saveProfiles(store)
  }

  export async function setOrder(profileIds: string[]) {
    const store = await loadProfiles()
    store.order = profileIds
    await saveProfiles(store)
  }

  /** Active/default profile for a provider, respecting configured order. */
  export async function activeProfile(providerID: string): Promise<Profile | undefined> {
    const profiles = await profilesForProvider(providerID)
    return profiles[0]
  }
}
