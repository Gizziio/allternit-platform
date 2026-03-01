import path from "path"
import { Global } from "../global"
import z from "zod/v4"
import { Filesystem } from "../util/filesystem"
import { xdgData } from "xdg-basedir"

export const OAUTH_DUMMY_KEY = "a2r-oauth-dummy-key"

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
    .meta({ ref: "OAuth" })

  export const Api = z
    .object({
      type: z.literal("api"),
      key: z.string(),
    })
    .meta({ ref: "ApiAuth" })

  export const WellKnown = z
    .object({
      type: z.literal("wellknown"),
      key: z.string(),
      token: z.string(),
    })
    .meta({ ref: "WellKnownAuth" })

  export const Info = z.discriminatedUnion("type", [Oauth, Api, WellKnown]).meta({ ref: "Auth" })
  export type Info = z.infer<typeof Info>

  const filepath = path.join(Global.Path.data, "auth.json")
  const legacyFilepath = path.join(xdgData ?? path.join(Global.Path.home, ".local/share"), "a2r", "auth.json")

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
}
