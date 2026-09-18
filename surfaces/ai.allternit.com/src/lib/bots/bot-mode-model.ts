/**
 * Bot Mode model picker — OpenMaus interaction mapped onto Allternit brains.
 *
 * Thread pin lives on the session (`threadModelPin`). Bot default writes
 * `bot.brain.modelRef` (+ optional `effort`) and `config.runtimeModelId`.
 * Do not reuse `session.metadata.runtimeModelId`: older builds stamped that
 * with a catalog default that the runtime cannot serve.
 */

import type { Agent, BotBrainBinding, BotBrainEffort, BotBrainModelRef } from '@/lib/agents/agent.types';
import { canonicalProviderId, getProviderMeta, type ProviderKind } from '@/lib/providers/provider-registry';
import { NATIVE_HARNESS_IDS, normalizeBotBrain, resolveAgentBrain, type NativeHarnessId } from './bot-brain';

export type BotModelScope = 'thread' | 'bot';

export const BOT_EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const satisfies readonly BotBrainEffort[];

export const THREAD_MODEL_PIN_KEY = 'threadModelPin';

export interface BotModeProviderModel {
  id: string;
  name: string;
  default?: boolean;
  /**
   * Executable provider id for this model row. Differs from the provider row
   * id only when the row folded aliases (e.g. `claude` onto `claude-cli`);
   * picks must use this id so the runtime receives the provider that actually
   * serves the model.
   */
  providerId?: string;
}

/** How Allternit reaches the provider's models. */
export type BotProviderTransport = 'cli' | 'gizzi' | 'cloud' | 'local';

export interface BotModeProviderUsage {
  requests: number;
  cost: number;
}

export interface BotModeProvider {
  id: string;
  name: string;
  installed: boolean;
  available: boolean;
  reason?: string;
  version?: string;
  account?: string;
  transport?: BotProviderTransport;
  usage?: BotModeProviderUsage;
  models: BotModeProviderModel[];
}

export interface BotThreadModelPin {
  providerId: string;
  modelId: string;
  effort?: BotBrainEffort;
}

export interface BotModelPick {
  providerId: string;
  modelId: string;
  effort?: BotBrainEffort;
  scope: BotModelScope;
}

const NATIVE_HARNESS_BY_PROVIDER: Record<string, NativeHarnessId> = {
  'claude-cli': 'claude',
  claude: 'claude',
  'claude-code': 'claude',
  'codex-cli': 'codex',
  codex: 'codex',
  'kimi-cli': 'kimi',
  kimi: 'kimi',
};

export function effortLabel(level: BotBrainEffort | undefined): string {
  if (!level) return 'Default';
  return level === 'xhigh' ? 'X-High' : level[0].toUpperCase() + level.slice(1);
}

export function runtimeModelIdOf(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}

export function parseRuntimeModelId(runtimeModelId: string): { providerId: string; modelId: string } {
  const separator = runtimeModelId.indexOf('/');
  if (separator <= 0) {
    return { providerId: 'allternit', modelId: runtimeModelId };
  }
  return {
    providerId: runtimeModelId.slice(0, separator),
    modelId: runtimeModelId.slice(separator + 1),
  };
}

export function parseThreadModelPin(raw: unknown): BotThreadModelPin | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.providerId !== 'string' || !rec.providerId) return undefined;
  if (typeof rec.modelId !== 'string' || !rec.modelId) return undefined;
  const effort =
    typeof rec.effort === 'string' && (BOT_EFFORT_LEVELS as readonly string[]).includes(rec.effort)
      ? (rec.effort as BotBrainEffort)
      : undefined;
  return { providerId: rec.providerId, modelId: rec.modelId, ...(effort ? { effort } : {}) };
}

export function splitProviderRail(providers: BotModeProvider[]): {
  cloud: BotModeProvider[];
  local: BotModeProvider[];
} {
  const cloud: BotModeProvider[] = [];
  const local: BotModeProvider[] = [];
  for (const provider of providers) {
    if (railKind(provider.id) === 'local') local.push(provider);
    else cloud.push(provider);
  }
  return { cloud, local };
}

export function railKind(providerId: string): ProviderKind {
  return getProviderMeta(providerId).kind;
}

export function providerSupportsEffort(providerId: string): boolean {
  return railKind(providerId) !== 'local';
}

export function engineStatus(provider: BotModeProvider): string {
  if (!provider.installed) return 'Setup required';
  if (!provider.available) return 'Sign in required';
  if (provider.version) return provider.version;
  return 'Ready';
}

export function engineStatusTone(provider: BotModeProvider): 'ready' | 'blocked' {
  return provider.installed && provider.available ? 'ready' : 'blocked';
}

export function nativeHarnessForProvider(providerId: string): NativeHarnessId | undefined {
  const direct = NATIVE_HARNESS_BY_PROVIDER[providerId];
  if (direct) return direct;
  const canonical = getProviderMeta(providerId).id;
  return NATIVE_HARNESS_BY_PROVIDER[canonical];
}

export function providerIdToAgentProvider(providerId: string): Agent['provider'] {
  switch (providerId) {
    case 'claude-cli':
    case 'claude-code':
    case 'claude':
    case 'anthropic':
      return 'anthropic';
    case 'codex-cli':
    case 'codex':
    case 'openai':
      return 'openai';
    case 'google':
    case 'gemini':
      return 'google';
    case 'ollama':
    case 'omlx':
    case 'allternit':
    case 'allternit-local-engine':
    case 'allternit-sidecar':
    case 'gizzi':
      return 'local';
    default:
      return 'custom';
  }
}

export function brainFromModelPick(
  current: BotBrainBinding | undefined,
  providerId: string,
  modelId: string,
  effort?: BotBrainEffort,
): BotBrainBinding {
  const modelRef: BotBrainModelRef = { providerID: providerId, modelID: modelId };
  const harness = nativeHarnessForProvider(providerId);
  if (harness && (NATIVE_HARNESS_IDS as readonly string[]).includes(harness)) {
    const keepSession = current?.mode === 'native_harness' && current.harness === harness;
    return normalizeBotBrain(
      {
        mode: 'native_harness',
        harness,
        ...(keepSession && current.nativeSessionId ? { nativeSessionId: current.nativeSessionId } : {}),
        effort,
      },
      modelRef,
    );
  }
  return normalizeBotBrain({ mode: 'allternit_cloud', effort }, modelRef);
}

export function suggestedModels(
  models: BotModeProviderModel[],
  currentId: string | undefined,
  limit = 5,
): BotModeProviderModel[] {
  if (models.length <= limit) return models;
  const picked: BotModeProviderModel[] = [];
  const seen = new Set<string>();
  const take = (model: BotModeProviderModel | undefined) => {
    if (!model || seen.has(model.id)) return;
    seen.add(model.id);
    picked.push(model);
  };
  take(models.find((model) => model.id === currentId));
  take(models.find((model) => model.default));
  for (const model of models) {
    if (picked.length >= limit) break;
    take(model);
  }
  return picked;
}

export function mergeCurrentProvider(
  providers: BotModeProvider[],
  currentProviderId: string | undefined,
  currentModelId: string | undefined,
): BotModeProvider[] {
  if (!currentProviderId) return providers;
  const currentCanonical = canonicalProviderId(currentProviderId);
  if (
    providers.some(
      (provider) =>
        provider.id === currentProviderId || canonicalProviderId(provider.id) === currentCanonical,
    )
  ) {
    return providers;
  }
  const meta = getProviderMeta(currentProviderId);
  // The saved pick no longer appears in live discovery. Keep it visible as the
  // current choice but mark it clearly unavailable — never fabricate
  // installed/available the way this helper used to.
  return [
    ...providers,
    {
      id: currentProviderId,
      name: meta.name,
      installed: false,
      available: false,
      reason: 'This model is not available from any connected provider right now.',
      transport: meta.kind === 'local' ? 'local' : meta.kind === 'cli' ? 'cli' : 'cloud',
      models: currentModelId
        ? [{ id: currentModelId, name: currentModelId, default: true, providerId: currentProviderId }]
        : [],
    },
  ];
}

export function resolveBotRuntimeModel(input: {
  threadPin?: BotThreadModelPin;
  bot?: Pick<Agent, 'brain' | 'config' | 'provider' | 'model'> | null;
}): { providerId: string; modelId: string; effort?: BotBrainEffort } | undefined {
  if (input.threadPin) {
    return {
      providerId: input.threadPin.providerId,
      modelId: input.threadPin.modelId,
      ...(input.threadPin.effort ? { effort: input.threadPin.effort } : {}),
    };
  }
  const bot = input.bot;
  if (!bot) return undefined;
  const brain = resolveAgentBrain(bot);
  if (brain.modelRef?.providerID && brain.modelRef.modelID) {
    return {
      providerId: brain.modelRef.providerID,
      modelId: brain.modelRef.modelID,
      ...(brain.effort ? { effort: brain.effort } : {}),
    };
  }
  const runtime = bot.config && typeof bot.config.runtimeModelId === 'string' ? bot.config.runtimeModelId : undefined;
  if (runtime) {
    const parsed = parseRuntimeModelId(runtime);
    const effort =
      bot.config && typeof bot.config.reasoningEffort === 'string'
        && (BOT_EFFORT_LEVELS as readonly string[]).includes(bot.config.reasoningEffort)
        ? (bot.config.reasoningEffort as BotBrainEffort)
        : brain.effort;
    return { ...parsed, ...(effort ? { effort } : {}) };
  }
  return undefined;
}

export function agentUpdatesFromPick(
  bot: Pick<Agent, 'brain' | 'config' | 'provider' | 'model'>,
  pick: BotModelPick,
): {
  model: string;
  provider: Agent['provider'];
  config: Record<string, unknown>;
  brain: BotBrainBinding;
} {
  const brain = brainFromModelPick(resolveAgentBrain(bot), pick.providerId, pick.modelId, pick.effort);
  const config: Record<string, unknown> = {
    ...(bot.config ?? {}),
    runtimeModelId: runtimeModelIdOf(pick.providerId, pick.modelId),
    botBrain: brain,
  };
  if (pick.effort) config.reasoningEffort = pick.effort;
  else delete config.reasoningEffort;
  return {
    model: pick.modelId,
    provider: providerIdToAgentProvider(pick.providerId),
    config,
    brain,
  };
}
