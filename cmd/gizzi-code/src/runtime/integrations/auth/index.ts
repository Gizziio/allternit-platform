import path from "path"
import { GlobalPaths } from "@/runtime/context/global/paths"
import z from "zod/v4"
import { Filesystem } from "@/shared/util/filesystem"
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

  const testAuthPath = process.env.GIZZI_TEST_AUTH_PATH
  const filepath = testAuthPath ?? path.join(GlobalPaths.data, "auth.json")
  const legacyFilepath = testAuthPath
    ? "" // tests use a single isolated auth file
    : path.join(xdgData ?? path.join(GlobalPaths.home(), ".local/share"), "gizzi", "auth.json")

  export async function get(providerID: string) {
    const auth = await all()
    return auth[providerID]
  }

  async function loadAuthFile(file: string): Promise<Record<string, Info>> {
    if (!file) return {}
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
    if (process.env.GIZZI_TEST_ISOLATED_AUTH) {
      return {}
    }
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
