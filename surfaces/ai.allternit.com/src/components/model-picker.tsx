"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { useModelDiscovery } from "@/integration/api-client";
import { useModelSelection } from "@/providers/model-selection-provider";
import { getProviderMeta, getProviderName } from "@/lib/providers/provider-registry";
import { Button } from "@/components/ui/button";
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
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ModelOption } from "@/components/prompt-kit/prompt-model-selector";
import type { ProviderAuthStatus, ModelValidationResult } from "@/integration/api-client";

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

  if (!src || error) {
    return (
      <div
        className="size-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
        style={{
          background: `${meta.color}18`,
          border: `1px solid ${meta.color}40`,
          color: meta.color,
        }}
      >
        {meta.name.charAt(0).toUpperCase()}
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

interface ProviderRowProps {
  providerId: string;
  providerName: string;
  authenticated: boolean;
  expanded: boolean;
  onToggle: () => void;
  modelCount: number;
}

function ProviderRow({
  providerId,
  providerName,
  authenticated,
  expanded,
  onToggle,
  modelCount,
}: ProviderRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
        expanded
          ? "bg-[var(--surface-panel)]"
          : "hover:bg-[var(--surface-hover)]"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <ProviderIcon providerId={providerId} />
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-sm text-[var(--ui-text-primary)] truncate">
            {providerName}
          </span>
          <span className="text-xs text-[var(--ui-text-muted)]">
            {modelCount > 0
              ? `${modelCount} model${modelCount === 1 ? "" : "s"}`
              : authenticated
              ? "Connected"
              : "Not connected"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {authenticated ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-status-success">
            <Check size={10} weight="bold" />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--ui-text-muted)]">
            <Warning size={10} weight="bold" />
            Connect
          </span>
        )}
        <CaretDown
          size={14}
          className={cn(
            "text-[var(--ui-text-muted)] transition-transform",
            expanded && "rotate-180"
          )}
        />
      </div>
    </button>
  );
}

function formatContextWindow(value: number | undefined): string | null {
  if (!value || value <= 0) return null;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ctx`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k ctx`;
  return `${value} ctx`;
}

export interface ModelPickerUIData {
  availableModels: ModelOption[];
  providers: ProviderAuthStatus[];
  authenticatedProviders: ProviderAuthStatus[];
  providersLoading: boolean;
  providersError: Error | null;
  validationResult: ModelValidationResult | null;
  validationLoading: boolean;
  validateModel: (providerId: string, modelId: string) => Promise<ModelValidationResult | null>;
  selectedModelId: string | null;
  initialExpandedProviders?: string[];
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

  useEffect(() => {
    if (!open) {
      setSearch("");
      setFreeformInput("");
      setValidationAttempted(false);
      setCustomExpanded(false);
      setExpandedProviders(new Set());
    }
  }, [open]);

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
    if (authenticatedProviders.length > 0 && !customProviderId && !defaultProfileId) {
      setCustomProviderId(authenticatedProviders[0].provider_id);
    }
  }, [authenticatedProviders, customProviderId, defaultProfileId]);

  const isProviderAuthenticated = useCallback(
    (providerId: string) =>
      authenticatedProviders.some((p) => p.provider_id === providerId),
    [authenticatedProviders]
  );

  const groupedModels = useMemo(() => {
    const map = new Map<string, ModelOption[]>();
    availableModels.forEach((model) => {
      const key = model.providerName || getProviderName(model.providerId || model.provider);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(model);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [availableModels]);

  const providersWithModels = useMemo(() => {
    const ids = new Set<string>();
    availableModels.forEach((m) => {
      ids.add(m.providerId || m.provider || m.providerName || "");
    });
    return ids;
  }, [availableModels]);

  const emptyProviders = useMemo(
    () =>
      providers.filter(
        (p) =>
          p.provider_id &&
          !providersWithModels.has(p.provider_id) &&
          p.provider_id !== "echo"
      ),
    [providers, providersWithModels]
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

  const isLoading = providersLoading;
  const hasModels = availableModels.length > 0;

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

  const hasAnyResults = filteredGroups.length > 0 || filteredEmptyProviders.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="sm:max-w-[720px] p-0 overflow-hidden border-[var(--shell-dialog-border)] bg-[var(--shell-dialog-bg)] text-[var(--ui-text-primary)]"
        style={{
          background: "var(--shell-dialog-bg)",
          borderColor: "var(--shell-dialog-border)",
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
                {filteredGroups.map(([providerName, providerModels]) => {
                  const providerId =
                    providerModels[0]?.providerId ||
                    providerModels[0]?.provider ||
                    providerName;
                  const authenticated = isProviderAuthenticated(providerId);
                  const expanded =
                    expandedProviders.has(providerName) || search.trim().length > 0;
                  return (
                    <Command.Group
                      key={providerName}
                      className="mb-2"
                      heading={undefined}
                    >
                      <ProviderRow
                        providerId={providerId}
                        providerName={providerName}
                        authenticated={authenticated}
                        expanded={expanded}
                        onToggle={() => toggleProvider(providerName)}
                        modelCount={providerModels.length}
                      />
                      {expanded && (
                        <div className="grid gap-0.5 mt-1 pl-4 pr-1">
                          {providerModels.map((model) => {
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
                                      <span className="truncate">{model.description}</span>
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
              </>
            )}
          </Command.List>

          {/* Custom model section */}
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
                    <Robot size={18} className="text-[var(--ui-text-muted)]" />
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
                    <Sparkle size={14} className="text-[var(--accent-chat)]" />
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
                      <SelectContent className="bg-[var(--shell-menu-bg)] border-[var(--shell-menu-border)]">
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
                  {validationAttempted && !validationLoading && validationResult && (
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
                            {validationResult.message || "Invalid model ID"}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  {validationResult?.suggested &&
                    validationResult.suggested.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {validationResult.suggested.slice(0, 5).map((suggestion) => (
                          <Badge
                            key={suggestion}
                            variant="outline"
                            className="cursor-pointer text-xs border-[var(--ui-border-default)] text-[var(--ui-text-secondary)] hover:bg-[var(--surface-hover)]"
                            onClick={() => {
                              setFreeformInput(suggestion);
                              setValidationAttempted(false);
                            }}
                          >
                            {suggestion}
                          </Badge>
                        ))}
                      </div>
                    )}
                  <Button
                    onClick={handleConfirmCustom}
                    disabled={!validationResult?.valid || validationLoading}
                    style={{ background: "var(--accent-chat)", color: "var(--ui-text-inverse)" }}
                    className="w-full hover:opacity-90"
                  >
                    Use Custom Model
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-[var(--ui-border-default)] px-4 py-3">
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
  } = useModelDiscovery();

  const [prevOpen, setPrevOpen] = useState(open);
  if (open && !prevOpen) {
    setPrevOpen(true);
    fetchProviders();
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
    />
  );
}

export default ModelPicker;
