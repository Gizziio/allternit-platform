import type { ModelSelection } from "@/components/model-picker";
import type { ModelOption } from "@/components/prompt-kit/prompt-model-selector";
import { getProviderMeta } from "@/lib/providers/provider-registry";

export const MODEL_SELECTION_STORAGE_KEY = "allternit:model-selection";

export type AllternitPlan = {
  id: string;
  label?: string;
  plan_tier?: string;
  status?: string;
};

const PAID_PLAN_IDS = new Set(["plus", "super", "ultra"]);
const PAID_STATUSES = new Set(["active", "trialing"]);

export function isPaidAllternitPlan(plan: AllternitPlan | null | undefined): boolean {
  if (!plan) return false;
  const id = (plan.id || "").toLowerCase();
  if (!PAID_PLAN_IDS.has(id)) return false;
  const status = (plan.status || "").toLowerCase();
  if (status && !PAID_STATUSES.has(status)) return false;
  return true;
}

/** Platform catalog (`allternit/llama-3.1-8b`), not sidecar / local-engine. */
export function isAllternitCloudProviderId(providerId: string | undefined | null): boolean {
  return (providerId || "").toLowerCase() === "allternit";
}

const LOCAL_PROVIDER_IDS = new Set([
  "ollama",
  "omlx",
  "allternit-sidecar",
  "allternit-local-engine",
  "local",
  "local-brain",
  "mlx",
]);

export function isLocalProviderId(providerId: string | undefined | null): boolean {
  if (!providerId) return false;
  return LOCAL_PROVIDER_IDS.has(providerId.toLowerCase());
}

function providerIdOf(model: ModelOption): string {
  return (model.providerId || model.provider || "").toLowerCase();
}

function modelKey(model: ModelOption): string {
  return `${providerIdOf(model)}/${model.id} ${model.name || ""}`.toLowerCase();
}

function isEmbeddingModel(model: ModelOption): boolean {
  return /embed/i.test(modelKey(model));
}

const CLI_DEFAULT_ORDER = [
  "claude-cli",
  "claude",
  "codex-cli",
  "codex",
  "kimi-cli",
  "kimi",
  "qwen-cli",
  "grok",
  "antigravity",
  "agy",
];

function isCliRuntime(model: ModelOption): boolean {
  return getProviderMeta(providerIdOf(model)).kind === "cli" && !isEmbeddingModel(model);
}

export function isCliSelection(selection: ModelSelection | null): boolean {
  if (!selection) return false;
  return getProviderMeta(selection.providerId).kind === "cli";
}

/**
 * Keep a persisted Home brain only after auth status is known, and only if a
 * CLI pick is actually signed in. Empty `authedIds` used to mean "assume
 * persisted Claude is fine", which left logged-out Claude stuck as the default.
 */
export function shouldKeepPersistedSelection(
  selection: ModelSelection | null,
  authedIds: readonly string[],
  authStatusKnown: boolean,
  plan?: AllternitPlan | null,
): boolean {
  if (!selection) return false;
  if (isMistakenAutoDefault(selection)) return false;
  // Explicit /model pin. Auto defaults (including old persisted CLI picks)
  // yield to Allternit Cloud after a paid sub.
  if (selection.modelAuto === false) return true;
  if (isPaidAllternitPlan(plan)) {
    return isAllternitCloudProviderId(selection.providerId);
  }
  if (!isCliSelection(selection)) return true;
  if (!authStatusKnown) return true;
  if (authedIds.length === 0) return false;
  const provider = selection.providerId.toLowerCase();
  const authed = authedIds.map((id) => id.toLowerCase());
  if (!authed.includes(provider)) return false;
  return true;
}

function isOfficialLocalBrain(model: ModelOption): boolean {
  if (providerIdOf(model) !== "ollama") return false;
  return /llama3\.2:3b/i.test(model.id) || /llama3\.2:3b/i.test(model.name || "");
}

function isSidecarLocalBrain(model: ModelOption): boolean {
  const provider = providerIdOf(model);
  return provider === "allternit-sidecar" || provider === "local-brain";
}

function isOllamaChatModel(model: ModelOption): boolean {
  return providerIdOf(model) === "ollama" && !isEmbeddingModel(model);
}

function isOmlxChatModel(model: ModelOption): boolean {
  const provider = providerIdOf(model);
  if (provider !== "omlx" && provider !== "mlx") return false;
  return !/nail/i.test(modelKey(model));
}

const RETIRED_CODEX_MODEL_IDS = new Set(["codex-mini-latest", "codex-latest", "codex-mini"]);

export function migrateRetiredCodexSelection(selection: ModelSelection): ModelSelection {
  const provider = selection.providerId.toLowerCase();
  if (provider !== "codex-cli" && provider !== "codex") return selection;
  if (!RETIRED_CODEX_MODEL_IDS.has(selection.modelId)) return selection;
  return {
    ...selection,
    modelId: "gpt-6-astra",
    modelName: "Astra",
  };
}

/** Nail 35B was an auto-pick to unstick Home. Not a product default. */
export function isMistakenAutoDefault(selection: ModelSelection | null): boolean {
  if (!selection) return false;
  const blob = `${selection.providerId} ${selection.modelId} ${selection.modelName || ""}`.toLowerCase();
  return blob.includes("nail-35") || blob.includes("nail 35");
}

export function modelOptionToSelection(model: ModelOption): ModelSelection {
  const providerId = model.providerId || model.provider || model.id.split("/")[0] || "local";
  const modelId = model.id.includes("/")
    ? model.id.split("/").slice(1).join("/")
    : model.id;
  return {
    providerId,
    profileId: providerId,
    modelId: modelId || model.id,
    modelName: model.name || modelId || model.id,
    modelAuto: true,
  };
}

/**
 * Paid Plus / Super / Ultra (and admin Ultra): Allternit Cloud.
 * Unpaid: first installed CLI runtime. Local Ollama / sidecar stay choices.
 */
export function pickDefaultBrain(
  models: ModelOption[],
  authenticatedProviderIds?: Iterable<string>,
  plan?: AllternitPlan | null,
): ModelSelection | null {
  if (!models.length) return null;
  if (isPaidAllternitPlan(plan)) {
    const cloud = models.find(
      (model) => isAllternitCloudProviderId(providerIdOf(model)) && !isEmbeddingModel(model),
    );
    if (cloud) return { ...modelOptionToSelection(cloud), modelAuto: true };
  }
  const authed = authenticatedProviderIds
    ? new Set([...authenticatedProviderIds].map((id) => id.toLowerCase()))
    : null;
  const clis = models.filter((model) => {
    if (!isCliRuntime(model)) return false;
    if (!authed) return true;
    return authed.has(providerIdOf(model));
  });
  for (const id of CLI_DEFAULT_ORDER) {
    const hit = clis.find((model) => providerIdOf(model) === id);
    if (hit) return modelOptionToSelection(hit);
  }
  if (clis[0] && providerIdOf(clis[0]) !== "opencode") {
    return modelOptionToSelection(clis[0]);
  }
  const official = models.find(isOfficialLocalBrain);
  if (official) return modelOptionToSelection(official);
  const sidecar = models.find(isSidecarLocalBrain);
  if (sidecar) return modelOptionToSelection(sidecar);
  const ollamaChat = models.find(isOllamaChatModel);
  if (ollamaChat) return modelOptionToSelection(ollamaChat);
  const omlx = models.find(isOmlxChatModel);
  if (omlx) return modelOptionToSelection(omlx);
  const rest = models.find((model) => !/nail/i.test(modelKey(model)));
  return rest ? modelOptionToSelection(rest) : null;
}

export function readPersistedModelSelection(): ModelSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MODEL_SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ModelSelection> | null;
    if (!parsed?.providerId || !parsed?.modelId) return null;
    const selection: ModelSelection = {
      providerId: parsed.providerId,
      profileId: parsed.profileId || parsed.providerId,
      modelId: parsed.modelId,
      modelName: parsed.modelName || parsed.modelId,
      modelAuto: parsed.modelAuto,
    };
    if (isMistakenAutoDefault(selection)) {
      window.localStorage.removeItem(MODEL_SELECTION_STORAGE_KEY);
      return null;
    }
    const migrated = migrateRetiredCodexSelection(selection);
    if (migrated.modelId !== selection.modelId) persistModelSelection(migrated);
    return migrated;
  } catch {
    return null;
  }
}

export function persistModelSelection(selection: ModelSelection | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!selection || isMistakenAutoDefault(selection)) {
      window.localStorage.removeItem(MODEL_SELECTION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(MODEL_SELECTION_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // storage unavailable
  }
}
