import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { DialogSelect } from "@/cli/ui/tui/ui/dialog-select"
import { useRoute } from "@/cli/ui/tui/context/route"
import { useSync } from "@/cli/ui/tui/context/sync"
import { createMemo, createSignal, createResource, onMount, Show } from "solid-js"
import { Locale } from "@/runtime/util/locale"
import { useKeybind } from "@/cli/ui/tui/context/keybind"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { DialogSessionRename } from "@/cli/ui/tui/component/dialog-session-rename"
import { useKV } from "@/cli/ui/tui/context/kv"
import { createDebouncedSignal } from "@/cli/ui/tui/util/signal"
import { Spinner } from "@/cli/ui/tui/component/spinner"
import { GIZZICopy } from "@/runtime/brand/brand"
import { Log } from "@/runtime/util/log"

// Local types since SDK exports 'unknown'
interface TimeInfo {
  created: number
  updated?: number
  completed?: number
}

interface SessionStatus {
  type: "idle" | "busy" | "retry" | "waiting" | "completed" | "failed"
  message?: string
  attempt?: number
  next?: string
}

interface Session {
  id: string
  title?: string
  parentID?: string
  time: TimeInfo
}

export function DialogSessionList() {
  const dialog = useDialog()
  const route = useRoute()
  const sync = useSync()
  const keybind = useKeybind()
  const { theme } = useTheme()
  const sdk = useSDK()
  const kv = useKV()

  const [toDelete, setToDelete] = createSignal<string>()
  const [search, setSearch] = createDebouncedSignal("", 150)

  const [searchResults] = createResource(search, async (query) => {
    if (!query) return undefined
    const result = await sdk.client.session.list({ query: { search: query, limit: 30 } } as any)
    return (result.data ?? []) as Session[]
  })

  const currentSessionID = createMemo(() => (route.data.type === "session" ? route.data.sessionID : undefined))

  const sessions = createMemo(() => {
    const fromSearch = searchResults()
    const fromSync = sync.data.session
    const data = Array.isArray(fromSearch) ? fromSearch : (Array.isArray(fromSync) ? fromSync : [])
    Log.Default.info("tui: dialog session list data", { count: data.length, fromSearch: Array.isArray(fromSearch), fromSync: Array.isArray(fromSync) })
    return data as Session[]
  })

  const options = createMemo(() => {
    const today = new Date().toDateString()
    const sessionList = sessions()
    if (!Array.isArray(sessionList)) {
      Log.Default.warn("tui: dialog session list - sessions is not an array", { type: typeof sessionList })
      return []
    }
    const sessionStatus = sync.data.session_status as unknown as Record<string, SessionStatus> | undefined
    return sessionList
      .filter((x) => x && x.parentID === undefined)
      .slice().sort((a, b) => (b.time?.updated || 0) - (a.time?.updated || 0))
      .filter((x) => x && x.time && typeof x.time.updated === 'number')
      .map((x) => {
        const date = new Date(x.time.updated!)
        let category = date.toDateString()
        if (category === today) {
          category = "Today"
        }
        const isDeleting = toDelete() === x.id
        const status = sessionStatus?.[x.id]
        const isWorking = status?.type === "busy"
        return {
          title: isDeleting ? GIZZICopy.dialogs.pressAgainToConfirm({ keybind: keybind.print("session_delete") }) : (x.title || "Untitled"),
          bg: isDeleting ? theme.error : undefined,
          value: x.id,
          category,
          footer: Locale.time(x.time.updated!),
          gutter: isWorking ? <Spinner /> : undefined,
        }
      })
  })

  onMount(() => {
    dialog.setSize("large")
  })

  return (
    <DialogSelect
      title={GIZZICopy.dialogs.sessionsTitle}
      options={options()}
      skipFilter={true}
      current={currentSessionID()}
      onFilter={setSearch}
      onMove={() => {
        setToDelete(undefined)
      }}
      onSelect={(option) => {
        route.navigate({
          type: "session",
          sessionID: option.value,
        })
        dialog.clear()
      }}
      keybind={[
        {
          keybind: keybind.all.session_delete?.[0],
          title: GIZZICopy.dialogs.delete,
          onTrigger: async (option) => {
            if (toDelete() === option.value) {
              sdk.client.session.delete({
                path: { sessionID: option.value },
              })
              setToDelete(undefined)
              return
            }
            setToDelete(option.value)
          },
        },
        {
          keybind: keybind.all.session_rename?.[0],
          title: GIZZICopy.dialogs.rename,
          onTrigger: async (option) => {
            dialog.replace(() => <DialogSessionRename session={option.value} />)
          },
        },
      ]}
    />
  )
}
