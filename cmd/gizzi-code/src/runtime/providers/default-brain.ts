/**
 * Default brain selection.
 *
 * Unpaid / Free: first installed CLI subprocess (or the first-run pick).
 * Paid Plus / Super / Ultra: Allternit Cloud, provisioned by the billing
 * webhook — gizzi only has to point at `allternit/<model>`.
 *
 * `model_auto: false` means the user pinned `/model` and we leave it alone.
 */

import { Config } from "@/runtime/context/config/config"
import { Log } from "@/shared/util/log"
import {
  getCachedAllternitPlan,
  isPaidAllternitPlan,
  refreshAllternitPlan,
  type AllternitPlan,
} from "./discovery/allternit-cloud"
import { Discovery, type DiscoveredProvider } from "./discovery"

export { isPaidAllternitPlan }

const log = Log.create({ service: "default-brain" })

export type DefaultBrainInput = {
  modelAuto?: boolean
  currentModel?: string
  plan: AllternitPlan | null
  providers: DiscoveredProvider[]
}

function firstModel(provider: DiscoveredProvider | undefined): string | null {
  const model = provider?.models[0]
  if (!provider || !model?.id) return null
  return `${provider.id}/${model.id}`
}

export function pickDefaultBrain(input: DefaultBrainInput): string | null {
  if (input.modelAuto === false) return null

  const current = input.currentModel?.trim() || undefined
  const cloud = input.providers.find((p) => p.id === "allternit" && p.source === "platform")
  const clis = input.providers.filter((p) => p.source === "subprocess")

  if (isPaidAllternitPlan(input.plan)) {
    const next = firstModel(cloud)
    if (!next) return null
    return next === current ? null : next
  }

  // Unpaid: keep an explicit CLI pick; only fill in or leave Cloud after lapse.
  if (current) {
    const providerID = current.split("/")[0]
    if (providerID && providerID !== "allternit" && providerID !== "auto") return null
  }

  const next = firstModel(clis[0])
  if (!next) return null
  return next === current ? null : next
}

export async function applyDefaultBrain(providers?: DiscoveredProvider[]): Promise<string | null> {
  await refreshAllternitPlan()
  const discovered = providers ?? (Discovery.last().length > 0 ? Discovery.last() : await Discovery.run())
  let cfg: { model?: string; model_auto?: boolean } = {}
  try {
    cfg = await Config.getGlobal()
  } catch (err) {
    log.warn("default brain: failed to read global config", { error: err })
    return null
  }

  const next = pickDefaultBrain({
    modelAuto: cfg.model_auto,
    currentModel: cfg.model,
    plan: getCachedAllternitPlan(),
    providers: discovered,
  })
  if (!next) return cfg.model ?? null

  try {
    await Config.updateGlobal({ model: next, model_auto: true }, { reload: false })
    try {
      const live = await Config.get()
      live.model = next
      live.model_auto = true
    } catch {
      // No instance yet — file write is enough for the next session.
    }
    log.info("default brain set", { model: next, paid: isPaidAllternitPlan(getCachedAllternitPlan()) })
  } catch (err) {
    log.warn("default brain: failed to persist", { model: next, error: err })
    return null
  }
  return next
}

export async function pinBrain(model: string): Promise<void> {
  const trimmed = model.trim()
  if (!trimmed.includes("/")) return
  await Config.updateGlobal({ model: trimmed, model_auto: false })
}

export async function unpinBrain(): Promise<void> {
  await Config.updateGlobal({ model_auto: true })
}
