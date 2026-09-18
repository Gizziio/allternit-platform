/**
 * Allternit engine catalog adapter for the Bot Mode model picker.
 *
 * The bot chat header picker used to build its provider list solely from
 * `GET /inference-router/cli-status`, so Gizzi / cloud / already-signed-in
 * CLIs showed as "Sign in required" and model ids were CLI-only. This adapter
 * merges the same live sources Chat's `ModelPicker` uses —
 * `useModelDiscovery` (auth status + runtime registry), `useAvailableBrainModels`
 * (Gizzi + Ollama + sidecar + cloud models), and optional CLI-status rows as
 * enrichment only — into `BotModeProvider[]`.
 *
 * Status semantics mirror `src/components/model-picker.tsx` `getEffectiveStatus`:
 * runtime registry status wins when not 'unknown'; authenticated → active;
 * api missing/expired → missing_key; cli ok → active; cli missing/expired →
 * missing_key; else offline; local → unknown (local with live models is
 * treated as available). A failed auth discovery degrades to "unknown", never
 * "ready". CLI-status is enrichment (version/PATH/login hint) and must not dim
 * a provider that live discovery already marked authenticated.
 *
 * Display rows are folded by canonical provider id (`claude` / `claude-cli`
 * share one rail icon) while every model row keeps the executable provider id
 * from its `ModelOption`. Model ids may themselves contain `/`, so exactly one
 * matching provider prefix is stripped when deriving the short model id.
 */

import type { ModelOption } from '@/components/prompt-kit/prompt-model-selector';
import type {
  ProviderAuthStatus,
  ProviderInfo,
  UsageSummary,
} from '@/integration/api-client';
import type { InferenceRouterProvider } from '@/views/chat/hooks/useInferenceRouterCliStatus';
import {
  canonicalProviderId,
  getProviderMeta,
  type ProviderKind,
} from '@/lib/providers/provider-registry';
import {
  mergeCurrentProvider,
  type BotModeProvider,
  type BotModeProviderModel,
  type BotModeProviderUsage,
  type BotProviderTransport,
} from './bot-mode-model';

export type EngineEffectiveStatus = ProviderInfo['status'] | 'unknown' | 'missing';

export interface AllternitEngineCatalogInput {
  /** `useModelDiscovery().providers` — live per-provider auth status. */
  authProviders: ProviderAuthStatus[];
  /** `useModelDiscovery().realModels` — runtime registry rows. */
  runtimeProviders: ProviderInfo[];
  /** `useAvailableBrainModels().models` — executable `provider/model` ids. */
  brainModels: ModelOption[];
  /** CLI-status rows, enrichment only (PATH install, login hint). */
  cliRows?: InferenceRouterProvider[];
  /** Real usage summary; footer omitted when metering is unavailable. */
  usageSummary?: UsageSummary | null;
  /** True when the auth-status fetch failed; absent rows degrade to unknown. */
  authError?: boolean;
  /** Saved pick that must stay visible even when missing from discovery. */
  current?: { providerId: string; modelId: string } | null;
}

/**
 * Port of `model-picker.tsx#getEffectiveStatus` — same decision order so the
 * bot rail agrees with the Chat catalog.
 */
export function engineEffectiveStatus(
  auth: Pick<ProviderAuthStatus, 'authenticated' | 'status'> | undefined,
  runtimeStatus: ProviderInfo['status'] | undefined,
  kind: ProviderKind,
): EngineEffectiveStatus {
  // The runtime registry has the most concrete view of CLI/local state.
  if (runtimeStatus && runtimeStatus !== 'unknown') return runtimeStatus;
  if (auth?.authenticated) return 'active';
  if (kind === 'api') {
    if (auth?.status === 'missing' || auth?.status === 'expired') return 'missing_key';
    return 'unconfigured';
  }
  if (kind === 'cli') {
    if (auth?.status === 'ok') return 'active';
    if (auth?.status === 'missing' || auth?.status === 'expired') return 'missing_key';
    return 'offline';
  }
  // local
  return 'unknown';
}

/**
 * Remove exactly one matching provider prefix from a full `provider/model`
 * id. The remainder may still contain `/` (model ids can be nested); only the
 * first segment is consumed when it matches the provider.
 */
export function stripOneProviderPrefix(fullId: string, providerId: string): string {
  const prefix = `${providerId}/`;
  return fullId.toLowerCase().startsWith(prefix.toLowerCase())
    ? fullId.slice(prefix.length)
    : fullId;
}

/** Executable provider id for a brain model option. */
export function executableProviderIdOf(model: ModelOption): string {
  const raw = model.providerId || model.provider || '';
  if (raw) return raw.toLowerCase();
  return model.id.includes('/') ? model.id.split('/')[0].toLowerCase() : '';
}

/** Real account line only — never invent an email or org. */
export function accountOf(auth: ProviderAuthStatus | undefined): string | undefined {
  if (!auth) return undefined;
  const profiles = (auth.chat_profile_ids ?? []).filter(Boolean);
  if (profiles.length > 0) return profiles.join(' · ');
  return auth.auth_profile_id || undefined;
}

function transportOf(kind: ProviderKind, runtime: ProviderInfo | undefined): BotProviderTransport {
  if (kind === 'local') return 'local';
  if (kind === 'cli') return 'cli';
  // API providers served by the local runtime registry are Gizzi-routed.
  if (runtime?.provider_type === 'subprocess') return 'gizzi';
  return 'cloud';
}

function availabilityOf(
  status: EngineEffectiveStatus,
  kind: ProviderKind,
  modelCount: number,
): { installed: boolean; available: boolean; reason?: string } {
  switch (status) {
    case 'active':
      return { installed: true, available: true };
    case 'ready_no_models':
      return { installed: true, available: true, reason: 'No models advertised' };
    case 'missing_key':
      // CLI on PATH but not signed in (the UI shows the auth command hint);
      // API provider without a key.
      return kind === 'api'
        ? { installed: false, available: false, reason: 'API key required' }
        : { installed: true, available: false };
    case 'offline':
      return { installed: false, available: false, reason: 'Not installed' };
    case 'unknown':
    default:
      // Local runtimes with live models are usable even though they have no
      // auth concept; everything else stays dimmed rather than guessed ready.
      if (kind === 'local' && modelCount > 0) return { installed: true, available: true };
      if (kind === 'local') return { installed: false, available: false, reason: 'No local models' };
      if (kind === 'cli') return { installed: false, available: false, reason: 'Not installed' };
      return { installed: false, available: false };
  }
}

interface EngineRowDraft {
  canonical: string;
  order: number;
  auth?: ProviderAuthStatus;
  runtime?: ProviderInfo;
  cli?: InferenceRouterProvider;
  models: BotModeProviderModel[];
}

export function buildAllternitEngineCatalog(input: AllternitEngineCatalogInput): BotModeProvider[] {
  const drafts = new Map<string, EngineRowDraft>();
  let sequence = 0;
  const draftFor = (rawId: string | undefined): EngineRowDraft | undefined => {
    if (!rawId) return undefined;
    const canonical = canonicalProviderId(rawId);
    let draft = drafts.get(canonical);
    if (!draft) {
      draft = { canonical, order: sequence++, models: [] };
      drafts.set(canonical, draft);
    }
    return draft;
  };

  // 1) Live auth rows, in discovery order (first canonical row wins).
  for (const auth of input.authProviders ?? []) {
    if (!auth?.provider_id || auth.provider_id === 'echo') continue;
    const draft = draftFor(auth.provider_id);
    if (draft) draft.auth ??= auth;
  }

  // 2) Brain models, grouped by executable provider id. Model rows keep the
  //    executable providerId from their ModelOption.
  for (const model of input.brainModels ?? []) {
    if (!model?.id) continue;
    const execId = executableProviderIdOf(model);
    if (!execId) continue;
    const draft = draftFor(execId);
    if (!draft) continue;
    const modelId = stripOneProviderPrefix(model.id, execId);
    if (draft.models.some((existing) => existing.id === modelId && existing.providerId === execId)) {
      continue;
    }
    draft.models.push({ id: modelId, name: model.name || modelId, providerId: execId });
  }

  // 3) Runtime registry rows attach status/transport. They never create a
  //    rail row on their own (pruned below) — presence comes from auth or
  //    models, like the Chat catalog.
  for (const runtime of input.runtimeProviders ?? []) {
    if (!runtime?.id || runtime.id === 'echo') continue;
    const draft = draftFor(runtime.id);
    if (draft) draft.runtime ??= runtime;
  }

  // 4) CLI-status rows: enrichment only. They must not create rows and must
  //    not dim a discovery-authenticated provider.
  for (const cli of input.cliRows ?? []) {
    if (!cli?.id) continue;
    const draft = draftFor(cli.id);
    if (draft) draft.cli ??= cli;
  }

  const usageByProvider = providerUsage(input.usageSummary);

  const rows: BotModeProvider[] = [];
  const ordered = [...drafts.values()].sort((a, b) => a.order - b.order);
  for (const draft of ordered) {
    // Prune registry ghosts: no auth row and no models means nothing to show
    // or pick. (Registry-wide "available providers" live in ProviderGallery.)
    if (!draft.auth && draft.models.length === 0) continue;

    const id =
      draft.models[0]?.providerId ??
      (draft.auth ? canonicalProviderId(draft.auth.provider_id) : draft.canonical);
    const meta = getProviderMeta(id);
    const runtimeStatus =
      draft.runtime?.status && draft.runtime.status !== 'unknown'
        ? draft.runtime.status
        : undefined;
    // A failed auth discovery degrades to unknown — never claim a stale row
    // is ready from cached data alone.
    const status =
      !draft.auth && input.authError
        ? 'unknown'
        : engineEffectiveStatus(draft.auth, runtimeStatus, meta.kind);
    const availability = availabilityOf(status, meta.kind, draft.models.length);
    const cli = draft.cli;
    // CLI-status login hints enrich an unavailable row, but a live
    // discovery-authenticated provider keeps its availability regardless of
    // what the binary probe says.
    const reason = availability.reason ?? (cli && !availability.available ? cli.reason : undefined);
    const usage = usageByProvider.get(draft.canonical);
    const account = accountOf(draft.auth);

    rows.push({
      id,
      name: meta.name,
      installed: availability.installed,
      available: availability.available,
      ...(reason ? { reason } : {}),
      ...(account ? { account } : {}),
      transport: transportOf(meta.kind, draft.runtime),
      ...(usage ? { usage } : {}),
      models: markDefaultModel(draft.models, cli),
    });
  }

  return mergeCurrentProvider(
    rows,
    input.current?.providerId,
    input.current?.modelId,
  );
}

/** Mark the CLI-advertised default model, if the enrichment names one. */
function markDefaultModel(
  models: BotModeProviderModel[],
  cli: InferenceRouterProvider | undefined,
): BotModeProviderModel[] {
  const cliDefault = cli?.models?.find((model) => model.default)?.id;
  if (!cliDefault) return models;
  const matched = models.some((model) => model.id === cliDefault);
  if (!matched) return models;
  return models.map((model) =>
    model.id === cliDefault ? { ...model, default: true } : model,
  );
}

/** Per-provider usage slice when the summary exposes one. */
function providerUsage(
  summary: UsageSummary | null | undefined,
): Map<string, BotModeProviderUsage> {
  const map = new Map<string, BotModeProviderUsage>();
  const byProvider = (summary as { byProvider?: Record<string, { requests?: number; cost?: number }> } | null | undefined)?.byProvider;
  if (!byProvider) return map;
  for (const [providerId, usage] of Object.entries(byProvider)) {
    if (!usage || typeof usage !== 'object') continue;
    const requests = typeof usage.requests === 'number' && Number.isFinite(usage.requests) ? usage.requests : 0;
    const cost = typeof usage.cost === 'number' && Number.isFinite(usage.cost) ? usage.cost : 0;
    if (requests > 0 || cost > 0) map.set(canonicalProviderId(providerId), { requests, cost });
  }
  return map;
}

function formatTokenCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

function formatUsageCost(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.00';
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

/**
 * Usage footer line, mirroring `model-picker.tsx`. Returns null when metering
 * is unavailable so the UI renders no fake $0 line.
 */
export function formatEngineUsageLine(summary: UsageSummary | null | undefined): string | null {
  if (!summary || summary.meteringAvailable === false) return null;
  const currency = summary.currency || 'USD';
  const planName =
    summary.planLabel ||
    (summary.plan ? summary.plan.charAt(0).toUpperCase() + summary.plan.slice(1) : null);
  if (planName && summary.creditsRemaining != null) {
    const remaining = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
      summary.creditsRemaining,
    );
    const limit = summary.monthlyLimit
      ? ` of ${new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(summary.monthlyLimit)}`
      : '';
    return `Allternit ${planName} · ${remaining} remaining${limit}`;
  }
  return [
    `${summary.requests.toLocaleString()} requests`,
    `${formatTokenCount(summary.tokens.total)} tokens`,
    formatUsageCost(summary.cost),
  ].join(' · ');
}
