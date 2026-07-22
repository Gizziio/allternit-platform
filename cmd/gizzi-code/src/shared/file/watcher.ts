// @ts-nocheck
import { BusEvent } from "@/shared/bus/bus-event"
import { Bus } from "@/shared/bus"
import z from "zod/v4"
import { Instance } from "@/runtime/context/project/instance"
import { Log } from "@/shared/util/log"
import { FileIgnore } from "@/shared/file/ignore"
import { Config } from "@/runtime/context/config/config"
import path from "path"
// @ts-ignore — @parcel/watcher/wrapper has no type declarations
import { createWrapper } from "@parcel/watcher/wrapper"
import { lazy } from "@/shared/util/lazy"
import { withTimeout } from "@/shared/util/timeout"
import type ParcelWatcher from "@parcel/watcher"
import { $ } from "bun"
import { Flag } from "@/runtime/context/flag/flag"
import { readdir } from "fs/promises"
import chokidar from "chokidar"
import { dirname, join } from "path"
import { RuntimeTelemetry } from "@/runtime/telemetry"

const SUBSCRIBE_TIMEOUT_MS = 10_000

declare const GIZZI_LIBC: string | undefined

type WatcherAdapter = {
  subscribe: (
    dir: string,
    callback: ParcelWatcher.SubscribeCallback,
    options: { ignore?: string[]; backend?: string },
  ) => Promise<ParcelWatcher.AsyncSubscription>
}

export namespace FileWatcher {
  const log = Log.create({ service: "file.watcher" })

  export const Event = {
    Updated: BusEvent.define(
      "file.watcher.updated",
      z.object({
        file: z.string(),
        event: z.union([z.literal("add"), z.literal("change"), z.literal("unlink")]),
      }),
    ),
  }

  function createChokidarFallback(): WatcherAdapter {
    return {
      async subscribe(dir, callback, options) {
        const instance = chokidar.watch(dir, {
          ignored: options.ignore,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 25,
          },
        })

        instance.on("add", (file) => callback(null, [{ path: file, type: "create" }]))
        instance.on("change", (file) => callback(null, [{ path: file, type: "update" }]))
        instance.on("unlink", (file) => callback(null, [{ path: file, type: "delete" }]))
        instance.on("error", (error) => callback(error, []))

        return {
          unsubscribe: async () => {
            await instance.close()
          },
        } as ParcelWatcher.AsyncSubscription
      },
    }
  }

  const watcher = lazy((): WatcherAdapter | undefined => {
    try {
      const packageName = `@parcel/watcher-${process.platform}-${process.arch}${process.platform === "linux" ? `-${GIZZI_LIBC || "glibc"}` : ""}`
      const sidecar = join(
        dirname(process.execPath),
        "native-assets",
        `${process.platform}-${process.arch}`,
        "node_modules",
        ...packageName.split("/"),
      )
      let binding: unknown
      try {
        binding = require(sidecar)
      } catch {
        RuntimeTelemetry.track("native_asset_fallback", {
          package: packageName,
          platform: `${process.platform}-${process.arch}`,
        })
        binding = require(packageName)
      }
      return createWrapper(binding) as unknown as WatcherAdapter
    } catch (error) {
      log.warn("parcel watcher binding unavailable, falling back to chokidar", { error })
      return createChokidarFallback()
    }
  })

  const state = Instance.state(
    async () => {
      if (Instance.project.vcs !== "git") return {}
      log.info("init")
      const cfg = await Config.get()
      const backend = (() => {
        if (process.platform === "win32") return "windows"
        if (process.platform === "darwin") return "fs-events"
        if (process.platform === "linux") return "inotify"
      })()
      if (!backend) {
        log.error("watcher backend not supported", { platform: process.platform })
        return {}
      }
      log.info("watcher backend", { platform: process.platform, backend })

      const w = watcher()
      if (!w) return {}

      const subscribe: ParcelWatcher.SubscribeCallback = (err, evts) => {
        if (err) return
        for (const evt of evts) {
          if (evt.type === "create") Bus.publish(Event.Updated, { file: evt.path, event: "add" })
          if (evt.type === "update") Bus.publish(Event.Updated, { file: evt.path, event: "change" })
          if (evt.type === "delete") Bus.publish(Event.Updated, { file: evt.path, event: "unlink" })
        }
      }

      const subs: ParcelWatcher.AsyncSubscription[] = []
      const cfgIgnores = cfg.watcher?.ignore ?? []

      if (Flag.GIZZI_EXPERIMENTAL_FILEWATCHER) {
        const pending = w.subscribe(Instance.directory, subscribe, {
          ignore: [...FileIgnore.PATTERNS, ...cfgIgnores],
          backend,
        })
        const sub = await withTimeout(pending, SUBSCRIBE_TIMEOUT_MS).catch((err) => {
          log.error("failed to subscribe to Instance.directory", { error: err })
          pending.then((s) => s.unsubscribe()).catch(() => {})
          return undefined
        })
        if (sub) subs.push(sub)
      }

      const vcsDir = await $`git rev-parse --git-dir`
        .quiet()
        .nothrow()
        .cwd(Instance.worktree)
        .text()
        .then((x) => path.resolve(Instance.worktree, x.trim()))
        .catch(() => undefined)
      if (vcsDir && !cfgIgnores.includes(".git") && !cfgIgnores.includes(vcsDir)) {
        const gitDirContents = await readdir(vcsDir).catch(() => [])
        const ignoreList = gitDirContents.filter((entry) => entry !== "HEAD")
        const pending = w.subscribe(vcsDir, subscribe, {
          ignore: ignoreList,
          backend,
        })
        const sub = await withTimeout(pending, SUBSCRIBE_TIMEOUT_MS).catch((err) => {
          log.error("failed to subscribe to vcsDir", { error: err })
          pending.then((s) => s.unsubscribe()).catch(() => {})
          return undefined
        })
        if (sub) subs.push(sub)
      }

      return { subs }
    },
    async (state) => {
      if (!state.subs) return
      await Promise.all(state.subs.map((sub) => sub?.unsubscribe()))
    },
  )

  export function init() {
    if (Flag.GIZZI_EXPERIMENTAL_DISABLE_FILEWATCHER) {
      return
    }
    state()
  }
}
