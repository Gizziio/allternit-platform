"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CaretDown, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { updateAgent } from "@/lib/agents/agent.service";
import type { Agent } from "@/lib/agents/agent.types";
import {
  getProviderMeta,
  type ProviderKind,
} from "@/lib/providers/provider-registry";
import { useInferenceRouterCliStatus } from "@/views/chat/hooks/useInferenceRouterCliStatus";
import { createModuleLogger } from "@/lib/logger";

const logger = createModuleLogger("ChatModelPicker");

export interface ModelPickerProps {
  agent: Agent;
  /** Current runtime model id in `provider/model` form. */
  value?: string | null;
  /** Called when the user picks a model. */
  onChange?: (runtimeModelId: string) => void;
  className?: string;
}

interface ProviderModel {
  id: string;
  name: string;
  default?: boolean;
}

interface ProviderEntry {
  id: string;
  name: string;
  installed: boolean;
  available: boolean;
  reason?: string;
  models: ProviderModel[];
}

function parseRuntimeModelId(runtimeModelId: string): {
  providerId: string;
  modelId: string;
} {
  const separator = runtimeModelId.indexOf("/");
  if (separator <= 0) {
    return { providerId: "allternit", modelId: runtimeModelId };
  }
  return {
    providerId: runtimeModelId.slice(0, separator),
    modelId: runtimeModelId.slice(separator + 1),
  };
}

function providerIdToAgentProvider(providerId: string): Agent["provider"] {
  switch (providerId) {
    case "claude-cli":
    case "claude-code":
    case "claude":
      return "anthropic";
    case "codex-cli":
    case "codex":
    case "openai":
      return "openai";
    case "google":
    case "gemini":
      return "google";
    case "ollama":
    case "allternit":
    case "allternit-local-engine":
    case "allternit-sidecar":
    case "gizzi":
      return "local";
    default:
      return "custom";
  }
}

function getProviderKind(providerId: string): ProviderKind {
  const meta = getProviderMeta(providerId);
  return meta.kind;
}

export function ModelPicker({
  agent,
  value: controlledValue,
  onChange,
  className,
}: ModelPickerProps) {
  const { providers, isLoading, refetch } = useInferenceRouterCliStatus();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentValue = useMemo(() => {
    if (controlledValue) return controlledValue;
    const config = (agent.config ?? {}) as Record<string, unknown>;
    if (typeof config.runtimeModelId === "string" && config.runtimeModelId) {
      return config.runtimeModelId;
    }
    if (agent.provider && agent.model) {
      return `${agent.provider}/${agent.model}`;
    }
    return null;
  }, [controlledValue, agent.config, agent.provider, agent.model]);

  const { providerId: currentProviderId, modelId: currentModelId } = useMemo(
    () => (currentValue ? parseRuntimeModelId(currentValue) : { providerId: "", modelId: "" }),
    [currentValue]
  );

  const entries = useMemo<ProviderEntry[]>(() => {
    const rank = (id: string) => {
      const key = id.toLowerCase();
      if (key === "allternit") return 0;
      const kind = getProviderMeta(id).kind;
      if (kind === "cli") return 1;
      if (kind === "local") return 2;
      return 3;
    };
    const list = providers.map((p) => ({
      ...p,
      models: p.models ?? [],
    }));

    // Always include the currently selected provider even if the detector did
    // not return it (e.g. a custom brain), so the picker never shows a blank
    // selection.
    if (currentProviderId && !list.some((p) => p.id === currentProviderId)) {
      const meta = getProviderMeta(currentProviderId);
      list.push({
        id: currentProviderId,
        name: meta.name,
        installed: true,
        available: true,
        models: currentModelId
          ? [{ id: currentModelId, name: currentModelId, default: true }]
          : [],
      });
    }

    list.sort((a, b) => {
      const d = rank(a.id) - rank(b.id);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
    return list;
  }, [providers, currentProviderId, currentModelId]);

  const selectedProvider = useMemo(
    () => entries.find((p) => p.id === currentProviderId) ?? entries[0],
    [entries, currentProviderId]
  );

  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  const handleSelect = useCallback(
    async (providerId: string, modelId: string) => {
      const runtimeModelId = `${providerId}/${modelId}`;
      onChange?.(runtimeModelId);
      setOpen(false);

      setIsSaving(true);
      try {
        const config = { ...(agent.config ?? {}), runtimeModelId };
        await updateAgent(agent.id, {
          model: modelId,
          provider: providerIdToAgentProvider(providerId),
          config,
        });
      } catch (err) {
        logger.warn({ err, agentId: agent.id }, "Failed to persist model selection");
      } finally {
        setIsSaving(false);
      }
    },
    [onChange, agent.id, agent.config]
  );

  const triggerLabel = useMemo(() => {
    if (!currentValue) return "Pick a brain";
    const meta = getProviderMeta(currentProviderId);
    return `${meta.name} · ${currentModelId}`;
  }, [currentValue, currentProviderId, currentModelId]);

  const triggerAccent = useMemo(() => {
    const meta = getProviderMeta(currentProviderId);
    return meta.color;
  }, [currentProviderId]);

  return (
    <TooltipProvider delayDuration={150}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            aria-label="Pick a brain"
            className={cn(
              "h-8 gap-1.5 rounded-full border-[var(--ui-border-default)] bg-[var(--surface-panel)]/60 px-3 text-xs font-medium text-[var(--ui-text-primary)] hover:bg-[var(--surface-hover)]",
              className
            )}
            style={{
              borderColor: currentValue ? `${triggerAccent}40` : undefined,
            }}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: triggerAccent }}
            />
            <span className="max-w-[180px] truncate">{triggerLabel}</span>
            <CaretDown
              size={12}
              className={cn(
                "text-[var(--ui-text-muted)] transition-transform",
                open && "rotate-180"
              )}
            />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-[360px] border-[var(--ui-border-default)] bg-[var(--bg-elevated)] p-0 text-[var(--ui-text-primary)]"
        >
          <div className="border-b border-[var(--ui-border-default)] px-3 py-2.5">
            <div className="text-sm font-semibold">Pick a brain</div>
            <div className="text-[11px] text-[var(--ui-text-muted)]">
              Choose the provider and model for {agent.name}
            </div>
          </div>

          {isLoading && entries.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-[var(--ui-text-muted)]">
              Scanning local providers…
            </div>
          )}

          <div className="flex max-h-[420px] flex-col">
            {/* Provider rail */}
            <div className="scrollbar-hide flex gap-1.5 overflow-x-auto border-b border-[var(--ui-border-default)] px-3 py-2.5">
              {entries.map((provider) => {
                const meta = getProviderMeta(provider.id);
                const selected = provider.id === selectedProvider?.id;
                const dimmed = !provider.available;

                const pill = (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => {
                      if (provider.available && provider.models.length > 0) {
                        // Pre-select the default model when switching provider.
                        const defaultModel =
                          provider.models.find((m) => m.default)?.id ??
                          provider.models[0].id;
                        void handleSelect(provider.id, defaultModel);
                      }
                    }}
                    disabled={!provider.available}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? "border-[var(--accent-chat)]/40 bg-[var(--accent-chat)]/10 text-[var(--accent-chat)]"
                        : "border-[var(--ui-border-default)] bg-[var(--surface-panel)] text-[var(--ui-text-primary)] hover:bg-[var(--surface-hover)]",
                      dimmed &&
                        "cursor-not-allowed opacity-50 hover:bg-[var(--surface-panel)]"
                    )}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <span>{meta.name}</span>
                    {dimmed && <WarningCircle size={10} />}
                  </button>
                );

                if (!dimmed) return pill;

                return (
                  <Tooltip key={provider.id}>
                    <TooltipTrigger asChild>{pill}</TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-[240px] text-xs"
                    >
                      {provider.reason ?? "Unavailable"}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Model list for selected provider */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {selectedProvider ? (
                <div className="space-y-0.5">
                  {selectedProvider.models.length === 0 && (
                    <div className="px-2 py-4 text-center text-xs text-[var(--ui-text-muted)]">
                      No models advertised for this provider.
                    </div>
                  )}
                  {selectedProvider.models.map((model) => {
                    const isCurrent =
                      selectedProvider.id === currentProviderId &&
                      model.id === currentModelId;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleSelect(selectedProvider.id, model.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                          isCurrent
                            ? "bg-[var(--surface-hover)] text-[var(--ui-text-primary)]"
                            : "text-[var(--ui-text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ui-text-primary)]"
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{model.name}</span>
                          {model.default && (
                            <Badge
                              variant="secondary"
                              className="h-4 px-1 text-[9px] font-medium"
                            >
                              Default
                            </Badge>
                          )}
                        </span>
                        {isCurrent && (
                          <Check
                            size={14}
                            className="shrink-0 text-[var(--accent-chat)]"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-2 py-4 text-center text-xs text-[var(--ui-text-muted)]">
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
