import { $ } from "bun"
import fs from "fs/promises"
import path from "path"
import z from "zod/v4"
import { NamedError } from "@allternit/util/error"
import { Global } from "@/runtime/context/global"
import { Instance } from "@/runtime/context/project/instance"
import { InstanceBootstrap } from "@/runtime/context/project/bootstrap"
import { fn } from "@/shared/util/fn"
import { Log } from "@/shared/util/log"
import { BusEvent } from "@/shared/bus/bus-event"

export namespace Worktree {
  const log = Log.create({ service: "worktree" })

  export const Event = {
    Ready: BusEvent.define(
      "worktree.ready",
      z.object({
        name: z.string(),
        branch: z.string(),
      }),
    ),
    Failed: BusEvent.define(
      "worktree.failed",
      z.object({
        message: z.string(),
      }),
    ),
  }

  export const Info = z
    .object({
      name: z.string(),
      branch: z.string(),
      directory: z.string(),
    })
    

  export type Info = z.infer<typeof Info>

  export const CreateInput = z
    .object({
      name: z.string().optional(),
      branch: z.string().optional(),
      revision: z.string().optional(),
    })
    

  export type CreateInput = z.infer<typeof CreateInput>

  export const RemoveInput = z
    .object({
      name: z.string(),
    })
    

  export type RemoveInput = z.infer<typeof RemoveInput>

  export const ListInput = z
    .object({
      projectID: z.string().optional(),
    })
    

  export type ListInput = z.infer<typeof ListInput>

  export const Path = {
    root: path.join(Global.Path.data, "worktrees"),
  }

  async function initRoot() {
    await fs.mkdir(Path.root, { recursive: true })
  }

  export const create = fn(
    CreateInput,
    async (input): Promise<Info> => {
      await initRoot()
      const branch: string = input.branch || (await Vcs.branch()) || "main"
      const name: string = input.name || `wt-${Date.now()}`
      const directory = path.join(Path.root, name)

      log.info("creating worktree", { name, branch, directory })

      try {
        await $`git worktree add -b ${branch} ${directory} ${input.revision || "HEAD"}`
          .quiet()
          .cwd(Instance.worktree)
        
        await Instance.provide({
          directory,
          init: InstanceBootstrap,
          async fn() {
            log.info("worktree initialized", { name })
          },
        })

        Bus.publish(Event.Ready, { name, branch })
        return { name, branch, directory }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log.error("failed to create worktree", { error: message })
        Bus.publish(Event.Failed, { message })
        throw error
      }
    },
  )

  export const list = fn(
    ListInput,
    async (input): Promise<Info[]> => {
      await initRoot()
      const entries = await fs.readdir(Path.root, { withFileTypes: true })
      const result: Info[] = []

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const directory = path.join(Path.root, entry.name)
        try {
          const branch = await $`git rev-parse --abbrev-ref HEAD`
            .quiet()
            .cwd(directory)
            .text()
            .then((x: string) => x.trim())
          result.push({ name: entry.name, branch, directory })
        } catch {
          // Not a git repo or directory removed
        }
      }

      return result
    },
  )

  export const remove = fn(
    RemoveInput,
    async (input): Promise<void> => {
      const directory = path.join(Path.root, input.name)
      log.info("removing worktree", { name: input.name, directory })

      try {
        await $`git worktree remove ${directory} --force`.quiet().cwd(Instance.worktree)
        await fs.rm(directory, { recursive: true, force: true })
      } catch (error) {
        log.error("failed to remove worktree", { name: input.name, error })
        throw error
      }
    },
  )
}

// Add VCS dependency bridge
import { Vcs } from "@/runtime/context/project/vcs"
import { Bus } from "@/shared/bus"
