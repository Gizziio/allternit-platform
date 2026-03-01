import fs from "fs/promises"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"
import path from "path"
import os from "os"
import { Filesystem } from "../util/filesystem"

const app = "a2r-shell"
const legacyApp = "opencode"

const data = path.join(xdgData!, app)
const cache = path.join(xdgCache!, app)
const config = path.join(xdgConfig!, app)
const state = path.join(xdgState!, app)
const legacyData = path.join(xdgData!, legacyApp)
const legacyConfig = path.join(xdgConfig!, legacyApp)

export namespace Global {
  export const Path = {
    // Allow override via A2R_TEST_HOME for test isolation
    get home() {
      return process.env.A2R_TEST_HOME || os.homedir()
    },
    data,
    bin: path.join(data, "bin"),
    log: path.join(data, "log"),
    cache,
    config,
    state,
  }
}

await Promise.all([
  fs.mkdir(Global.Path.data, { recursive: true }),
  fs.mkdir(Global.Path.config, { recursive: true }),
  fs.mkdir(Global.Path.state, { recursive: true }),
  fs.mkdir(Global.Path.log, { recursive: true }),
  fs.mkdir(Global.Path.bin, { recursive: true }),
])

async function copyLegacyFile(input: { from: string; to: string; mode?: number }) {
  if (!(await Filesystem.exists(input.from))) return
  if (await Filesystem.exists(input.to)) return
  await fs.mkdir(path.dirname(input.to), { recursive: true })
  await fs.copyFile(input.from, input.to)
  if (input.mode !== undefined) {
    await fs.chmod(input.to, input.mode).catch(() => {})
  }
}

await Promise.all([
  // Legacy A2R config compatibility
  copyLegacyFile({
    from: path.join(legacyConfig, "config.json"),
    to: path.join(Global.Path.config, "config.json"),
  }),
  copyLegacyFile({
    from: path.join(legacyConfig, "opencode.json"),
    to: path.join(Global.Path.config, "a2r.json"),
  }),
  copyLegacyFile({
    from: path.join(legacyConfig, "opencode.jsonc"),
    to: path.join(Global.Path.config, "a2r.jsonc"),
  }),
  // Legacy A2R credentials compatibility
  copyLegacyFile({
    from: path.join(legacyData, "auth.json"),
    to: path.join(Global.Path.data, "auth.json"),
    mode: 0o600,
  }),
  copyLegacyFile({
    from: path.join(legacyData, "mcp-auth.json"),
    to: path.join(Global.Path.data, "mcp-auth.json"),
    mode: 0o600,
  }),
])

const CACHE_VERSION = "21"

const version = await Filesystem.readText(path.join(Global.Path.cache, "version")).catch(() => "0")

if (version !== CACHE_VERSION) {
  try {
    const contents = await fs.readdir(Global.Path.cache)
    await Promise.all(
      contents.map((item) =>
        fs.rm(path.join(Global.Path.cache, item), {
          recursive: true,
          force: true,
        }),
      ),
    )
  } catch (e) {}
  await Filesystem.write(path.join(Global.Path.cache, "version"), CACHE_VERSION)
}
