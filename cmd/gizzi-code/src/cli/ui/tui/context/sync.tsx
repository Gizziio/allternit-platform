import type {
  Message,
  Agent,
  Provider,
  Session,
  Part,
  Config,
  Todo,
  Command,
  LspStatus,
  McpStatus,
  FormatterStatus,
  SessionStatus,
  ProviderListResponse,
  ProviderAuthMethod,
  VcsInfo,
} from "@a2r/sdk"

// These types exist only in the internal event bus, not in the generated SDK
type PermissionRequest = unknown
type QuestionRequest = unknown
type McpResource = unknown
import type { UserData } from "@/runtime/context/user"
import type { RunRegistry } from "@/runtime/session/run-registry"
import type { CronTypes } from "@/runtime/automation/cron/types"
import { createStore, produce, reconcile } from "solid-js/store"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { Binary } from "@a2r/util/binary"
import { createSimpleContext } from "@/cli/ui/tui/context/helper"
import type { Snapshot } from "@/runtime/session/snapshot"
import { useExit } from "@/cli/ui/tui/context/exit"
import { useArgs } from "@/cli/ui/tui/context/args"
import { batch, onMount } from "solid-js"
import { Log } from "@/shared/util/log"
import type { Path } from "@a2r/sdk"
import { GIZZIBrand, sanitizeBrandSurface } from "@/shared/brand"
import { Instance } from "@/runtime/context/project/instance"

export const { use: useSync, provider: SyncProvider } = createSimpleContext({
  name: "Sync",
  init: () => {
    const [store, setStore] = createStore<{
      status: "loading" | "partial" | "complete"
      provider: Provider[]
      provider_default: Record<string, string>
      provider_next: ProviderListResponse
      provider_auth: Record<string, ProviderAuthMethod[]>
      agent: Agent[]
      command: Command[]
      permission: {
        [sessionID: string]: PermissionRequest[]
      }
      question: {
        [sessionID: string]: QuestionRequest[]
      }
      config: Config
      session: Session[]
      session_status: {
        [sessionID: string]: SessionStatus
      }
      session_diff: {
        [sessionID: string]: Snapshot.FileDiff[]
      }
      todo: {
        [sessionID: string]: Todo[]
      }
      message: {
        [sessionID: string]: Message[]
      }
      part: {
        [messageID: string]: Part[]
      }
      lsp: LspStatus[]
      mcp: {
        [key: string]: McpStatus
      }
      mcp_resource: {
        [key: string]: McpResource
      }
      formatter: FormatterStatus[]
      vcs: VcsInfo | undefined
      path: Path
      runs: Record<string, RunRegistry.RunInfo>
      cron_jobs: CronTypes.CronJob[]
      cron_runs: CronTypes.CronRun[]
      cron_status: { jobs: number; active: number; pendingRuns: number; runningRuns: number }
      user: UserData | null
      workspace: {
        type: "gizzi" | "openclaw"
        format: "layered" | "flat"
        path: string
        name?: string
        emoji?: string
        vibe?: string
        hasMemory?: boolean
        hasSoul?: boolean
        hasBrain?: boolean
        layered?: boolean
      } | null
    }>({
      provider_next: {
        all: [],
        default: {},
        connected: [],
      },
      provider_auth: {},
      config: {},
      status: "loading",
      agent: [],
      permission: {},
      question: {},
      command: [],
      provider: [],
      provider_default: {},
      session: [],
      session_status: {},
      session_diff: {},
      todo: {},
      message: {},
      part: {},
      lsp: [],
      mcp: {},
      mcp_resource: {},
      formatter: [],
      vcs: undefined,
      path: { state: "", config: "", worktree: "", directory: "", root: "", home: "", data: "" } as any,
      // Run and cron state
      runs: {} as Record<string, RunRegistry.RunInfo>,
      cron_jobs: [] as CronTypes.CronJob[],
      cron_runs: [] as CronTypes.CronRun[],
      cron_status: { jobs: 0, active: 0, pendingRuns: 0, runningRuns: 0 },
      user: null,
      workspace: null,
    })

    const sdk = useSDK()

    sdk.event.listen((e) => {
      const event = e.details
      switch (event.type) {
        case "server.instance.disposed":
          bootstrap()
          break
        case "permission.replied": {
          const requests = store.permission[event.properties.sessionID]
          if (!requests) break
          const match = Binary.search(requests, event.properties.requestID, (r: any) => r.id)
          if (!match.found) break
          setStore(
            "permission",
            event.properties.sessionID,
            produce((draft) => {
              draft.splice(match.index, 1)
            }),
          )
          break
        }

        case "permission.asked": {
          const request = event.properties
          const requests = store.permission[request.sessionID]
          if (!requests) {
            setStore("permission", request.sessionID, [request])
            break
          }
          const match = Binary.search(requests, request.id, (r: any) => r.id)
          if (match.found) {
            setStore("permission", request.sessionID, match.index, reconcile(request))
            break
          }
          setStore(
            "permission",
            request.sessionID,
            produce((draft) => {
              draft.splice(match.index, 0, request)
            }),
          )
          break
        }

        case "question.replied":
        case "question.rejected": {
          const requests = store.question[event.properties.sessionID]
          if (!requests) break
          const match = Binary.search(requests, event.properties.requestID, (r: any) => r.id)
          if (!match.found) break
          setStore(
            "question",
            event.properties.sessionID,
            produce((draft) => {
              draft.splice(match.index, 1)
            }),
          )
          break
        }

        case "question.asked": {
          const request = event.properties
          const requests = store.question[request.sessionID]
          if (!requests) {
            setStore("question", request.sessionID, [request])
            break
          }
          const match = Binary.search(requests, request.id, (r: any) => r.id)
          if (match.found) {
            setStore("question", request.sessionID, match.index, reconcile(request))
            break
          }
          setStore(
            "question",
            request.sessionID,
            produce((draft) => {
              draft.splice(match.index, 0, request)
            }),
          )
          break
        }

        case "todo.updated":
          setStore("todo", event.properties.sessionID, event.properties.todos)
          break

        case "session.diff":
          setStore("session_diff", event.properties.sessionID, event.properties.diff)
          break

        case "session.deleted": {
          const result = Binary.search(store.session, event.properties.info.id, (s: any) => s.id)
          if (result.found) {
            setStore(
              "session",
              produce((draft) => {
                draft.splice(result.index, 1)
              }),
            )
          }
          break
        }
        case "session.updated": {
          const result = Binary.search(store.session, event.properties.info.id, (s: any) => s.id)
          if (result.found) {
            setStore("session", result.index, reconcile(event.properties.info))
            break
          }
          setStore(
            "session",
            produce((draft) => {
              draft.splice(result.index, 0, event.properties.info)
            }),
          )
          break
        }

        case "session.status": {
          setStore("session_status", event.properties.sessionID, event.properties.status)
          break
        }

        case "message.updated": {
          const messages = store.message[event.properties.info.sessionID]
          if (!messages) {
            setStore("message", event.properties.info.sessionID, [event.properties.info])
            break
          }
          const result = Binary.search(messages, event.properties.info.id, (m: any) => m.id)
          if (result.found) {
            setStore("message", event.properties.info.sessionID, result.index, reconcile(event.properties.info))
            break
          }
          setStore(
            "message",
            event.properties.info.sessionID,
            produce((draft) => {
              draft.splice(result.index, 0, event.properties.info)
            }),
          )
          const updated = store.message[event.properties.info.sessionID]
          if (updated.length > 100) {
            const oldest: any = updated[0]
            batch(() => {
              setStore(
                "message",
                event.properties.info.sessionID,
                produce((draft) => {
                  draft.shift()
                }),
              )
              setStore(
                "part",
                produce((draft) => {
                  delete draft[oldest.id]
                }),
              )
            })
          }
          break
        }
        case "message.removed": {
          const messages = store.message[event.properties.sessionID]
          const result = Binary.search(messages, event.properties.messageID, (m: any) => m.id)
          if (result.found) {
            setStore(
              "message",
              event.properties.sessionID,
              produce((draft) => {
                draft.splice(result.index, 1)
              }),
            )
          }
          break
        }
        case "message.part.updated": {
          const parts = store.part[event.properties.part.messageID]
          if (!parts) {
            setStore("part", event.properties.part.messageID, [event.properties.part])
            break
          }
          const result = Binary.search(parts, event.properties.part.id, (p: any) => p.id)
          if (result.found) {
            setStore("part", event.properties.part.messageID, result.index, reconcile(event.properties.part))
            break
          }
          setStore(
            "part",
            event.properties.part.messageID,
            produce((draft) => {
              draft.splice(result.index, 0, event.properties.part)
            }),
          )
          break
        }

        case "message.part.delta": {
          const parts = store.part[event.properties.messageID]
          if (!parts) break
          const result = Binary.search(parts, event.properties.partID, (p: any) => p.id)
          if (!result.found) break
          setStore(
            "part",
            event.properties.messageID,
            produce((draft) => {
              const part: any = draft[result.index]
              const field = event.properties.field as keyof typeof part
              const existing = part[field] as string | undefined
              ;(part[field] as string) = (existing ?? "") + event.properties.delta
            }),
          )
          break
        }

        case "message.part.removed": {
          const parts = store.part[event.properties.messageID]
          const result = Binary.search(parts, event.properties.partID, (p: any) => p.id)
          if (result.found)
            setStore(
              "part",
              event.properties.messageID,
              produce((draft) => {
                draft.splice(result.index, 1)
              }),
            )
          break
        }

        case "lsp.updated": {
          sdk.client.lsp.status().then((x: any) => setStore("lsp", x.data!))
          break
        }

        case "vcs.branch.updated": {
          setStore("vcs", { branch: event.properties.branch })
          break
        }

        case "user.updated": {
          setStore("user", event.properties.user)
          break
        }

      }
    })

    const exit = useExit()
    const args = useArgs()

    async function bootstrap() {
      // Provide Instance context before bootstrapping
      await Instance.provide({
        directory: process.cwd(),
        init: async () => {},
        fn: async () => {
          await bootstrapInternal()
        }
      })
    }
    
    async function bootstrapInternal() {
      const start = Date.now() - 30 * 24 * 60 * 60 * 1000
      const projectId = Instance.project.id
      const sessionListPromise = sdk.client.session
        .list()
        .then((x: any) => {
          Log.Default.info("tui: sync session list received", { 
            count: Array.isArray(x.data) ? x.data.length : 0,
            error: x.error?.message,
            projectId 
          })
          const sessions = Array.isArray(x.data) ? x.data : []
          return sessions.slice().sort((a: any, b: any) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0))
        })

      // blocking - include session.list when continuing a session
      const providersPromise = sdk.client.config.providers({ throwOnError: true })
      const providerListPromise = sdk.client.provider.list({ throwOnError: true })
      const agentsPromise = sdk.client.agent.list({ throwOnError: true })
      const configPromise = sdk.client.config.get({ throwOnError: true })
      const blockingRequests: Promise<unknown>[] = [
        providersPromise,
        providerListPromise,
        agentsPromise,
        configPromise,
        sessionListPromise,
      ]

      await Promise.all(blockingRequests)
        .then(() => {
          const providersResponse = providersPromise.then((x: any) => x.data!)
          const providerListResponse = providerListPromise.then((x: any) => x.data!)
          const agentsResponse = agentsPromise.then((x: any) => x.data ?? [])
          const configResponse = configPromise.then((x: any) => x.data!)
          const sessionListResponse = sessionListPromise

          return Promise.all([
            providersResponse,
            providerListResponse,
            agentsResponse,
            configResponse,
            sessionListResponse,
          ]).then((responses) => {
            const providers = responses[0]
            const providerList = responses[1]
            const agents = responses[2]
            const config = responses[3]
            const sessions = responses[4]

            // Rebrand provider labels in UI-facing lists.
            const transformProviderName = (name: string) => {
              if (!name) return name
              return name
                .replace(/\bohmygizzi\b/gi, `${GIZZIBrand.name} Zen`)
                .replace(/\bopen[\s-]?code\b/gi, `${GIZZIBrand.name} Zen`)
            }
            const transformedProviderList = {
              ...providerList,
              all: providerList.all.map((p: any) => ({ ...p, name: transformProviderName(p.name) })),
            }
            const transformedProviders = providers.providers.map((p: any) => ({ ...p, name: transformProviderName(p.name) }))

            // Sanitize agent descriptions to remove GIZZI branding
            const sanitizedAgents = agents.map((agent: any) => ({
              ...agent,
              description: agent.description ? sanitizeBrandSurface(agent.description) : agent.description,
            }))

            batch(() => {
              setStore("provider", reconcile(transformedProviders))
              setStore("provider_default", reconcile(providers.default))
              setStore("provider_next", reconcile(transformedProviderList))
              setStore("agent", reconcile(sanitizedAgents))
              setStore("config", reconcile(config))
              setStore("session", reconcile(sessions))
            })
          })
        })
        .then(() => {
          if (store.status !== "complete") setStore("status", "partial")
          // non-blocking
          Log.Default.info("tui: starting non-blocking sync requests")
          Promise.allSettled([
            (sdk.client as any).command?.list().then((x: any) => { Log.Default.info("tui: sync command list done"); setStore("command", reconcile(x.data ?? []))}),
            sdk.client.lsp.status().then((x: any) => { Log.Default.info("tui: sync lsp status done"); setStore("lsp", reconcile(x.data ?? []))}),
            sdk.client.mcp.status().then((x: any) => { Log.Default.info("tui: sync mcp status done"); setStore("mcp", reconcile(x.data ?? {}))}),
            (sdk.client as any).experimental.resource.list().then((x: any) => { Log.Default.info("tui: sync mcp resource done"); setStore("mcp_resource", reconcile(x.data ?? {}))}),
            sdk.client.formatter.status().then((x: any) => { Log.Default.info("tui: sync formatter status done"); setStore("formatter", reconcile(x.data ?? []))}),
            sdk.client.session.allstatus().then((x: any) => {
              Log.Default.info("tui: sync session status done")
              setStore("session_status", reconcile(x.data ?? {}))
            }),
            sdk.client.provider.auth().then((x: any) => { Log.Default.info("tui: sync provider auth done"); setStore("provider_auth", reconcile(x.data ?? {}))}),
            sdk.client.vcs.get().then((x: any) => { Log.Default.info("tui: sync vcs done"); setStore("vcs", reconcile(x.data))}),
            sdk.client.path.get().then((x: any) => { Log.Default.info("tui: sync path done"); setStore("path", reconcile(x.data ?? { state: "", config: "", worktree: "", directory: "" }))}),
            (sdk.client as any).instance?.workspace?.().then((x: any) => { Log.Default.info("tui: sync workspace done"); setStore("workspace", reconcile(x.data ?? null)) }).catch(() => {}),
            (sdk.client as any).user.get().then((x: any) => {
              Log.Default.info("tui: sync user done")
              setStore("user", reconcile(x.data ?? null))
            }),
          ]).then(() => {
            Log.Default.info("tui: all sync requests settled")
            setStore("status", "complete")
          })
        })
        .catch(async (e) => {
          Log.Default.error("tui bootstrap failed", {
            error: e instanceof Error ? e.message : String(e),
            name: e instanceof Error ? e.name : undefined,
            stack: e instanceof Error ? e.stack : undefined,
          })
          await exit(e)
        })
    }

    onMount(() => {
      bootstrap()
    })

    const fullSyncedSessions = new Set<string>()
    const result = {
      data: store,
      set: setStore,
      get status() {
        return store.status
      },
      get ready() {
        return store.status !== "loading"
      },
      session: {
        get(sessionID: string) {
          const match = Binary.search(store.session, sessionID, (s: any) => s.id)
          if (match.found) return store.session[match.index]
          return undefined
        },
        status(sessionID: string) {
          const session = result.session.get(sessionID) as any
          if (!session) return "idle"
          if (session?.time?.compacting) return "compacting"
          const messages = store.message[sessionID] ?? []
          const last = messages.at(-1) as any
          if (!last) return "idle"
          if (last?.role === "user") return "working"
          return last?.time?.completed ? "idle" : "working"
        },
        async sync(sessionID: string) {
          if (fullSyncedSessions.has(sessionID)) return
          const [session, messages, todo, diff] = await Promise.all([
            sdk.client.session.get({ path: { sessionID }, throwOnError: true } as any),
            sdk.client.session.messages({ path: { sessionID }, query: { limit: 100 } } as any),
            sdk.client.session.todo({ path: { sessionID } } as any),
            sdk.client.session.diff({ path: { sessionID } } as any),
          ])
          setStore(
            produce((draft) => {
              const match = Binary.search(draft.session, sessionID, (s: any) => s.id)
              if (match.found) draft.session[match.index] = session.data!
              if (!match.found) draft.session.splice(match.index, 0, session.data!)
              draft.todo[sessionID] = todo.data ?? []
              const messageList = messages.data ?? []
              draft.message[sessionID] = messageList.map((x: any) => x.info)
              for (const message of messageList) {
                draft.part[(message as any).info.id] = (message as any).parts
              }
              draft.session_diff[sessionID] = diff.data ?? []
            }),
          )
          fullSyncedSessions.add(sessionID)
        },
      },
      bootstrap,
    }
    return result
  },
})
