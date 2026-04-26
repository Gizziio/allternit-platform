import { createStore } from "solid-js/store"
import { createSimpleContext } from "@/cli/ui/ink-app/context/helper"
import type { PromptInfo } from "@/cli/ui/ink-app/component/prompt/history"

export type HomeRoute = {
  type: "home"
  initialPrompt?: PromptInfo
}

export type SessionRoute = {
  type: "session"
  sessionID: string
  initialPrompt?: PromptInfo
}

export type AgentModeRoute = {
  type: "agent-mode"
  tab?: "agents" | "cron" | "runs"
}

export type BackgroundTasksRoute = {
  type: "background-tasks"
}

export type CoworkRoute = {
  type: "cowork"
  runID?: string
  tab?: "dashboard" | "sessions" | "templates"
}

export type Route = HomeRoute | SessionRoute | AgentModeRoute | BackgroundTasksRoute | CoworkRoute

export const { use: useRoute, provider: RouteProvider } = createSimpleContext({
  name: "Route",
  init: () => {
    const [store, setStore] = createStore<Route>(
      process.env["GIZZI_ROUTE"]
        ? JSON.parse(process.env["GIZZI_ROUTE"])
        : {
            type: "home",
          },
    )

    return {
      get data() {
        return store
      },
      navigate(route: Route) {
        setStore(route)
      },
    }
  },
})

export type RouteContext = ReturnType<typeof useRoute>

export function useRouteData<T extends Route["type"]>(type: T) {
  const route = useRoute()
  return route.data as Extract<Route, { type: typeof type }>
}
