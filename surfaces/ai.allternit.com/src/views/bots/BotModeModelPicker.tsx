"use client";

/**
 * Bot Mode model picker. OpenMaus interaction (rail, thread vs bot-default
 * scope, dim-with-reason) on Allternit tokens + `bot.brain`.
 * Does not replace the Chat/Cowork catalog picker.
 *
 * The provider list comes from the live Allternit catalog
 * (`buildAllternitEngineCatalog`: model discovery + brain models + CLI-status
 * enrichment), not from the CLI-status endpoint alone. Effort chips are
 * intentionally absent: the per-send path (SendMessageOptions →
 * chatApi.streamChat → /api/agent-chat → gizzi session prompt) has no typed
 * field the engine consumes, so presenting effort as functional would be a
 * fake (see allternit-engine-catalog.ts and the P0 plan).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  CaretDown,
  CaretRight,
  Check,
  CircleNotch,
  MagnifyingGlass,
  Warning,
} from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  canonicalProviderId,
  getProviderMeta,
} from "@/lib/providers/provider-registry";
import { useInferenceRouterCliStatus } from "@/views/chat/hooks/useInferenceRouterCliStatus";
import { useModelDiscovery, useUsageSummary } from "@/integration/api-client";
import { useAvailableBrainModels } from "@/hooks/use-available-brain-models";
import {
  buildAllternitEngineCatalog,
  formatEngineUsageLine,
} from "@/lib/bots/allternit-engine-catalog";
import { useAgentStore } from "@/lib/agents/agent.store";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import type { Agent, BotBrainEffort } from "@/lib/agents/agent.types";
import { createModuleLogger } from "@/lib/logger";
import {
  THREAD_MODEL_PIN_KEY,
  agentUpdatesFromPick,
  engineStatus,
  engineStatusTone,
  parseThreadModelPin,
  resolveBotRuntimeModel,
  runtimeModelIdOf,
  splitProviderRail,
  suggestedModels,
  type BotModeProvider,
  type BotModelScope,
  type BotThreadModelPin,
} from "@/lib/bots/bot-mode-model";

const logger = createModuleLogger("BotModeModelPicker");
const COMPACT_MODEL_COUNT = 5;

function providerMarkSrc(providerId: string): string | null {
  const icon = getProviderMeta(providerId).icon;
  return icon ? `/assets/runtime-logos/${icon}` : null;
}

function ProviderMark({ providerId, size }: { providerId: string; size: number }) {
  const src = providerMarkSrc(providerId);
  const meta = getProviderMeta(providerId);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
      />
    );
  }
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: meta.color }}
      aria-hidden
    />
  );
}

export interface BotModeModelPickerUIProps {
  providers: BotModeProvider[];
  selectedProviderId: string | null;
  selectedModelId: string | null;
  scope: BotModelScope;
  open: boolean;
  showScope?: boolean;
  compact?: boolean;
  busy?: boolean;
  refreshing?: boolean;
  /** Save failure to surface; cleared by the container on the next pick. */
  error?: string | null;
  /** Pre-formatted platform usage footer; omitted when metering is unavailable. */
  usageLine?: string | null;
  onOpenChange: (open: boolean) => void;
  onSelectRail: (providerId: string) => void;
  onPickModel: (providerId: string, modelId: string) => void;
  onScope: (scope: BotModelScope) => void;
  onRefresh?: () => void;
  /** Opens ProviderGallery for a blocked provider (real Connect flow). */
  onConnectProvider?: (providerId: string) => void;
  className?: string;
}

export function BotModeModelPickerUI({
  providers,
  selectedProviderId,
  selectedModelId,
  scope,
  open,
  showScope = true,
  compact = false,
  busy = false,
  refreshing = false,
  error = null,
  usageLine = null,
  onOpenChange,
  onSelectRail,
  onPickModel,
  onScope,
  onRefresh,
  onConnectProvider,
  className,
}: BotModeModelPickerUIProps) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [railId, setRailId] = useState<string | null>(null);

  const { cloud, local } = useMemo(() => splitProviderRail(providers), [providers]);
  const activeProvider =
    providers.find((provider) => provider.id === selectedProviderId) ?? providers[0];
  const railProvider =
    providers.find((provider) => provider.id === (railId ?? selectedProviderId)) ??
    activeProvider;
  const meta = getProviderMeta(railProvider?.id ?? selectedProviderId ?? "");
  const models = railProvider?.models ?? [];
  const filtered = query
    ? models.filter((model) => {
        const hay = `${model.name} ${model.id}`.toLowerCase();
        return hay.includes(query.trim().toLowerCase());
      })
    : models;
  const compactList = suggestedModels(models, selectedModelId ?? undefined, COMPACT_MODEL_COUNT);
  const shown = query ? filtered : showAll ? models : compactList;
  const blocked = Boolean(railProvider && (!railProvider.installed || !railProvider.available));
  const status = railProvider ? engineStatus(railProvider) : "";
  const tone = railProvider ? engineStatusTone(railProvider) : "blocked";
  const firstLocal = local[0];

  useEffect(() => {
    if (!open) {
      setQuery("");
      setShowAll(false);
      setRailId(null);
    }
  }, [open]);

  const triggerLabel = activeProvider
    ? `${activeProvider.name || getProviderMeta(activeProvider.id).name} · ${
        activeProvider.models.find((model) => model.id === selectedModelId)?.name ??
        selectedModelId ??
        "Model"
      }`
    : "Model";

  const triggerTitle = triggerLabel;

  const selectRail = (providerId: string) => {
    setRailId(providerId);
    setQuery("");
    setShowAll(false);
    onSelectRail(providerId);
  };

  const railButton = (provider: BotModeProvider) => {
    const selected = provider.id === railProvider?.id;
    const dimmed = !provider.available || !provider.installed;
    const label = getProviderMeta(provider.id).name;
    const button = (
      <button
        key={provider.id}
        type="button"
        onClick={() => selectRail(provider.id)}
        aria-label={dimmed ? `${label}. ${provider.reason ?? "Unavailable"}` : label}
        aria-pressed={selected}
        title={dimmed ? `${label} · ${provider.reason ?? "Unavailable"}` : `${label} · ${engineStatus(provider)}`}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-lg",
          selected
            ? "bg-[var(--surface-hover)] ring-1 ring-[var(--border-subtle)]"
            : "hover:bg-[var(--surface-hover)]",
          dimmed && "opacity-45",
        )}
      >
        <ProviderMark providerId={provider.id} size={18} />
        {dimmed && (
          <span className="absolute bottom-0.5 right-0.5 size-1.5 rounded-full bg-[var(--status-warning)] ring-2 ring-[var(--bg-elevated)]" />
        )}
      </button>
    );
    if (!dimmed) return button;
    return (
      <Tooltip key={provider.id}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px] text-xs">
          {provider.reason ?? "Unavailable"}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Popover open={open && !busy} onOpenChange={(next) => !busy && onOpenChange(next)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={busy}
            data-bot-model-picker-trigger
            aria-label="Select model"
            aria-haspopup="dialog"
            aria-expanded={open && !busy}
            title={busy ? "Bot is busy" : triggerTitle}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)]/60 py-1 text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50",
              compact ? "size-8 justify-center px-0" : "pl-2 pr-2.5",
              className,
            )}
          >
            {activeProvider && <ProviderMark providerId={activeProvider.id} size={14} />}
            {!compact && (
              <span className="flex min-w-0 items-center gap-1">
                <span className="max-w-[160px] truncate">{triggerLabel}</span>
              </span>
            )}
            {!compact && (
              <CaretDown
                size={14}
                className={cn(
                  "text-[var(--text-secondary)] transition-transform",
                  open && "rotate-180",
                )}
              />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          data-bot-model-picker-content
          aria-label="Choose a model"
          className="w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0 text-[var(--text-primary)] shadow-2xl"
        >
          <div className="flex max-h-[min(480px,calc(100dvh-7rem))]">
            <div
              className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--surface-panel)] p-2"
              data-bot-model-rail
            >
              {cloud.length > 0 && (
                <div className="px-0 pb-0.5 pt-0.5 text-center text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Cloud
                </div>
              )}
              {cloud.map(railButton)}
              {local.length > 0 && (
                <div className="px-0 pb-0.5 pt-2 text-center text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Local
                </div>
              )}
              {local.map(railButton)}
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {showScope && (
                <div className="shrink-0 border-b border-[var(--border-subtle)] px-3 py-2">
                  <div role="group" aria-label="Apply model changes to" className="flex gap-1">
                    {(["thread", "bot"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={scope === value}
                        onClick={() => onScope(value)}
                        className={cn(
                          "rounded-lg px-2 py-1 text-[12px]",
                          scope === value
                            ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                        )}
                      >
                        {value === "bot" ? "Thread + bot default" : "Only this thread"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {scope === "bot"
                      ? "This thread, groups, and new threads. Other existing threads keep their model."
                      : "Other threads and groups keep their model."}
                  </p>
                </div>
              )}

              {railProvider ? (
                <>
                  <div className="shrink-0 px-4 pb-2 pt-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-[14px] font-semibold text-[var(--text-primary)]">
                        {railProvider.name || meta.name}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {onRefresh && (
                          <button
                            type="button"
                            disabled={refreshing}
                            onClick={onRefresh}
                            aria-label={refreshing ? `Refreshing ${meta.name}` : `Refresh ${meta.name}`}
                            className="flex size-6 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:cursor-wait disabled:opacity-70"
                          >
                            {refreshing ? (
                              <CircleNotch size={12} className="animate-spin" />
                            ) : (
                              <ArrowClockwise size={12} />
                            )}
                          </button>
                        )}
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                            tone === "blocked"
                              ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
                              : "bg-[var(--status-success-bg)] text-[var(--status-success)]",
                          )}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                    {railProvider.account && (
                      <p className="mt-1 break-words text-[11px] text-[var(--text-secondary)]">
                        {railProvider.account}
                      </p>
                    )}
                    <div className="mt-0.5 text-[11.5px] text-[var(--text-secondary)]">
                      {scope === "thread" && showScope
                        ? "Choose a model for this thread."
                        : "Choose a model for this bot."}
                    </div>
                  </div>

                  {blocked ? (
                    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-1">
                      <div className="rounded-xl border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] px-3 py-3">
                        <div className="flex items-start gap-2 text-[13px] font-medium text-[var(--text-primary)]">
                          <Warning size={16} className="mt-0.5 shrink-0 text-[var(--status-warning)]" />
                          <span>{status}</span>
                        </div>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                          {railProvider.reason ??
                            `${meta.name} is not available. The bot will not switch engines.`}
                        </p>
                        {meta.installCommand && !railProvider.installed && (
                          <p className="mt-2 font-mono text-[11px] text-[var(--text-secondary)]">
                            {meta.installCommand}
                          </p>
                        )}
                        {meta.authCommand && railProvider.installed && !railProvider.available && (
                          <p className="mt-2 font-mono text-[11px] text-[var(--text-secondary)]">
                            {meta.authCommand}
                          </p>
                        )}
                        {onConnectProvider && (
                          <button
                            type="button"
                            onClick={() => {
                              onConnectProvider(railProvider.id);
                              onOpenChange(false);
                            }}
                            className="mt-3 w-full rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-inverse)] hover:opacity-90"
                          >
                            Connect {meta.name}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {models.length > COMPACT_MODEL_COUNT && (
                        <div className="shrink-0 px-2 pb-2">
                          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2.5 py-1.5 focus-within:border-[var(--accent-primary)]/60">
                            <MagnifyingGlass size={13} className="shrink-0 text-[var(--text-secondary)]" />
                            <input
                              value={query}
                              onChange={(event) => {
                                setQuery(event.target.value);
                                if (event.target.value) setShowAll(true);
                              }}
                              placeholder="Search models"
                              aria-label="Search models"
                              className="w-full bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                        {shown.map((model) => {
                          const current =
                            railProvider.id === selectedProviderId && model.id === selectedModelId;
                          return (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => {
                                onPickModel(railProvider.id, model.id);
                                onOpenChange(false);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                                current && "bg-[var(--surface-hover)]",
                              )}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate">{model.name}</span>
                                {model.default && (
                                  <span className="shrink-0 rounded bg-[var(--surface-panel)] px-1.5 py-px text-[10px] text-[var(--text-secondary)]">
                                    Default
                                  </span>
                                )}
                              </span>
                              {current && (
                                <Check size={14} className="shrink-0 text-[var(--accent-primary)]" />
                              )}
                            </button>
                          );
                        })}
                        {shown.length === 0 && (
                          <div className="px-2 py-5 text-center text-[12.5px] text-[var(--text-secondary)]">
                            {query.trim()
                              ? `No models match “${query.trim()}”.`
                              : "No models advertised for this provider."}
                          </div>
                        )}
                        {!query && !showAll && models.length > compactList.length && (
                          <button
                            type="button"
                            onClick={() => setShowAll(true)}
                            className="mt-1 flex w-full items-center justify-between rounded-lg border-t border-[var(--border-subtle)] px-2.5 py-2 text-[12.5px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                          >
                            Show all {models.length} models
                            <CaretDown size={13} />
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {error && (
                    <div
                      role="alert"
                      className="shrink-0 border-t border-[var(--status-error)]/30 bg-[var(--status-error-bg)] px-4 py-2 text-[12px] text-[var(--status-error)]"
                    >
                      {error}
                    </div>
                  )}

                  {usageLine && (
                    <div className="shrink-0 border-t border-[var(--border-subtle)] px-4 py-2 text-[11.5px] text-[var(--text-secondary)]">
                      {usageLine}
                    </div>
                  )}

                  {railKindIsCloud(railProvider.id) && (
                    <button
                      type="button"
                      disabled={!firstLocal}
                      onClick={() => firstLocal && selectRail(firstLocal.id)}
                      className="flex w-full shrink-0 items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-4 py-3 text-left text-[12.5px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:text-[var(--text-muted)] disabled:hover:bg-transparent"
                    >
                      <span>Use a local model</span>
                      <CaretRight size={14} className="text-[var(--text-secondary)]" />
                    </button>
                  )}
                </>
              ) : (
                <div className="px-4 py-5 text-[13px] text-[var(--text-secondary)]">
                  No providers detected.
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

function railKindIsCloud(providerId: string): boolean {
  return getProviderMeta(providerId).kind !== "local";
}

export interface BotModeModelPickerProps {
  bot: Agent | null;
  sessionId?: string | null;
  compact?: boolean;
  busy?: boolean;
  onRuntimeModel?: (runtimeModelId: string, meta: { scope: BotModelScope }) => void;
  /** Opens ProviderGallery for the blocked provider the user asked to connect. */
  onConnectProvider?: (providerId: string) => void;
  /**
   * Bumped by the parent when ProviderGallery closes so the picker refetches
   * discovery + CLI status and the rail un-dims after a connect.
   */
  refetchSignal?: number;
  className?: string;
}

export function BotModeModelPicker({
  bot,
  sessionId,
  compact,
  busy,
  onRuntimeModel,
  onConnectProvider,
  refetchSignal = 0,
  className,
}: BotModeModelPickerProps) {
  const discovery = useModelDiscovery();
  const brainModels = useAvailableBrainModels();
  const usage = useUsageSummary();
  const cli = useInferenceRouterCliStatus();
  const updateAgent = useAgentStore((state) => state.updateAgent);
  const updateSession = useChatSessionStore((state) => state.updateSession);
  const sessions = useChatSessionStore((state) => state.sessions);
  const session = sessionId ? sessions.find((row) => row.id === sessionId) : undefined;
  const threadPin = parseThreadModelPin(session?.metadata?.[THREAD_MODEL_PIN_KEY]);

  const resolved = resolveBotRuntimeModel({ threadPin, bot });
  const [scope, setScope] = useState<BotModelScope>(sessionId ? "thread" : "bot");
  const [open, setOpen] = useState(false);
  const [railId, setRailId] = useState<string | null>(null);
  // Effort is only preserved (a pin/brain value set elsewhere), never edited
  // here: no per-send path delivers it to the engine yet.
  const [effort, setEffort] = useState<BotBrainEffort | undefined>(resolved?.effort);
  const [picked, setPicked] = useState<{ providerId: string; modelId: string } | null>(
    resolved ? { providerId: resolved.providerId, modelId: resolved.modelId } : null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setPicked(resolved ? { providerId: resolved.providerId, modelId: resolved.modelId } : null);
    setEffort(resolved?.effort);
    setSaveError(null);
  }, [resolved?.providerId, resolved?.modelId, resolved?.effort, sessionId, bot?.id]);

  const entries = useMemo<BotModeProvider[]>(
    () =>
      buildAllternitEngineCatalog({
        authProviders: discovery.providers,
        runtimeProviders: discovery.realModels,
        brainModels: brainModels.models,
        cliRows: cli.providers,
        usageSummary: usage.summary,
        authError: Boolean(discovery.providersError),
        current: picked ? { providerId: picked.providerId, modelId: picked.modelId } : null,
      }),
    [
      discovery.providers,
      discovery.realModels,
      discovery.providersError,
      brainModels.models,
      cli.providers,
      usage.summary,
      picked,
    ],
  );

  const usageLine = useMemo(() => formatEngineUsageLine(usage.summary), [usage.summary]);

  useEffect(() => {
    if (open) {
      void discovery.fetchProviders();
      void cli.refetch();
    }
  }, [open, discovery.fetchProviders, cli.refetch]);

  useEffect(() => {
    if (refetchSignal > 0) {
      void discovery.fetchProviders();
      void cli.refetch();
      void usage.refetch();
    }
  }, [refetchSignal, discovery.fetchProviders, cli.refetch, usage.refetch]);

  const persist = useCallback(
    async (next: { providerId: string; modelId: string; effort?: BotBrainEffort; scope: BotModelScope }) => {
      const previous = picked;
      const previousPin = threadPin;
      const pin: BotThreadModelPin = {
        providerId: next.providerId,
        modelId: next.modelId,
        ...(next.effort ? { effort: next.effort } : {}),
      };
      try {
        if (sessionId) {
          await updateSession(sessionId, { metadata: { [THREAD_MODEL_PIN_KEY]: pin } });
        }
        if (next.scope === "bot" && bot) {
          try {
            await updateAgent(bot.id, agentUpdatesFromPick(bot, next));
          } catch (err) {
            // Roll the thread pin back so a failed bot write does not leave a
            // half-applied pick behind.
            if (sessionId) {
              await updateSession(sessionId, {
                metadata: { [THREAD_MODEL_PIN_KEY]: previousPin },
              }).catch(() => undefined);
            }
            throw err;
          }
        }
      } catch (err) {
        logger.warn({ err, sessionId, botId: bot?.id }, "Failed to persist bot model pick");
        setPicked(previous);
        setSaveError(
          err instanceof Error && err.message
            ? `Could not save the model change: ${err.message}`
            : "Could not save the model change. The previous choice is still active.",
        );
        return;
      }
      // Only a fully persisted pick becomes the runtime model for the next
      // send; a failed save keeps the previous choice.
      setSaveError(null);
      onRuntimeModel?.(runtimeModelIdOf(next.providerId, next.modelId), { scope: next.scope });
    },
    [bot, onRuntimeModel, picked, sessionId, threadPin, updateAgent, updateSession],
  );

  const handlePickModel = useCallback(
    (providerId: string, modelId: string) => {
      // Use the executable provider id carried by the model row (alias folds
      // can differ from the rail row id).
      const row = entries.find((entry) => entry.id === providerId);
      const executableId =
        row?.models.find((model) => model.id === modelId)?.providerId ?? providerId;
      const next = { providerId: executableId, modelId, effort, scope };
      setPicked({ providerId: executableId, modelId });
      void persist(next);
    },
    [entries, effort, persist, scope],
  );

  return (
    <BotModeModelPickerUI
      providers={entries}
      selectedProviderId={
        picked ? canonicalProviderId(picked.providerId) : (railId ?? entries[0]?.id ?? null)
      }
      selectedModelId={picked?.modelId ?? null}
      scope={scope}
      open={open}
      showScope={Boolean(sessionId)}
      compact={compact}
      busy={busy}
      refreshing={(discovery.providersLoading || cli.isLoading) && open}
      error={saveError}
      usageLine={usageLine}
      onOpenChange={setOpen}
      onSelectRail={setRailId}
      onPickModel={handlePickModel}
      onScope={setScope}
      onRefresh={() => {
        void discovery.fetchProviders();
        void cli.refetch();
      }}
      onConnectProvider={onConnectProvider}
      className={className}
    />
  );
}
