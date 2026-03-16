import z from "zod/v4"
import fuzzysort from "fuzzysort"
import { Config } from "@/runtime/context/config/config"
import { mapValues, mergeDeep, omit, pickBy, sortBy } from "remeda"
import { Log } from "@/shared/util/log"
import { BunProc } from "@/shared/bun"
import { Plugin } from "@/runtime/integrations/plugin"
import { ModelsDev } from "@/runtime/providers/adapters/models"
import { NamedError } from "@a2r/util/error"
import { Auth } from "@/runtime/integrations/auth"
import { Env } from "@/runtime/context/env"
import { Instance } from "@/runtime/context/project/instance"
import { Flag } from "@/runtime/context/flag/flag"
import { iife } from "@/shared/util/iife"
import { Global } from "@/runtime/context/global"
import path from "path"
import { Filesystem } from "@/shared/util/filesystem"
import { Sidecar } from "@/runtime/sidecar"
import { ProviderTransform } from "@/runtime/providers/adapters/transform"

// Confined AI SDK imports — all provider SDK access goes through adapters/bundled.ts
import { BUNDLED_PROVIDERS, NoSuchModelError, type SDK, type LanguageModelV2 } from "@/runtime/providers/adapters/bundled"

// Provider-specific loaders — each provider's config/auth/model logic in its own file
import { CUSTOM_LOADERS } from "@/runtime/providers/adapters/loaders"
import type { CustomModelLoader } from "@/runtime/providers/types"
import { Discovery } from "@/runtime/providers/discovery"

export namespace Provider {
  const log = Log.create({ service: "provider" })

  function loadBaseURL(model: Model, options: Record<string, any>) {
    const raw = options["baseURL"] ?? model.api.url
    if (typeof raw !== "string") return raw
    return raw.replace(/\$\{([^}]+)\}/g, (match, key) => {
      const val = Env.get(String(key))
      return val ?? match
    })
  }

  // CUSTOM_LOADERS and BUNDLED_PROVIDERS are imported from adapters/

  export const Model = z
    .object({
      id: z.string(),
      providerID: z.string(),
      api: z.object({
        id: z.string(),
        url: z.string(),
        npm: z.string(),
      }),
      name: z.string(),
      family: z.string().optional(),
      capabilities: z.object({
        temperature: z.boolean(),
        reasoning: z.boolean(),
        attachment: z.boolean(),
        toolcall: z.boolean(),
        input: z.object({
          text: z.boolean(),
          audio: z.boolean(),
          image: z.boolean(),
          video: z.boolean(),
          pdf: z.boolean(),
        }),
        output: z.object({
          text: z.boolean(),
          audio: z.boolean(),
          image: z.boolean(),
          video: z.boolean(),
          pdf: z.boolean(),
        }),
        interleaved: z.union([
          z.boolean(),
          z.object({
            field: z.enum(["reasoning_content", "reasoning_details"]),
          }),
        ]),
      }),
      cost: z.object({
        input: z.number(),
        output: z.number(),
        cache: z.object({
          read: z.number(),
          write: z.number(),
        }),
        experimentalOver200K: z
          .object({
            input: z.number(),
            output: z.number(),
            cache: z.object({
              read: z.number(),
              write: z.number(),
            }),
          })
          .optional(),
      }),
      limit: z.object({
        context: z.number(),
        input: z.number().optional(),
        output: z.number(),
      }),
      status: z.enum(["alpha", "beta", "deprecated", "active"]),
      options: z.record(z.string(), z.any()),
      headers: z.record(z.string(), z.string()),
      release_date: z.string(),
      variants: z.record(z.string(), z.record(z.string(), z.any())).optional(),
    })
    
  export type Model = z.infer<typeof Model>

  export const Info = z
    .object({
      id: z.string(),
      name: z.string(),
      source: z.enum(["env", "config", "custom", "api"]),
      env: z.string().array(),
      key: z.string().optional(),
      // Auth type controls how llm_config is forwarded to the operator:
      //   "api_key"    — standard secret key (default)
      //   "none"       — local model, no auth (Ollama, LM Studio, vLLM)
      //   "bearer"     — OAuth / subscription token in Authorization: Bearer
      //   "subprocess" — CLI tool already authed in OS (claude, llm, aichat)
      auth_type: z.enum(["api_key", "none", "bearer", "subprocess"]).optional(),
      token: z.string().optional(),          // bearer auth token
      subprocess_cmd: z.string().optional(), // e.g. "claude -p" or "/usr/local/bin/llm -m gpt-4o"
      options: z.record(z.string(), z.any()),
      models: z.record(z.string(), Model),
    })

  export type Info = z.infer<typeof Info>

  function fromModelsDevModel(provider: ModelsDev.Provider, model: ModelsDev.Model): Model {
    const m: Model = {
      id: model.id,
      providerID: provider.id,
      name: model.name,
      family: model.family,
      api: {
        id: model.id,
        url: model.provider?.api ?? provider.api!,
        npm: model.provider?.npm ?? provider.npm ?? "@ai-sdk/openai-compatible",
      },
      status: model.status ?? "active",
      headers: model.headers ?? {},
      options: model.options ?? {},
      cost: {
        input: model.cost?.input ?? 0,
        output: model.cost?.output ?? 0,
        cache: {
          read: model.cost?.cache_read ?? 0,
          write: model.cost?.cache_write ?? 0,
        },
        experimentalOver200K: model.cost?.context_over_200k
          ? {
              cache: {
                read: model.cost.context_over_200k.cache_read ?? 0,
                write: model.cost.context_over_200k.cache_write ?? 0,
              },
              input: model.cost.context_over_200k.input,
              output: model.cost.context_over_200k.output,
            }
          : undefined,
      },
      limit: {
        context: model.limit.context,
        input: model.limit.input,
        output: model.limit.output,
      },
      capabilities: {
        temperature: model.temperature,
        reasoning: model.reasoning,
        attachment: model.attachment,
        toolcall: model.tool_call,
        input: {
          text: model.modalities?.input?.includes("text") ?? false,
          audio: model.modalities?.input?.includes("audio") ?? false,
          image: model.modalities?.input?.includes("image") ?? false,
          video: model.modalities?.input?.includes("video") ?? false,
          pdf: model.modalities?.input?.includes("pdf") ?? false,
        },
        output: {
          text: model.modalities?.output?.includes("text") ?? false,
          audio: model.modalities?.output?.includes("audio") ?? false,
          image: model.modalities?.output?.includes("image") ?? false,
          video: model.modalities?.output?.includes("video") ?? false,
          pdf: model.modalities?.output?.includes("pdf") ?? false,
        },
        interleaved: model.interleaved ?? false,
      },
      release_date: model.release_date,
      variants: {},
    }

    m.variants = mapValues(ProviderTransform.variants(m), (v) => v)

    return m
  }

  export function fromModelsDevProvider(provider: ModelsDev.Provider): Info {
    return {
      id: provider.id,
      source: "custom",
      name: provider.name,
      env: provider.env ?? [],
      options: {},
      models: mapValues(provider.models, (model) => fromModelsDevModel(provider, model)),
    }
  }

  const state = Instance.state(async () => {
    using _ = log.time("state")
    const config = await Config.get()
    const modelsDev = await ModelsDev.get()
    const database = mapValues(modelsDev, fromModelsDevProvider)

    const disabled = new Set(config.disabled_providers ?? [])
    const enabled = config.enabled_providers ? new Set(config.enabled_providers) : null

    function isProviderAllowed(providerID: string): boolean {
      if (enabled && !enabled.has(providerID)) return false
      if (disabled.has(providerID)) return false
      return true
    }

    const providers: { [providerID: string]: Info } = {}
    const languages = new Map<string, LanguageModelV2>()
    const modelLoaders: {
      [providerID: string]: CustomModelLoader
    } = {}
    const sdk = new Map<number, SDK>()

    log.info("init")

    const configProviders = Object.entries(config.provider ?? {})

    function mergeProvider(providerID: string, provider: Partial<Info>) {
      const existing = providers[providerID]
      if (existing) {
        providers[providerID] = mergeDeep(existing, provider) as Info
        return
      }
      const match = database[providerID]
      if (!match) return
      providers[providerID] = mergeDeep(match, provider) as Info
    }

    // extend database from config
    for (const [providerID, provider] of configProviders) {
      const existing = database[providerID]
      const parsed: Info = {
        id: providerID,
        name: provider.name ?? existing?.name ?? providerID,
        env: provider.env ?? existing?.env ?? [],
        options: mergeDeep(existing?.options ?? {}, provider.options ?? {}),
        source: "config",
        models: existing?.models ?? {},
      }

      for (const [modelID, model] of Object.entries(provider.models ?? {})) {
        const existingModel = parsed.models[model.id ?? modelID]
        const name = iife(() => {
          if (model.name) return model.name
          if (model.id && model.id !== modelID) return modelID
          return existingModel?.name ?? modelID
        })
        const parsedModel: Model = {
          id: modelID,
          api: {
            id: model.id ?? existingModel?.api.id ?? modelID,
            npm:
              model.provider?.npm ??
              provider.npm ??
              existingModel?.api.npm ??
              modelsDev[providerID]?.npm ??
              "@ai-sdk/openai-compatible",
            url: model.provider?.api ?? provider?.api ?? provider?.options?.["baseURL"] ?? existingModel?.api.url ?? modelsDev[providerID]?.api,
          },
          status: model.status ?? existingModel?.status ?? "active",
          name,
          providerID,
          capabilities: {
            temperature: model.temperature ?? existingModel?.capabilities.temperature ?? false,
            reasoning: model.reasoning ?? existingModel?.capabilities.reasoning ?? false,
            attachment: model.attachment ?? existingModel?.capabilities.attachment ?? false,
            toolcall: model.tool_call ?? existingModel?.capabilities.toolcall ?? true,
            input: {
              text: model.modalities?.input?.includes("text") ?? existingModel?.capabilities.input.text ?? true,
              audio: model.modalities?.input?.includes("audio") ?? existingModel?.capabilities.input.audio ?? false,
              image: model.modalities?.input?.includes("image") ?? existingModel?.capabilities.input.image ?? false,
              video: model.modalities?.input?.includes("video") ?? existingModel?.capabilities.input.video ?? false,
              pdf: model.modalities?.input?.includes("pdf") ?? existingModel?.capabilities.input.pdf ?? false,
            },
            output: {
              text: model.modalities?.output?.includes("text") ?? existingModel?.capabilities.output.text ?? true,
              audio: model.modalities?.output?.includes("audio") ?? existingModel?.capabilities.output.audio ?? false,
              image: model.modalities?.output?.includes("image") ?? existingModel?.capabilities.output.image ?? false,
              video: model.modalities?.output?.includes("video") ?? existingModel?.capabilities.output.video ?? false,
              pdf: model.modalities?.output?.includes("pdf") ?? existingModel?.capabilities.output.pdf ?? false,
            },
            interleaved: model.interleaved ?? false,
          },
          cost: {
            input: model?.cost?.input ?? existingModel?.cost?.input ?? 0,
            output: model?.cost?.output ?? existingModel?.cost?.output ?? 0,
            cache: {
              read: model?.cost?.cache_read ?? existingModel?.cost?.cache.read ?? 0,
              write: model?.cost?.cache_write ?? existingModel?.cost?.cache.write ?? 0,
            },
          },
          options: mergeDeep(existingModel?.options ?? {}, model.options ?? {}),
          limit: {
            context: model.limit?.context ?? existingModel?.limit?.context ?? 0,
            output: model.limit?.output ?? existingModel?.limit?.output ?? 0,
          },
          headers: mergeDeep(existingModel?.headers ?? {}, model.headers ?? {}),
          family: model.family ?? existingModel?.family ?? "",
          release_date: model.release_date ?? existingModel?.release_date ?? "",
          variants: {},
        }
        const merged = mergeDeep(ProviderTransform.variants(parsedModel), model.variants ?? {})
        parsedModel.variants = mapValues(
          pickBy(merged, (v) => !v.disabled),
          (v) => omit(v, ["disabled"]),
        )
        parsed.models[modelID] = parsedModel
      }
      database[providerID] = parsed
    }

    // load env
    const env = Env.all()
    for (const [providerID, provider] of Object.entries(database)) {
      if (disabled.has(providerID)) continue
      const apiKey = provider.env.map((item) => env[item]).find(Boolean)
      if (!apiKey) continue
      mergeProvider(providerID, {
        source: "env",
        key: provider.env.length === 1 ? apiKey : undefined,
      })
    }

    // load apikeys
    for (const [providerID, provider] of Object.entries(await Auth.all())) {
      if (disabled.has(providerID)) continue
      if (provider.type === "api") {
        mergeProvider(providerID, {
          source: "api",
          key: provider.key,
        })
      }
    }

    for (const plugin of await Plugin.list()) {
      if (!plugin.auth) continue
      const providerID = plugin.auth.provider
      if (disabled.has(providerID)) continue

      const auth = await Auth.get(providerID)
      if (!auth) continue
      if (!plugin.auth.loader) continue

      const options = await plugin.auth.loader(() => Auth.get(providerID) as any, database[plugin.auth.provider])
      const opts = options ?? {}
      const patch: Partial<Info> = providers[providerID] ? { options: opts } : { source: "custom", options: opts }
      mergeProvider(providerID, patch)
    }

    for (const [providerID, fn] of Object.entries(CUSTOM_LOADERS)) {
      if (disabled.has(providerID)) continue
      const data = database[providerID]
      if (!data) {
        log.error("Provider does not exist in model list " + providerID)
        continue
      }
      const result = await fn(data)
      if (result && (result.autoload || providers[providerID])) {
        if (result.getModel) modelLoaders[providerID] = result.getModel
        const opts = result.options ?? {}
        const patch: Partial<Info> = providers[providerID] ? { options: opts } : { source: "custom", options: opts }
        mergeProvider(providerID, patch)
      }
    }

    // load config
    for (const [providerID, provider] of configProviders) {
      const partial: Partial<Info> = { source: "config" }
      if (provider.env) partial.env = provider.env
      if (provider.name) partial.name = provider.name
      if (provider.options) partial.options = provider.options
      if (provider.auth_type) partial.auth_type = provider.auth_type
      if (provider.token) partial.token = provider.token
      if (provider.subprocess_cmd) partial.subprocess_cmd = provider.subprocess_cmd
      mergeProvider(providerID, partial)
    }

    // Inject sidecar embedded model as a provider (if sidecar is available)
    if (!providers["sidecar"]) {
      const sidecarConfig = Sidecar.providerConfig()
      if (sidecarConfig) {
        const sidecarModels: Record<string, Model> = {}
        for (const [modelID, model] of Object.entries(sidecarConfig.models)) {
          const m = model as any
          sidecarModels[modelID] = {
            id: modelID,
            api: { id: m.id ?? modelID, npm: sidecarConfig.npm, url: Sidecar.BaseURL },
            name: m.name ?? modelID,
            providerID: "sidecar",
            family: "qwen",
            status: "active",
            capabilities: {
              temperature: false,
              reasoning: false,
              attachment: false,
              toolcall: m.tool_call ?? true,
              input: { text: true, audio: false, image: false, video: false, pdf: false },
              output: { text: true, audio: false, image: false, video: false, pdf: false },
              interleaved: false,
            },
            cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
            limit: { context: m.limit?.context ?? 32768, output: m.limit?.output ?? 4096 },
            options: {},
            headers: {},
            release_date: "2025-01-01",
          }
        }
        providers["sidecar"] = {
          id: "sidecar",
          name: "Embedded Sidecar",
          env: [],
          options: sidecarConfig.options as any,
          source: "config",
          models: sidecarModels,
        }
        log.info("registered sidecar provider", { models: Object.keys(sidecarModels) })
      }
    }

    // ── Auto-discovery: subprocess CLIs + local HTTP servers ──────────────
    // Runs in parallel with provider loading. Discovered providers are injected
    // here with lower priority — user config and env always win.
    const discovered = await Discovery.run()
    for (const dp of discovered) {
      if (providers[dp.id]) continue             // user-configured takes priority
      if (!isProviderAllowed(dp.id)) continue
      const dpModels: Record<string, Model> = {}
      for (const m of dp.models) {
        dpModels[m.id] = {
          id: m.id,
          providerID: dp.id,
          name: m.name,
          family: "",
          api: {
            id: m.id,
            url: dp.base_url ?? "",
            npm: "@ai-sdk/openai-compatible",
          },
          status: "active",
          headers: {},
          options: {},
          release_date: "",
          capabilities: {
            temperature: true,
            reasoning: false,
            attachment: false,
            toolcall: true,
            input:  { text: true, audio: false, image: false, video: false, pdf: false },
            output: { text: true, audio: false, image: false, video: false, pdf: false },
            interleaved: false,
          },
          cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
          limit: { context: m.context ?? 32768, output: m.output ?? 4096 },
          variants: {},
        }
      }
      if (Object.keys(dpModels).length === 0) continue
      providers[dp.id] = {
        id: dp.id,
        name: dp.name,
        source: "custom",
        env: [],
        auth_type: dp.auth_type,
        subprocess_cmd: dp.subprocess_cmd,
        options: {},
        models: dpModels,
      }
      log.info("discovered", { providerID: dp.id, source: dp.source, models: Object.keys(dpModels).length })
    }

    for (const [providerID, provider] of Object.entries(providers)) {
      if (!isProviderAllowed(providerID)) {
        delete providers[providerID]
        continue
      }

      const configProvider = config.provider?.[providerID]

      for (const [modelID, model] of Object.entries(provider.models)) {
        model.api.id = model.api.id ?? model.id ?? modelID
        if (modelID === "gpt-5-chat-latest") delete provider.models[modelID]
        if (model.status === "alpha" && !Flag.GIZZI_ENABLE_EXPERIMENTAL_MODELS) delete provider.models[modelID]
        if (model.status === "deprecated") delete provider.models[modelID]
        if (
          (configProvider?.blacklist && configProvider.blacklist.includes(modelID)) ||
          (configProvider?.whitelist && !configProvider.whitelist.includes(modelID))
        )
          delete provider.models[modelID]

        model.variants = mapValues(ProviderTransform.variants(model), (v) => v)

        // Filter out disabled variants from config
        const configVariants = configProvider?.models?.[modelID]?.variants
        if (configVariants && model.variants) {
          const merged = mergeDeep(model.variants, configVariants)
          model.variants = mapValues(
            pickBy(merged, (v) => !v.disabled),
            (v) => omit(v, ["disabled"]),
          )
        }
      }

      if (Object.keys(provider.models).length === 0) {
        delete providers[providerID]
        continue
      }

      log.info("found", { providerID })
    }

    return {
      models: languages,
      providers,
      sdk,
      modelLoaders,
    }
  })

  export async function list() {
    return state().then((state) => state.providers)
  }

  async function getSDK(model: Model) {
    try {
      using _ = log.time("getSDK", {
        providerID: model.providerID,
      })
      const s = await state()
      const provider = s.providers[model.providerID]
      const options = { ...provider.options }

      if (model.api.npm.includes("@ai-sdk/openai-compatible") && options["includeUsage"] !== false) {
        options["includeUsage"] = true
      }

      const baseURL = loadBaseURL(model, options)
      if (baseURL !== undefined) options["baseURL"] = baseURL
      if (options["apiKey"] === undefined && provider.key) options["apiKey"] = provider.key
      if (model.headers)
        options["headers"] = {
          ...options["headers"],
          ...model.headers,
        }

      const key = Bun.hash.xxHash32(JSON.stringify({ providerID: model.providerID, npm: model.api.npm, options }))
      const existing = s.sdk.get(key)
      if (existing) return existing

      const customFetch = options["fetch"]

      options["fetch"] = async (input: any, init?: BunFetchRequestInit) => {
        // Preserve custom fetch if it exists, wrap it with timeout logic
        const fetchFn = customFetch ?? fetch
        const opts = init ?? {}

        if (options["timeout"] !== undefined && options["timeout"] !== null) {
          const signals: AbortSignal[] = []
          if (opts.signal) signals.push(opts.signal)
          if (options["timeout"] !== false) signals.push(AbortSignal.timeout(options["timeout"]))

          const combined = signals.length > 1 ? AbortSignal.any(signals) : signals[0]

          opts.signal = combined
        }

        // Strip openai itemId metadata following what codex does
        if (model.api.npm === "@ai-sdk/openai" && opts.body && opts.method === "POST") {
          const body = JSON.parse(opts.body as string)
          if (Array.isArray(body.input)) {
            for (const item of body.input) {
              if ("id" in item) {
                delete item.id
              }
            }
            opts.body = JSON.stringify(body)
          }
        }

        return fetchFn(input, {
          ...opts,
          // @ts-ignore see here: https://github.com/oven-sh/bun/issues/16682
          timeout: false,
        })
      }

      const bundledFn = BUNDLED_PROVIDERS[model.api.npm]
      if (bundledFn) {
        log.info("using bundled provider", { providerID: model.providerID, pkg: model.api.npm })
        const loaded = bundledFn({
          name: model.providerID,
          ...options,
        })
        s.sdk.set(key, loaded)
        return loaded as SDK
      }

      let installedPath: string
      if (!model.api.npm.startsWith("file://")) {
        installedPath = await BunProc.install(model.api.npm, "latest")
      } else {
        log.info("loading local provider", { pkg: model.api.npm })
        installedPath = model.api.npm
      }

      const mod = await import(installedPath)

      const fn = mod[Object.keys(mod).find((key) => key.startsWith("create"))!]
      const loaded = fn({
        name: model.providerID,
        ...options,
      })
      s.sdk.set(key, loaded)
      return loaded as SDK
    } catch (e) {
      throw new InitError({ providerID: model.providerID }, { cause: e })
    }
  }

  export async function getProvider(providerID: string) {
    return state().then((s) => s.providers[providerID])
  }

  export async function getModel(providerID: string, modelID: string) {
    const s = await state()
    const provider = s.providers[providerID]
    if (!provider) {
      const availableProviders = Object.keys(s.providers)
      const matches = fuzzysort.go(providerID, availableProviders, { limit: 3, threshold: -10000 })
      const suggestions = matches.map((m) => m.target)
      throw new ModelNotFoundError({ providerID, modelID, suggestions })
    }

    const info = provider.models[modelID]
    if (!info) {
      const availableModels = Object.keys(provider.models)
      const matches = fuzzysort.go(modelID, availableModels, { limit: 3, threshold: -10000 })
      const suggestions = matches.map((m) => m.target)
      throw new ModelNotFoundError({ providerID, modelID, suggestions })
    }
    return info
  }

  export async function getLanguage(model: Model): Promise<LanguageModelV2> {
    const s = await state()
    const key = `${model.providerID}/${model.id}`
    if (s.models.has(key)) return s.models.get(key)!

    const provider = s.providers[model.providerID]
    const sdk = await getSDK(model)

    try {
      const language = s.modelLoaders[model.providerID]
        ? await s.modelLoaders[model.providerID](sdk, model.api.id, provider.options)
        : sdk.languageModel(model.api.id)
      s.models.set(key, language)
      return language
    } catch (e) {
      if (e instanceof NoSuchModelError)
        throw new ModelNotFoundError(
          {
            modelID: model.id,
            providerID: model.providerID,
          },
          { cause: e },
        )
      throw e
    }
  }

  export async function closest(providerID: string, query: string[]) {
    const s = await state()
    const provider = s.providers[providerID]
    if (!provider) return undefined
    for (const item of query) {
      for (const modelID of Object.keys(provider.models)) {
        if (modelID.includes(item))
          return {
            providerID,
            modelID,
          }
      }
    }
  }

  export async function getSmallModel(providerID: string) {
    const cfg = await Config.get()

    if (cfg.small_model) {
      const parsed = parseModel(cfg.small_model)
      return getModel(parsed.providerID, parsed.modelID)
    }

    const provider = await state().then((state) => state.providers[providerID])
    if (provider) {
      let priority = [
        "claude-haiku-4-5",
        "claude-haiku-4.5",
        "3-5-haiku",
        "3.5-haiku",
        "gemini-3-flash",
        "gemini-2.5-flash",
        "gpt-5-nano",
      ]
      if (providerID.startsWith("gizzi") || providerID.startsWith("gizziio")) {
        priority = ["gpt-5-nano"]
      }
      for (const item of priority) {
        for (const model of Object.keys(provider.models)) {
          if (model.includes(item)) return getModel(providerID, model)
        }
      }
    }

    // Check if gizzi/gizziio provider is available before using it
    const stateData = await state()
    const gizziProvider = stateData.providers["gizzi"] || stateData.providers["gizziio"]
    if (gizziProvider && gizziProvider.models["gpt-5-nano"]) {
      // Use the actual provider ID that exists (gizziio is the primary ID from models.dev)
      const providerID = stateData.providers["gizzi"] ? "gizzi" : "gizziio"
      return getModel(providerID, "gpt-5-nano")
    }

    // Fallback to embedded sidecar model if available
    const sidecarProvider = stateData.providers["sidecar"]
    if (sidecarProvider) {
      const sidecarModel = Object.keys(sidecarProvider.models)[0]
      if (sidecarModel) {
        log.info("using sidecar embedded model as small_model fallback", { model: sidecarModel })
        return getModel("sidecar", sidecarModel)
      }
    }

    return undefined
  }

  const priority = ["gpt-5", "claude-sonnet-4", "big-pickle", "gemini-3-pro"]
  export function sort(models: Model[]) {
    return sortBy(
      models,
      [(model) => priority.findIndex((filter) => model.id.includes(filter)), "desc"],
      [(model) => (model.id.includes("latest") ? 0 : 1), "asc"],
      [(model) => model.id, "desc"],
    )
  }

  export async function defaultModel() {
    const cfg = await Config.get()
    const providers = await list()
    if (cfg.model) {
      const parsed = parseModel(cfg.model)
      const configuredProvider = providers[parsed.providerID]
      if (configuredProvider?.models?.[parsed.modelID]) return parsed
      log.warn("configured default model not found, falling back", {
        providerID: parsed.providerID,
        modelID: parsed.modelID,
      })
    }

    const recent = (await Filesystem.readJson<{ recent?: { providerID: string; modelID: string }[] }>(
      path.join(Global.Path.state, "model.json"),
    )
      .then((x) => (Array.isArray(x.recent) ? x.recent : []))
      .catch(() => [])) as { providerID: string; modelID: string }[]
    for (const entry of recent) {
      const provider = providers[entry.providerID]
      if (!provider) continue
      if (!provider.models[entry.modelID]) continue
      return { providerID: entry.providerID, modelID: entry.modelID }
    }

    const provider = Object.values(providers).find((p) => !cfg.provider || Object.keys(cfg.provider).includes(p.id))
    if (!provider) throw new Error("no providers found")
    const [model] = sort(Object.values(provider.models))
    if (!model) throw new Error("no models found")
    return {
      providerID: provider.id,
      modelID: model.id,
    }
  }

  const MODEL_ALIASES: Record<string, string> = {
    "sonnet": "anthropic/claude-sonnet-4-6",
    "opus": "anthropic/claude-opus-4-6",
    "haiku": "anthropic/claude-haiku-4-5",
    "flash": "google/gemini-2.5-flash",
    "pro": "google/gemini-2.5-pro",
    "gpt4": "openai/gpt-4.1",
    "o3": "openai/o3",
    "o4-mini": "openai/o4-mini",
  }

  export function parseModel(model: string) {
    // Check for shorthand aliases
    const aliased = MODEL_ALIASES[model.toLowerCase()]
    if (aliased) model = aliased

    const [providerID, ...rest] = model.split("/")
    return {
      providerID: providerID,
      modelID: rest.join("/"),
    }
  }

  export const ModelNotFoundError = NamedError.create(
    "ProviderModelNotFoundError",
    z.object({
      providerID: z.string(),
      modelID: z.string(),
      suggestions: z.array(z.string()).optional(),
    }),
  )

  export const InitError = NamedError.create(
    "ProviderInitError",
    z.object({
      providerID: z.string(),
    }),
  )
}

// Re-export so any module can register discovery hooks without reaching
// into the discovery internals.
export { Discovery } from "@/runtime/providers/discovery"
