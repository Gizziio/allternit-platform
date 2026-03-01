import { createStore } from "solid-js/store"
import { batch, createEffect, createMemo } from "solid-js"
import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"
import { uniqueBy } from "remeda"
import path from "path"
import { Global } from "@/global"
import { iife } from "@/util/iife"
import { createSimpleContext } from "./helper"
import { useToast } from "../ui/toast"
import { Provider } from "@/provider/provider"
import { useArgs } from "./args"
import { useSDK } from "./sdk"
import { RGBA } from "@opentui/core"
import { Filesystem } from "@/util/filesystem"
import { A2RCopy } from "@/brand"
import { blockedModelReason, isModelBlocked } from "@/util/model-safety"

export const { use: useLocal, provider: LocalProvider } = createSimpleContext({
  name: "Local",
  init: () => {
    const sync = useSync()
    const sdk = useSDK()
    const toast = useToast()

    function isModelValid(model: { providerID: string; modelID: string }) {
      // Check both configured providers and all available providers
      const provider = sync.data.provider.find((x) => x.id === model.providerID) || 
                       sync.data.provider_next.all.find((x) => x.id === model.providerID)
      return !!provider?.models[model.modelID]
    }

    function getBlockedModelReason(model: { providerID: string; modelID: string }) {
      const provider = sync.data.provider.find((x) => x.id === model.providerID) ||
                       sync.data.provider_next.all.find((x) => x.id === model.providerID)
      const info = provider?.models[model.modelID]
      return blockedModelReason({
        providerID: model.providerID,
        modelID: model.modelID,
        name: info?.name,
      })
    }

    function isBlockedAgentDefaultModel(model: { providerID: string; modelID: string }) {
      const provider = sync.data.provider.find((x) => x.id === model.providerID) ||
                       sync.data.provider_next.all.find((x) => x.id === model.providerID)
      const info = provider?.models[model.modelID]
      return isModelBlocked({
        providerID: model.providerID,
        modelID: model.modelID,
        name: info?.name,
      })
    }

    function getPreferredFallbackModel() {
      const preferred = [
        { providerID: "a2r", modelID: "minimax-m2.5-free" },
        { providerID: "a2r", modelID: "glm-5-free" },
        { providerID: "a2r", modelID: "big-pickle" },
        { providerID: "a2r", modelID: "trinity-large-preview-free" },
      ]

      for (const candidate of preferred) {
        if (!isModelValid(candidate)) continue
        if (isBlockedAgentDefaultModel(candidate)) continue
        return candidate
      }
    }

    function getFirstValidModel(...modelFns: (() => { providerID: string; modelID: string } | undefined)[]) {
      for (const modelFn of modelFns) {
        const model = modelFn()
        if (!model) continue
        if (isModelValid(model)) return model
      }
    }

    const agent = iife(() => {
      const agents = createMemo(() => sync.data.agent.filter((x) => x.mode !== "subagent" && !x.hidden))
      const visibleAgents = createMemo(() => sync.data.agent.filter((x) => !x.hidden))
      const [agentStore, setAgentStore] = createStore<{
        current: string
      }>({
        current: agents()[0].name,
      })
      const { theme } = useTheme()
      const colors = createMemo(() => [
        theme.secondary,
        theme.accent,
        theme.success,
        theme.warning,
        theme.primary,
        theme.error,
        theme.info,
      ])
      return {
        list() {
          return agents()
        },
        current() {
          return agents().find((x) => x.name === agentStore.current)!
        },
        set(name: string) {
          if (!agents().some((x) => x.name === name))
            return toast.show({
              variant: "warning",
              message: `Agent not found: ${name}`,
              duration: 3000,
            })
          setAgentStore("current", name)
        },
        move(direction: 1 | -1) {
          batch(() => {
            let next = agents().findIndex((x) => x.name === agentStore.current) + direction
            if (next < 0) next = agents().length - 1
            if (next >= agents().length) next = 0
            const value = agents()[next]
            setAgentStore("current", value.name)
          })
        },
        color(name: string) {
          const index = visibleAgents().findIndex((x) => x.name === name)
          if (index === -1) return colors()[0]
          const agent = visibleAgents()[index]

          if (agent?.color) {
            const color = agent.color
            if (color.startsWith("#")) return RGBA.fromHex(color)
            // already validated by config, just satisfying TS here
            return theme[color as keyof typeof theme] as RGBA
          }
          return colors()[index % colors().length]
        },
      }
    })

    const model = iife(() => {
      const [modelStore, setModelStore] = createStore<{
        ready: boolean
        model: Record<
          string,
          {
            providerID: string
            modelID: string
          }
        >
        recent: {
          providerID: string
          modelID: string
        }[]
        favorite: {
          providerID: string
          modelID: string
        }[]
        variant: Record<string, string | undefined>
      }>({
        ready: false,
        model: {},
        recent: [],
        favorite: [],
        variant: {},
      })

      const filePath = path.join(Global.Path.state, "model.json")
      const state = {
        pending: false,
      }

      function save() {
        if (!modelStore.ready) {
          state.pending = true
          return
        }
        state.pending = false
        Filesystem.writeJson(filePath, {
          recent: modelStore.recent,
          favorite: modelStore.favorite,
          variant: modelStore.variant,
        })
      }

      Filesystem.readJson(filePath)
        .then((x: any) => {
          if (Array.isArray(x.recent)) setModelStore("recent", x.recent)
          if (Array.isArray(x.favorite)) setModelStore("favorite", x.favorite)
          if (typeof x.variant === "object" && x.variant !== null) setModelStore("variant", x.variant)
        })
        .catch(() => {})
        .finally(() => {
          setModelStore("ready", true)
          if (state.pending) save()
        })

      const args = useArgs()
      const fallbackModel = createMemo(() => {
        if (args.model) {
          const { providerID, modelID } = Provider.parseModel(args.model)
          if (isModelValid({ providerID, modelID }) && !isBlockedAgentDefaultModel({ providerID, modelID })) {
            return {
              providerID,
              modelID,
            }
          }
        }

        if (sync.data.config.model) {
          const { providerID, modelID } = Provider.parseModel(sync.data.config.model)
          if (isModelValid({ providerID, modelID }) && !isBlockedAgentDefaultModel({ providerID, modelID })) {
            return {
              providerID,
              modelID,
            }
          }
        }

        for (const item of modelStore.recent) {
          if (isModelValid(item) && !isBlockedAgentDefaultModel(item)) {
            return item
          }
        }

        const preferred = getPreferredFallbackModel()
        if (preferred) return preferred

        // Combine configured providers with all available providers for fallback selection
        const allProviders = [...sync.data.provider, ...sync.data.provider_next.all]
        // Remove duplicates (prefer configured providers)
        const uniqueProviders = Array.from(new Map(allProviders.map(p => [p.id, p])).values())
        
        for (const provider of uniqueProviders) {
          const defaultModel = sync.data.provider_default[provider.id]
          const defaultModelAllowed =
            defaultModel && !isBlockedAgentDefaultModel({ providerID: provider.id, modelID: defaultModel })
              ? defaultModel
              : undefined
          const firstModel = Object.values(provider.models).find(
            (entry) => !isBlockedAgentDefaultModel({ providerID: provider.id, modelID: entry.id }),
          )
          const model = defaultModelAllowed ?? firstModel?.id
          if (!model) continue
          return {
            providerID: provider.id,
            modelID: model,
          }
        }
      })

      const currentModel = createMemo(() => {
        const a = agent.current()
        return (
          getFirstValidModel(
            () => modelStore.model[a.name],
            () => {
              if (!a.model) return undefined
              if (isBlockedAgentDefaultModel(a.model)) return undefined
              return a.model
            },
            fallbackModel,
          ) ?? undefined
        )
      })

      return {
        current: currentModel,
        get ready() {
          return modelStore.ready
        },
        recent() {
          return modelStore.recent
        },
        favorite() {
          return modelStore.favorite
        },
        parsed: createMemo(() => {
          const value = currentModel()
          if (!value) {
            return {
              provider: A2RCopy.model.connectProvider,
              model: A2RCopy.model.noProviderSelected,
              reasoning: false,
            }
          }
          // Check both configured providers and all available providers
          const provider = sync.data.provider.find((x) => x.id === value.providerID) ||
                          sync.data.provider_next.all.find((x) => x.id === value.providerID)
          const info = provider?.models[value.modelID]
          // Handle both Provider.Model (with capabilities.reasoning) and ModelsDev.Model (with direct reasoning)
          const reasoning = info && ('capabilities' in info) 
            ? (info as any).capabilities?.reasoning 
            : (info as any)?.reasoning ?? false
          return {
            provider: provider?.name ?? value.providerID,
            model: info?.name ?? value.modelID,
            reasoning,
          }
        }),
        cycle(direction: 1 | -1) {
          const current = currentModel()
          if (!current) return
          const recent = modelStore.recent.filter((item) => isModelValid(item) && !isBlockedAgentDefaultModel(item))
          if (!recent.length) return
          const index = recent.findIndex((x) => x.providerID === current.providerID && x.modelID === current.modelID)
          if (index === -1) return
          let next = index + direction
          if (next < 0) next = recent.length - 1
          if (next >= recent.length) next = 0
          const val = recent[next]
          if (!val) return
          setModelStore("model", agent.current().name, { ...val })
        },
        cycleFavorite(direction: 1 | -1) {
          const favorites = modelStore.favorite.filter((item) => isModelValid(item) && !isBlockedAgentDefaultModel(item))
          if (!favorites.length) {
            toast.show({
              variant: "info",
              message: A2RCopy.model.addFavoriteToUseShortcut,
              duration: 3000,
            })
            return
          }
          const current = currentModel()
          let index = -1
          if (current) {
            index = favorites.findIndex((x) => x.providerID === current.providerID && x.modelID === current.modelID)
          }
          if (index === -1) {
            index = direction === 1 ? 0 : favorites.length - 1
          } else {
            index += direction
            if (index < 0) index = favorites.length - 1
            if (index >= favorites.length) index = 0
          }
          const next = favorites[index]
          if (!next) return
          setModelStore("model", agent.current().name, { ...next })
          const uniq = uniqueBy([next, ...modelStore.recent], (x) => `${x.providerID}/${x.modelID}`)
          if (uniq.length > 10) uniq.pop()
          setModelStore(
            "recent",
            uniq.map((x) => ({ providerID: x.providerID, modelID: x.modelID })),
          )
          save()
        },
        set(
          model: { providerID: string; modelID: string },
          options?: {
            recent?: boolean
            agentName?: string
          },
        ) {
          batch(() => {
            if (!isModelValid(model)) {
              toast.show({
                message: `Model ${model.providerID}/${model.modelID} is not valid`,
                variant: "warning",
                duration: 3000,
              })
              return
            }
            if (isBlockedAgentDefaultModel(model)) {
              const key = options?.agentName ?? agent.current().name
              const fallback = fallbackModel()
              if (
                fallback &&
                (fallback.providerID !== model.providerID || fallback.modelID !== model.modelID) &&
                isModelValid(fallback)
              ) {
                setModelStore("model", key, { ...fallback })
              }
              const reason = getBlockedModelReason(model)
              toast.show({
                message: reason ? `${A2RCopy.model.blockedModelFallback} (${reason})` : A2RCopy.model.blockedModelFallback,
                variant: "warning",
                duration: 3500,
              })
              return
            }
            const key = options?.agentName ?? agent.current().name
            setModelStore("model", key, model)
            if (options?.recent) {
              const uniq = uniqueBy([model, ...modelStore.recent], (x) => `${x.providerID}/${x.modelID}`)
              if (uniq.length > 10) uniq.pop()
              setModelStore(
                "recent",
                uniq.map((x) => ({ providerID: x.providerID, modelID: x.modelID })),
              )
              save()
            }
          })
        },
        toggleFavorite(model: { providerID: string; modelID: string }) {
          batch(() => {
            if (!isModelValid(model)) {
              toast.show({
                message: `Model ${model.providerID}/${model.modelID} is not valid`,
                variant: "warning",
                duration: 3000,
              })
              return
            }
            if (isBlockedAgentDefaultModel(model)) {
              toast.show({
                message: A2RCopy.model.blockedModelHint,
                variant: "warning",
                duration: 3000,
              })
              return
            }
            const exists = modelStore.favorite.some(
              (x) => x.providerID === model.providerID && x.modelID === model.modelID,
            )
            const next = exists
              ? modelStore.favorite.filter((x) => x.providerID !== model.providerID || x.modelID !== model.modelID)
              : [model, ...modelStore.favorite]
            setModelStore(
              "favorite",
              next.map((x) => ({ providerID: x.providerID, modelID: x.modelID })),
            )
            save()
          })
        },
        variant: {
          current() {
            const m = currentModel()
            if (!m) return undefined
            const key = `${m.providerID}/${m.modelID}`
            return modelStore.variant[key]
          },
          list() {
            const m = currentModel()
            if (!m) return []
            const provider = sync.data.provider.find((x) => x.id === m.providerID)
            const info = provider?.models[m.modelID]
            if (!info?.variants) return []
            return Object.keys(info.variants)
          },
          set(value: string | undefined) {
            const m = currentModel()
            if (!m) return
            const key = `${m.providerID}/${m.modelID}`
            setModelStore("variant", key, value)
            save()
          },
          cycle() {
            const variants = this.list()
            if (variants.length === 0) return
            const current = this.current()
            if (!current) {
              this.set(variants[0])
              return
            }
            const index = variants.indexOf(current)
            if (index === -1 || index === variants.length - 1) {
              this.set(undefined)
              return
            }
            this.set(variants[index + 1])
          },
        },
      }
    })

    const mcp = {
      isEnabled(name: string) {
        const status = sync.data.mcp[name]
        return status?.status === "connected"
      },
      async toggle(name: string) {
        const status = sync.data.mcp[name]
        if (status?.status === "connected") {
          // Disable: disconnect the MCP
          await sdk.client.mcp.disconnect({ name })
        } else {
          // Enable/Retry: connect the MCP (handles disabled, failed, and other states)
          await sdk.client.mcp.connect({ name })
        }
      },
    }

    // Automatically update model when agent changes
    createEffect(() => {
      const value = agent.current()
      if (value.model) {
        if (isModelValid(value.model))
          model.set({
            providerID: value.model.providerID,
            modelID: value.model.modelID,
          })
        else
          toast.show({
            variant: "warning",
            message: `Agent ${value.name}'s configured model ${value.model.providerID}/${value.model.modelID} is not valid`,
            duration: 3000,
          })
      }
    })

    const result = {
      model,
      agent,
      mcp,
    }
    return result
  },
})
