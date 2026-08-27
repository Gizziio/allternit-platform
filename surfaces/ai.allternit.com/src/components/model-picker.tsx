"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import { useModelDiscovery, useUsageSummary } from "@/integration/api-client";
import { useModelSelection } from "@/providers/model-selection-provider";
import {
  getProviderMeta,
  getProviderName,
  PROVIDER_REGISTRY,
  type ProviderKind,
} from "@/lib/providers/provider-registry";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Warning,
  Check,
  CircleNotch,
  Sparkle,
  MagnifyingGlass,
  Plus,
  CaretDown,
  Flask,
  Robot,
  Terminal,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ModelOption } from "@/components/prompt-kit/prompt-model-selector";
import type {
  ProviderAuthStatus,
  ProviderInfo,
  ModelValidationResult,
  UsageSummary,
} from "@/integration/api-client";

export interface ModelSelection {
  providerId: string;
  profileId: string;
  modelId: string;
  modelName?: string;
}

interface ModelPickerProps {
  onSelect: (selection: ModelSelection) => void;
  onCancel?: () => void;
  defaultProfileId?: string;
  trigger?: React.ReactNode;
  /** Controlled open state - if provided, component becomes controlled */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Called when the user wants to connect a new provider */
  onOpenProviderConnect?: () => void;
  /** Called when the user wants to open the Model Lab */
  onOpenModelLab?: () => void;
  /** Enable provider multi-select checkboxes and the "Use selected" footer. */
  multiSelect?: boolean;
  /** Called when the user confirms a multi-provider selection. */
  onSelectMultiple?: (selections: ModelSelection[]) => void;
}

function resolveProfileId(
  providerId: string,
  authenticatedProviders: { provider_id: string; chat_profile_ids: string[] }[]
): string {
  const match = authenticatedProviders.find((p) => p.provider_id === providerId);
  if (match?.chat_profile_ids?.length) return match.chat_profile_ids[0];
  return `${providerId}-acp`;
}

function ProviderIcon({ providerId }: { providerId: string }) {
  const meta = getProviderMeta(providerId);
  const [error, setError] = useState(false);
  const src = meta.icon ? `/assets/runtime-logos/${meta.icon}` : "";

  // No fabricated brand marks. Missing logos render a real Terminal icon from
  // the installed Phosphor icon library (category icon, not a monogram).
  if (!src || error) {
    return (
      <div
        className="size-8 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: `${meta.color}18`,
          border: `1px solid ${meta.color}40`,
        }}
      >
        <Terminal size={18} style={{ color: meta.color }} />
      </div>
    );
  }

  return (
    <div
      className="size-8 rounded-lg flex items-center justify-center shrink-0"
      style={{
        background: `${meta.color}18`,
        border: `1px solid ${meta.color}40`,
      }}
    >
      <img
        src={src}
        alt=""
        className="size-4 object-contain"
        onError={() => setError(true)}
      />
    </div>
  );
}

type EffectiveStatus = ProviderInfo["status"] | "unknown" | "missing";

function getEffectiveStatus(
  provider: ProviderAuthStatus,
  runtimeStatus: ProviderInfo["status"] | undefined,
  kind: ProviderKind
): EffectiveStatus {
  // The runtime registry has the most concrete view of CLI/local state.
  if (runtimeStatus && runtimeStatus !== "unknown") return runtimeStatus;

  if (provider.authenticated) return "active";

  if (kind === "api") {
    if (provider.status === "missing" || provider.status === "expired") {
      return "missing_key";
    }
    return "unconfigured";
  }

  if (kind === "cli") {
    if (provider.status === "ok") return "active";
    if (provider.status === "missing" || provider.status === "expired") {
      return "missing_key";
    }
    return "offline";
  }

  // local
  return "unknown";
}

function statusLabel(
  status: EffectiveStatus,
  kind: ProviderKind
): { text: string; intent: "success" | "warning" | "muted" } {
  switch (status) {
    case "active":
      return { text: "Connected", intent: "success" };
    case "ready_no_models":
      return { text: "Connected · no models", intent: "success" };
    case "missing_key":
      return { text: kind === "cli" ? "Sign in" : "API key", intent: "warning" };
    case "offline":
      return { text: "Not installed", intent: "muted" };
    case "unknown":
      return {
        text: kind === "cli" ? "Not installed" : kind === "local" ? "Local" : "Not connected",
        intent: "muted",
      };
    case "missing":
      return { text: kind === "cli" ? "Sign in" : "API key", intent: "warning" };
    case "unconfigured":
    default:
      return { text: "Connect", intent: "muted" };
  }
}

function StatusPill({
  status,
  kind,
}: {
  status: EffectiveStatus;
  kind: ProviderKind;
}) {
  const { text, intent } = statusLabel(status, kind);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
        intent === "success" &&
          "bg-[var(--status-success)]/10 border-[var(--status-success)]/20 text-[var(--status-success)]",
        intent === "warning" &&
          "bg-[var(--status-warning)]/10 border-[var(--status-warning)]/20 text-[var(--status-warning)]",
        intent === "muted" &&
          "bg-[var(--surface-panel-muted)] border-[var(--ui-border-muted)] text-[var(--ui-text-muted)]"
      )}
    >
      {intent === "success" ? (
        <Check size={10} weight="bold" />
      ) : intent === "warning" ? (
        <Warning size={10} weight="bold" />
      ) : null}
      {text}
    </span>
  );
}

interface ProviderRowProps {
  providerId: string;
  providerName: string;
  status: EffectiveStatus;
  kind: ProviderKind;
  expanded: boolean;
  onToggle: () => void;
  modelCount: number;
  usage?: { requests: number; cost: number } | null;
  onConnect?: () => void;
  multiSelect?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** In single-select mode, clicking the provider row selects its model. */
  onSelect?: () => void;
}

function ProviderRow({
  providerId,
  providerName,
  status,
  kind,
  expanded,
  onToggle,
  modelCount,
  usage,
  onConnect,
  multiSelect,
  selected,
  onToggleSelect,
  onSelect,
}: ProviderRowProps) {
  const kindLabel =
    kind === "cli" ? "CLI runtime" : kind === "local" ? "Local runtime" : "Cloud runtime";

  const subtitle = [
    modelCount > 0 ? `${modelCount} model${modelCount === 1 ? "" : "s"}` : kindLabel,
    usage && usage.requests > 0 ? `${formatTokenCount(usage.requests)} req` : undefined,
    usage && usage.cost > 0 ? formatUsageCost(usage.cost) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleRowClick = onSelect ?? onToggle;
  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.currentTarget !== e.target) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      (onSelect ?? onToggle)();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      className={cn(
        "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-chat)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-elevated)]",
        expanded
          ? "bg-[var(--surface-panel)]"
          : "hover:bg-[var(--surface-hover)]",
        onSelect && "cursor-pointer"
      )}
    >
      {multiSelect && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        >
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            className="border-[var(--ui-border-default)] data-[state=checked]:bg-[var(--accent-chat)] data-[state=checked]:border-[var(--accent-chat)]"
            aria-label={`Select ${providerName}`}
          />
        </div>
      )}

      <ProviderIcon providerId={providerId} />

      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-semibold text-sm text-[var(--ui-text-primary)] truncate">
          {providerName}
        </span>
        <span className="text-xs text-[var(--ui-text-muted)]">{subtitle}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StatusPill status={status} kind={kind} />
        {onConnect && status !== "active" && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onConnect();
            }}
            className="h-6 px-2 text-[10px] border-[var(--ui-border-default)] text-[var(--ui-text-primary)] hover:bg-[var(--surface-hover)]"
          >
            Connect
          </Button>
        )}
        <CaretDown
          size={14}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            "text-[var(--ui-text-muted)] transition-transform",
            expanded && "rotate-180"
          )}
        />
      </div>
    </div>
  );
}

function formatContextWindow(value: number | undefined): string | null {
  if (!value || value <= 0) return null;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ctx`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k ctx`;
  return `${value} ctx`;
}

function formatTokenCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

function formatUsageCost(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0.00";
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

export interface ModelPickerUIData {
  availableModels: ModelOption[];
  providers: ProviderAuthStatus[];
  authenticatedProviders: ProviderAuthStatus[];
  providersLoading: boolean;
  providersError: Error | null;
  validationResult: ModelValidationResult | null;
  validationLoading: boolean;
  validateModel: (
    providerId: string,
    modelId: string
  ) => Promise<ModelValidationResult | null>;
  selectedModelId: string | null;
  initialExpandedProviders?: string[];
  /** Real usage consumption (requests, tokens, cost) shown in the footer. */
  usageSummary?: UsageSummary | null;
  /** Runtime registry rows so we can show real backend status (active, offline, …). */
  realModels?: ProviderInfo[];
  /** Optional per-provider usage to show on each runtime row. */
  providerUsage?: Record<string, { requests: number; cost: number }> | null;
}

interface ModelPickerUIProps extends ModelPickerProps, ModelPickerUIData {}

export function ModelPickerUI({
  onSelect,
  onCancel,
  defaultProfileId,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onOpenProviderConnect,
  onOpenModelLab,
  availableModels,
  providers,
  authenticatedProviders,
  providersLoading,
  providersError,
  validationResult,
  validationLoading,
  validateModel,
  selectedModelId,
  initialExpandedProviders,
  usageSummary,
  realModels = [],
  providerUsage,
  multiSelect,
  onSelectMultiple,
}: ModelPickerUIProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (!isControlled) {
      setInternalOpen(value);
    }
    onOpenChange?.(value);
  };

  const [search, setSearch] = useState("");
  const [freeformInput, setFreeformInput] = useState("");
  const [customProviderId, setCustomProviderId] = useState<string>("");
  const [customExpanded, setCustomExpanded] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(initialExpandedProviders ?? [])
  );
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setSearch("");
      setFreeformInput("");
      setValidationAttempted(false);
      setCustomExpanded(false);
      setExpandedProviders(new Set());
      setSelectedProviderIds(new Set());
    }
  }, [open]);

  // When the modal opens, expand the provider that contains the currently
  // selected model so the user can see the active runtime.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const selectedModel = availableModels.find((m) => m.id === selectedModelId);
      const providerName =
        selectedModel?.providerName ||
        (selectedModel?.providerId ? getProviderName(selectedModel.providerId) : undefined);
      if (providerName) {
        setExpandedProviders((prev) =>
          prev.has(providerName) ? prev : new Set([...prev, providerName])
        );
      }
    }
    wasOpenRef.current = open;
  }, [open, availableModels, selectedModelId]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (freeformInput && customProviderId) {
        setValidationAttempted(true);
        await validateModel(customProviderId, freeformInput);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [freeformInput, customProviderId, validateModel]);

  useEffect(() => {
    if (
      authenticatedProviders.length > 0 &&
      !customProviderId &&
      !defaultProfileId
    ) {
      setCustomProviderId(authenticatedProviders[0].provider_id);
    }
  }, [authenticatedProviders, customProviderId, defaultProfileId]);

  const isProviderAuthenticated = useCallback(
    (providerId: string) =>
      authenticatedProviders.some((p) => p.provider_id === providerId),
    [authenticatedProviders]
  );

  // Group live models by provider name for display.
  const groupedModels = useMemo(() => {
    const map = new Map<string, ModelOption[]>();
    availableModels.forEach((model) => {
      const key = model.providerName || getProviderName(model.providerId || model.provider);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(model);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [availableModels]);

  // Also index by provider id so rows can reliably find their models even when
  // the model's providerName differs from the registry display name.
  const modelsByProviderId = useMemo(() => {
    const map = new Map<string, ModelOption[]>();
    availableModels.forEach((model) => {
      const key = model.providerId || model.provider;
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(model);
    });
    return map;
  }, [availableModels]);

  const getProviderModels = useCallback(
    (providerId: string, providerName: string): ModelOption[] => {
      return (
        modelsByProviderId.get(providerId) ??
        groupedModels.find(([name]) => name === providerName)?.[1] ??
        []
      );
    },
    [groupedModels, modelsByProviderId]
  );

  const providerStatus = useMemo(() => {
    const map = new Map<string, ProviderAuthStatus>();
    providers.forEach((p) => map.set(p.provider_id, p));
    return map;
  }, [providers]);

  const runtimeStatusMap = useMemo(() => {
    const map = new Map<string, ProviderInfo["status"]>();
    realModels.forEach((r) => {
      if (r.id) map.set(r.id, r.status);
    });
    return map;
  }, [realModels]);

  const runtimeStatus = useCallback(
    (providerId: string) => runtimeStatusMap.get(providerId) ?? undefined,
    [runtimeStatusMap]
  );

  const effectiveStatus = useCallback(
    (provider: ProviderAuthStatus): EffectiveStatus => {
      const meta = getProviderMeta(provider.provider_id);
      return getEffectiveStatus(provider, runtimeStatus(provider.provider_id), meta.kind);
    },
    [runtimeStatus]
  );

  // If the backend is unreachable, fall back to the provider registry so the
  // modal still shows available CLI/API runtimes instead of an empty list.
  const allProviders = useMemo<ProviderAuthStatus[]>(() => {
    if (providers.length > 0) return providers;
    return Object.values(PROVIDER_REGISTRY).map((meta) => ({
      provider_id: meta.id,
      status: (meta.kind === "cli" ? "unknown" : "missing") as ProviderAuthStatus["status"],
      authenticated: false,
      auth_required: meta.kind !== "local",
      auth_profile_id: null,
      chat_profile_ids: [] as string[],
    }));
  }, [providers]);

  const providersWithModels = useMemo(() => {
    const ids = new Set<string>();
    availableModels.forEach((m) => {
      ids.add(m.providerId || m.provider || m.providerName || "");
    });
    return ids;
  }, [availableModels]);

  // CLI runtimes: split by whether the backend says they are installed/active.
  const cliProviders = useMemo(() => {
    return allProviders.filter((p) => {
      const meta = getProviderMeta(p.provider_id);
      return meta.kind === "cli";
    });
  }, [allProviders]);

  const installedCli = useMemo(
    () =>
      cliProviders.filter((p) => {
        const s = effectiveStatus(p);
        return s === "active" || s === "missing_key" || s === "ready_no_models";
      }),
    [cliProviders, effectiveStatus]
  );
  const availableCli = useMemo(
    () =>
      cliProviders.filter((p) => {
        const s = effectiveStatus(p);
        return s === "offline" || s === "unconfigured" || s === "unknown";
      }),
    [cliProviders, effectiveStatus]
  );

  // API/cloud providers that have discovered models.
  const apiProviders = useMemo(() => {
    return allProviders.filter((p) => {
      const meta = getProviderMeta(p.provider_id);
      return meta.kind === "api" && providersWithModels.has(p.provider_id);
    });
  }, [allProviders, providersWithModels]);

  // Local runtimes (Ollama / sidecar).
  const localProviders = useMemo(() => {
    return allProviders.filter((p) => {
      const meta = getProviderMeta(p.provider_id);
      return meta.kind === "local";
    });
  }, [allProviders]);

  const emptyProviders = useMemo(
    () =>
      allProviders.filter(
        (p) =>
          p.provider_id &&
          !providersWithModels.has(p.provider_id) &&
          p.provider_id !== "echo" &&
          getProviderMeta(p.provider_id).kind !== "cli"
      ),
    [allProviders, providersWithModels]
  );

  const toggleProvider = useCallback((providerName: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(providerName)) {
        next.delete(providerName);
      } else {
        next.add(providerName);
      }
      return next;
    });
  }, []);

  const toggleProviderSelection = useCallback((providerId: string) => {
    setSelectedProviderIds((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  }, []);

  const handleSelectModel = useCallback(
    (model: ModelOption) => {
      const providerId = model.providerId || model.provider || "allternit";
      const profileId = resolveProfileId(providerId, authenticatedProviders);
      const next: ModelSelection = {
        providerId,
        profileId,
        modelId: model.id,
        modelName: model.name,
      };
      onSelect(next);
      setOpen(false);
    },
    [authenticatedProviders, onSelect]
  );

  const handleConfirmCustom = useCallback(() => {
    if (!customProviderId || !freeformInput) return;
    if (!validationResult?.valid) return;
    const profileId = resolveProfileId(customProviderId, authenticatedProviders);
    const next: ModelSelection = {
      providerId: customProviderId,
      profileId,
      modelId: freeformInput,
      modelName: validationResult.model?.name || freeformInput,
    };
    onSelect(next);
    setOpen(false);
  }, [
    authenticatedProviders,
    customProviderId,
    freeformInput,
    onSelect,
    validationResult,
  ]);

  const handleUseSelected = useCallback(() => {
    if (!onSelectMultiple || selectedProviderIds.size === 0) return;
    const selections: ModelSelection[] = [];
    selectedProviderIds.forEach((providerId) => {
      const meta = getProviderMeta(providerId);
      const models = getProviderModels(providerId, meta.name);
      if (models.length === 0) return;
      const model = models[0];
      const profileId = resolveProfileId(providerId, authenticatedProviders);
      selections.push({
        providerId,
        profileId,
        modelId: model.id,
        modelName: model.name,
      });
    });
    if (selections.length > 0) {
      onSelectMultiple(selections);
      setOpen(false);
    }
  }, [authenticatedProviders, getProviderModels, onSelectMultiple, selectedProviderIds]);

  const isLoading = providersLoading;

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groupedModels;
    return groupedModels
      .map(([providerName, models]) => {
        const providerMatches = providerName.toLowerCase().includes(term);
        const matchedModels = providerMatches
          ? models
          : models.filter(
              (m) =>
                m.name.toLowerCase().includes(term) ||
                m.id.toLowerCase().includes(term) ||
                (m.description?.toLowerCase().includes(term) ?? false)
            );
        return [providerName, matchedModels] as const;
      })
      .filter(([, models]) => models.length > 0);
  }, [groupedModels, search]);

  const filteredEmptyProviders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return emptyProviders;
    return emptyProviders.filter((p) => {
      const meta = getProviderMeta(p.provider_id);
      return meta.name.toLowerCase().includes(term);
    });
  }, [emptyProviders, search]);

  const hasAnyResults =
    filteredGroups.length > 0 || filteredEmptyProviders.length > 0;

  const usageLine = useMemo(() => {
    if (!usageSummary) return null;
    return [
      `${usageSummary.requests.toLocaleString()} requests`,
      `${formatTokenCount(usageSummary.tokens.total)} tokens`,
      formatUsageCost(usageSummary.cost),
    ].join(" · ");
  }, [usageSummary]);

  const renderProviderSection = (
    title: string,
    sectionProviders: ProviderAuthStatus[],
    showConnect = false
  ) => {
    if (sectionProviders.length === 0) return null;
    const term = search.trim().toLowerCase();
    const visible = term
      ? sectionProviders.filter((p) => {
          const meta = getProviderMeta(p.provider_id);
          return meta.name.toLowerCase().includes(term);
        })
      : sectionProviders;
    if (visible.length === 0) return null;

    return (
      <div className="mb-4" key={title}>
        <h3 className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">
          {title}
        </h3>
        <div className="space-y-0.5">
          {visible.map((provider) => {
            const meta = getProviderMeta(provider.provider_id);
            const providerName = meta.name;
            const models = getProviderModels(provider.provider_id, providerName);
            const expanded =
              expandedProviders.has(providerName) || term.length > 0;
            const status = effectiveStatus(provider);
            const usage = providerUsage?.[provider.provider_id];
            return (
              <Command.Group
                key={provider.provider_id}
                className="mb-0.5"
                heading={undefined}
              >
                <ProviderRow
                  providerId={provider.provider_id}
                  providerName={providerName}
                  status={status}
                  kind={meta.kind}
                  expanded={expanded}
                  onToggle={() => toggleProvider(providerName)}
                  modelCount={models.length}
                  usage={usage}
                  onConnect={
                    showConnect && onOpenProviderConnect
                      ? () => {
                          setOpen(false);
                          onOpenProviderConnect();
                        }
                      : undefined
                  }
                  multiSelect={multiSelect}
                  selected={selectedProviderIds.has(provider.provider_id)}
                  onToggleSelect={() => toggleProviderSelection(provider.provider_id)}
                  onSelect={
                    !multiSelect && models.length > 0
                      ? () => {
                          const selectedModel = selectedModelId
                            ? models.find((m) => m.id === selectedModelId)
                            : undefined;
                          handleSelectModel(selectedModel ?? models[0]);
                        }
                      : undefined
                  }
                />
                {expanded && models.length === 0 && (
                  <div className="px-3 py-2 text-xs text-[var(--ui-text-muted)]">
                    No models discovered for this runtime.
                  </div>
                )}
                {expanded && models.length > 0 && (
                  <div className="grid gap-0.5 mt-1 pl-4 pr-1">
                    {models.map((model) => {
                      const isSelected = selectedModelId === model.id;
                      const ctx = formatContextWindow(
                        typeof model.context_window === "number"
                          ? model.context_window
                          : undefined
                      );
                      return (
                        <Command.Item
                          key={model.id}
                          value={`${model.id} ${model.name} ${providerName}`}
                          onSelect={() => handleSelectModel(model)}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors border-l-2",
                            isSelected
                              ? "bg-[var(--surface-hover)] text-[var(--ui-text-primary)] border-l-[var(--accent-chat)]"
                              : "hover:bg-[var(--surface-hover)] text-[var(--ui-text-primary)] border-l-transparent"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">
                                {model.name}
                              </span>
                              {model.capabilities?.map((cap) => (
                                <Badge
                                  key={cap}
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-[var(--surface-panel-muted)] text-[var(--ui-text-muted)] border-none"
                                >
                                  {cap}
                                </Badge>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[var(--ui-text-muted)]">
                              {model.description && (
                                <span className="truncate">
                                  {model.description}
                                </span>
                              )}
                              {ctx && (
                                <>
                                  {model.description && (
                                    <span className="opacity-40">·</span>
                                  )}
                                  <span>{ctx}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <Check
                              size={16}
                              weight="bold"
                              className="text-[var(--accent-chat)] shrink-0"
                            />
                          )}
                        </Command.Item>
                      );
                    })}
                  </div>
                )}
              </Command.Group>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="sm:max-w-[720px] p-0 overflow-hidden border-[var(--ui-border-default)] bg-[var(--bg-elevated)] text-[var(--ui-text-primary)]"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--ui-border-default)",
        }}
      >
        <DialogTitle className="sr-only">Select Model</DialogTitle>
        <Command
          className="flex h-full w-full flex-col overflow-hidden bg-transparent"
          filter={() => 1}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ui-border-default)]">
            <div className="flex flex-col">
              <span className="text-base font-semibold text-[var(--ui-text-primary)]">
                Select Model
              </span>
              <span className="text-xs text-[var(--ui-text-muted)]">
                Choose a runtime and model for this message
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                onOpenProviderConnect?.();
              }}
              className="gap-1.5 h-8 text-xs border-[var(--ui-border-default)] text-[var(--ui-text-primary)] hover:bg-[var(--surface-hover)]"
            >
              <Plus size={14} />
              Connect provider
            </Button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 border-b border-[var(--ui-border-default)] px-3 py-2">
            <MagnifyingGlass
              size={16}
              className="shrink-0 text-[var(--ui-text-muted)]"
            />
            <Command.Input
              placeholder="Search models and providers…"
              value={search}
              onValueChange={setSearch}
              className="flex h-10 w-full bg-transparent text-sm outline-none placeholder:text-[var(--ui-text-muted)] text-[var(--ui-text-primary)]"
            />
          </div>

          {/* Model list */}
          <Command.List className="flex-1 overflow-y-auto p-2 max-h-[min(60vh,520px)]">
            {isLoading && availableModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <CircleNotch className="size-6 animate-spin text-[var(--ui-text-muted)]" />
                <p className="text-sm text-[var(--ui-text-muted)]">
                  Loading models…
                </p>
              </div>
            ) : (
              <>
                {renderProviderSection("Installed runtimes", installedCli)}
                {renderProviderSection(
                  "Available runtimes",
                  availableCli,
                  true
                )}
                {renderProviderSection("Cloud providers", apiProviders)}
                {renderProviderSection("Local models", localProviders)}

                {/* Backends with no discovered models */}
                {filteredEmptyProviders.map((provider) => {
                  const meta = getProviderMeta(provider.provider_id);
                  return (
                    <Command.Group
                      key={provider.provider_id}
                      className="mb-2"
                    >
                      <div
                        className={cn(
                          "flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl",
                          "bg-[var(--surface-panel)]/50"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ProviderIcon providerId={provider.provider_id} />
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-sm text-[var(--ui-text-primary)] truncate">
                              {meta.name}
                            </span>
                            <span className="text-xs text-[var(--ui-text-muted)]">
                              No models discovered
                            </span>
                          </div>
                        </div>
                        {!provider.authenticated && onOpenProviderConnect && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setOpen(false);
                              onOpenProviderConnect();
                            }}
                            className="h-7 text-xs border-[var(--ui-border-default)] text-[var(--ui-text-primary)] hover:bg-[var(--surface-hover)]"
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </Command.Group>
                  );
                })}

                {!hasAnyResults && !providersLoading && (
                  <Command.Empty className="py-10 text-center text-sm text-[var(--ui-text-muted)]">
                    <Warning
                      size={32}
                      className="mx-auto mb-3 opacity-60"
                    />
                    <p className="text-[var(--ui-text-primary)] font-medium">
                      {search
                        ? "No models match your search"
                        : "No models discovered"}
                    </p>
                    <p className="text-xs text-[var(--ui-text-muted)] mt-1">
                      {search
                        ? "Try a different term or enter a custom model ID."
                        : "Connect a provider to see available models, or enter a custom model ID."}
                    </p>
                  </Command.Empty>
                )}

                {/* Custom model / Model Lab */}
                {authenticatedProviders.length > 0 && (
                  <div className="border-t border-[var(--ui-border-default)] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setCustomExpanded((v) => !v)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
                        customExpanded
                          ? "bg-[var(--surface-panel)]"
                          : "hover:bg-[var(--surface-hover)]"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="size-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: "var(--surface-panel-muted)",
                            border: "1px solid var(--ui-border-default)",
                          }}
                        >
                          <Robot
                            size={18}
                            className="text-[var(--ui-text-muted)]"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-sm text-[var(--ui-text-primary)] truncate">
                            Custom model
                          </span>
                          <span className="text-xs text-[var(--ui-text-muted)]">
                            Enter a model ID manually
                          </span>
                        </div>
                      </div>
                      <CaretDown
                        size={14}
                        className={cn(
                          "text-[var(--ui-text-muted)] transition-transform",
                          customExpanded && "rotate-180"
                        )}
                      />
                    </button>

                    {customExpanded && (
                      <div className="mt-2 pl-[52px] pr-1 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Sparkle
                            size={14}
                            className="text-[var(--accent-chat)]"
                          />
                          <Label className="text-[var(--ui-text-secondary)] text-sm font-medium">
                            Runtime
                          </Label>
                          <Select
                            value={customProviderId}
                            onValueChange={setCustomProviderId}
                          >
                            <SelectTrigger className="h-8 w-auto min-w-[160px] text-xs bg-[var(--surface-panel)] border-[var(--ui-border-default)] text-[var(--ui-text-primary)]">
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent className="bg-[var(--bg-elevated)] border-[var(--ui-border-default)]">
                              {authenticatedProviders.map((p) => {
                                const meta = getProviderMeta(p.provider_id);
                                return (
                                  <SelectItem
                                    key={p.provider_id}
                                    value={p.provider_id}
                                    className="text-[var(--ui-text-primary)] focus:bg-[var(--surface-hover)]"
                                  >
                                    {meta.name}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          placeholder="Enter model ID…"
                          value={freeformInput}
                          onChange={(e) => {
                            setFreeformInput(e.target.value);
                            setValidationAttempted(false);
                          }}
                          className={cn(
                            "bg-[var(--surface-panel)] border-[var(--ui-border-default)] text-[var(--ui-text-primary)] placeholder:text-[var(--ui-text-muted)]",
                            validationResult?.valid && "border-status-success",
                            validationResult?.valid === false &&
                              validationAttempted &&
                              "border-status-error"
                          )}
                        />
                        {validationLoading && (
                          <div className="flex items-center gap-2 text-xs text-[var(--ui-text-muted)]">
                            <CircleNotch className="size-3 animate-spin" />
                            Validating…
                          </div>
                        )}
                        {validationAttempted &&
                          !validationLoading &&
                          validationResult && (
                            <div
                              className={cn(
                                "text-xs flex items-start gap-2",
                                validationResult.valid
                                  ? "text-status-success"
                                  : "text-status-error"
                              )}
                            >
                              {validationResult.valid ? (
                                <>
                                  <Check size={14} />
                                  <span>
                                    {validationResult.model?.description ||
                                      "Model ID valid"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Warning size={14} />
                                  <span>
                                    {validationResult.message ||
                                      "Invalid model ID"}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        {validationResult?.suggested &&
                          validationResult.suggested.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {validationResult.suggested
                                .slice(0, 5)
                                .map((suggestion) => (
                                  <button
                                    key={suggestion}
                                    type="button"
                                    className="inline-flex items-center rounded px-2 py-0.5 text-xs border border-[var(--ui-border-default)] text-[var(--ui-text-secondary)] bg-[var(--surface-panel)] hover:bg-[var(--surface-hover)] transition-colors"
                                    onClick={() => {
                                      setFreeformInput(suggestion);
                                      setValidationAttempted(false);
                                    }}
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                            </div>
                          )}
                        <Button
                          onClick={handleConfirmCustom}
                          disabled={!validationResult?.valid || validationLoading}
                          style={{
                            background: "var(--accent-chat)",
                            color: "var(--ui-text-inverse)",
                          }}
                          className="w-full hover:opacity-90"
                        >
                          Use Custom Model
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-[var(--ui-border-default)] px-4 py-3">
            {multiSelect ? (
              <>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-[var(--ui-text-secondary)]">
                    {selectedProviderIds.size} provider
                    {selectedProviderIds.size === 1 ? "" : "s"} selected
                  </span>
                  {usageLine && (
                    <span
                      className="hidden sm:block text-[11px] text-[var(--ui-text-muted)] truncate"
                      title="Real usage this reporting period"
                    >
                      {usageLine}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onCancel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                        onCancel();
                      }}
                      className="border-[var(--ui-border-default)] text-[var(--ui-text-primary)] hover:bg-[var(--surface-hover)]"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProviderIds(new Set())}
                    disabled={selectedProviderIds.size === 0}
                    className="text-xs text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--surface-hover)]"
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    disabled={selectedProviderIds.size === 0}
                    onClick={handleUseSelected}
                    style={{
                      background: "var(--accent-chat)",
                      color: "var(--ui-text-inverse)",
                    }}
                    className="hover:opacity-90"
                  >
                    Use selected
                  </Button>
                </div>
              </>
            ) : (
              <>
                {onOpenModelLab ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      onOpenModelLab();
                    }}
                    className="gap-1.5 h-8 text-xs text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--surface-hover)]"
                  >
                    <Flask size={14} />
                    Model Lab
                  </Button>
                ) : (
                  <span />
                )}
                {usageLine && (
                  <span
                    className="hidden sm:block flex-1 text-center text-[11px] text-[var(--ui-text-muted)] truncate"
                    title="Real usage this reporting period"
                  >
                    {usageLine}
                  </span>
                )}
                {onCancel && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      onCancel();
                    }}
                    className="border-[var(--ui-border-default)] text-[var(--ui-text-primary)] hover:bg-[var(--surface-hover)]"
                  >
                    Cancel
                  </Button>
                )}
              </>
            )}
          </div>

          {providersError && (
            <div className="px-4 pb-3">
              <div className="flex items-start gap-2 rounded-lg border border-status-error/30 bg-status-error-bg px-3 py-2 text-xs text-status-error">
                <Warning size={14} className="mt-0.5 shrink-0" />
                <span>Failed to load providers. Please try again.</span>
              </div>
            </div>
          )}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export function ModelPicker({
  onSelect,
  onCancel,
  defaultProfileId,
  trigger,
  open,
  onOpenChange,
  onOpenProviderConnect,
  onOpenModelLab,
  multiSelect,
  onSelectMultiple,
}: ModelPickerProps) {
  const { availableModels, selection } = useModelSelection();
  const {
    providers,
    authenticatedProviders,
    providersLoading,
    providersError,
    fetchProviders,
    validationResult,
    validationLoading,
    validateModel,
    realModels,
  } = useModelDiscovery();
  const { summary: usageSummary, refetch: refetchUsageSummary } = useUsageSummary();

  const [prevOpen, setPrevOpen] = useState(open);
  if (open && !prevOpen) {
    setPrevOpen(true);
    fetchProviders();
    refetchUsageSummary();
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  return (
    <ModelPickerUI
      onSelect={onSelect}
      onCancel={onCancel}
      defaultProfileId={defaultProfileId}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      onOpenProviderConnect={onOpenProviderConnect}
      onOpenModelLab={onOpenModelLab}
      availableModels={availableModels}
      providers={providers}
      authenticatedProviders={authenticatedProviders}
      providersLoading={providersLoading}
      providersError={providersError}
      validationResult={validationResult}
      validationLoading={validationLoading}
      validateModel={validateModel}
      selectedModelId={selection?.modelId ?? null}
      usageSummary={usageSummary}
      realModels={realModels}
      multiSelect={multiSelect}
      onSelectMultiple={onSelectMultiple}
    />
  );
}

export default ModelPicker;
