import { eq, inArray } from "drizzle-orm"
import { Database } from "@/runtime/session/storage/db"
import { RuntimeTable, RuntimeCliTable } from "@/runtime/runtime.sql"
import { Log } from "@/shared/util/log"
import { NamedError } from "@allternit/gizzi-util/error.js"
import z from "zod/v4"
import type { DiscoveredCli, DiscoveredRuntime } from "@/runtime/runtime-discovery"

const log = Log.create({ service: "runtime-service" })

export const RuntimeNotFoundError = NamedError.create(
  "RuntimeNotFoundError",
  z.object({ runtimeId: z.string() }),
)

export interface RegisteredRuntime {
  id: string
  name: string
  host: string
  transport: "local" | "websocket" | "uds"
  status: "online" | "offline" | "busy"
  lastHeartbeatAt?: number
  registeredAt: number
  workspaceId?: string
  metadata?: {
    cwd?: string
    env?: Record<string, string>
    websocketUrl?: string
    udsSocket?: string
    token?: string
  }
  agentClis: DiscoveredCli[]
}

export interface RuntimeUpsertOptions {
  name?: string
  workspaceId?: string
  metadata?: RegisteredRuntime["metadata"]
}

function runtimeIdFor(host: string): string {
  return `rt-${host.replace(/[^a-zA-Z0-9_-]/g, "-")}-${Date.now()}`
}

export namespace RuntimeService {
  export async function register(
    runtime: DiscoveredRuntime,
    options: RuntimeUpsertOptions = {},
  ): Promise<RegisteredRuntime> {
    return Database.use(async (db) => {
      const id = runtimeIdFor(runtime.host)
      const now = Date.now()

      await db.insert(RuntimeTable).values({
        id,
        name: options.name ?? runtime.host,
        host: runtime.host,
        transport: "local",
        status: "online",
        last_heartbeat_at: now,
        registered_at: now,
        workspace_id: options.workspaceId ?? null,
        metadata: options.metadata ?? null,
      })

      if (runtime.agentClis.length > 0) {
        await db.insert(RuntimeCliTable).values(
          runtime.agentClis.map((cli) => ({
            id: `${id}--${cli.name}`,
            runtime_id: id,
            name: cli.name,
            path: cli.path,
            version: cli.version,
            provider_id: cli.name,
            icon: cli.icon,
            discovered_at: now,
          })),
        )
      }

      log.info("runtime registered", { id, host: runtime.host, clis: runtime.agentClis.length })
      return { ...runtimeToModel(id, options.name ?? runtime.host, runtime), registeredAt: now }
    })
  }

  export async function upsertByHost(
    runtime: DiscoveredRuntime,
    options: RuntimeUpsertOptions = {},
  ): Promise<RegisteredRuntime> {
    const existing = await getByHost(runtime.host)
    if (existing) {
      return update(existing.id, runtime, options)
    }
    return register(runtime, options)
  }

  export async function update(
    id: string,
    runtime: DiscoveredRuntime,
    options: RuntimeUpsertOptions = {},
  ): Promise<RegisteredRuntime> {
    return Database.use(async (db) => {
      const now = Date.now()

      await db
        .update(RuntimeTable)
        .set({
          name: options.name ?? undefined,
          status: "online",
          last_heartbeat_at: now,
          workspace_id: options.workspaceId ?? undefined,
          metadata: options.metadata ?? undefined,
        })
        .where(eq(RuntimeTable.id, id))

      await db.delete(RuntimeCliTable).where(eq(RuntimeCliTable.runtime_id, id))

      if (runtime.agentClis.length > 0) {
        await db.insert(RuntimeCliTable).values(
          runtime.agentClis.map((cli) => ({
            id: `${id}--${cli.name}`,
            runtime_id: id,
            name: cli.name,
            path: cli.path,
            version: cli.version,
            provider_id: cli.name,
            icon: cli.icon,
            discovered_at: now,
          })),
        )
      }

      const row = await db.select().from(RuntimeTable).where(eq(RuntimeTable.id, id)).get()
      if (!row) throw new RuntimeNotFoundError({ runtimeId: id })

      const clis = await db.select().from(RuntimeCliTable).where(eq(RuntimeCliTable.runtime_id, id)).all()
      log.info("runtime updated", { id, host: runtime.host, clis: runtime.agentClis.length })
      return rowToRuntime(row, clis)
    })
  }

  export async function get(id: string): Promise<RegisteredRuntime | undefined> {
    return Database.use(async (db) => {
      const row = await db.select().from(RuntimeTable).where(eq(RuntimeTable.id, id)).get()
      if (!row) return undefined
      const clis = await db.select().from(RuntimeCliTable).where(eq(RuntimeCliTable.runtime_id, id)).all()
      return rowToRuntime(row, clis)
    })
  }

  export async function getByHost(host: string): Promise<RegisteredRuntime | undefined> {
    return Database.use(async (db) => {
      const row = await db.select().from(RuntimeTable).where(eq(RuntimeTable.host, host)).get()
      if (!row) return undefined
      const clis = await db.select().from(RuntimeCliTable).where(eq(RuntimeCliTable.runtime_id, row.id)).all()
      return rowToRuntime(row, clis)
    })
  }

  export async function list(): Promise<RegisteredRuntime[]> {
    return Database.use(async (db) => {
      const rows = await db.select().from(RuntimeTable).orderBy(RuntimeTable.time_created).all()
      if (rows.length === 0) return []
      const clis = await db.select().from(RuntimeCliTable).all()
      const clisByRuntime = new Map<string, any[]>()
      for (const cli of clis) {
        const list = clisByRuntime.get(cli.runtime_id) ?? []
        list.push(cli)
        clisByRuntime.set(cli.runtime_id, list)
      }
      return rows.map((row) => rowToRuntime(row, clisByRuntime.get(row.id) ?? []))
    })
  }

  export async function remove(id: string): Promise<boolean> {
    return Database.use(async (db) => {
      const result = await db.delete(RuntimeTable).where(eq(RuntimeTable.id, id))
      const deleted = (result as any).rowsAffected > 0
      if (deleted) log.info("runtime removed", { id })
      return deleted
    })
  }

  export async function heartbeat(id: string): Promise<void> {
    return Database.use(async (db) => {
      await db
        .update(RuntimeTable)
        .set({ status: "online", last_heartbeat_at: Date.now() })
        .where(eq(RuntimeTable.id, id))
    })
  }

  export async function markOffline(id: string): Promise<void> {
    return Database.use(async (db) => {
      await db.update(RuntimeTable).set({ status: "offline" }).where(eq(RuntimeTable.id, id))
    })
  }

  export async function markBusy(id: string, busy: boolean): Promise<void> {
    return Database.use(async (db) => {
      const status = busy ? "busy" : "online"
      await db.update(RuntimeTable).set({ status }).where(eq(RuntimeTable.id, id))
    })
  }

  export async function markMultipleOffline(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    return Database.use(async (db) => {
      await db.update(RuntimeTable).set({ status: "offline" }).where(inArray(RuntimeTable.id, ids))
    })
  }

  function runtimeToModel(
    id: string,
    name: string,
    runtime: DiscoveredRuntime,
  ): RegisteredRuntime {
    return {
      id,
      name,
      host: runtime.host,
      transport: "local",
      status: "online",
      lastHeartbeatAt: Date.now(),
      registeredAt: Date.now(),
      agentClis: runtime.agentClis,
    }
  }

  function rowToRuntime(row: any, clis: any[]): RegisteredRuntime {
    return {
      id: row.id,
      name: row.name,
      host: row.host,
      transport: row.transport,
      status: row.status,
      lastHeartbeatAt: row.last_heartbeat_at ?? undefined,
      registeredAt: row.registered_at,
      workspaceId: row.workspace_id ?? undefined,
      metadata: row.metadata ?? undefined,
      agentClis: clis.map((cli) => ({
        name: cli.name,
        path: cli.path,
        version: cli.version,
        icon: cli.icon,
      })),
    }
  }
}
