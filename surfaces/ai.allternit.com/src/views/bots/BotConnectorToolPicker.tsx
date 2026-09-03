"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  Plugs,
  MagnifyingGlass,
  CaretDown,
  CaretRight,
  Warning,
  Spinner,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getConnectorCatalogProvider,
  getConnectorToolRef,
  type ConnectorCatalogAction,
  type ConnectorCatalogProvider,
} from "@/lib/connectors/connector-catalog.service";
import { createModuleLogger } from "@/lib/logger";

const logger = createModuleLogger('BotConnectorToolPicker');

interface BotConnectorToolPickerProps {
  /** Bot id used for binding context. */
  botId: string;
  /** Currently selected connector tool refs. */
  selectedRefs: string[];
  /** Called when the selected tool refs change. */
  onChange: (refs: string[]) => void;
  className?: string;
}

interface ProviderWithActions extends ConnectorCatalogProvider {
  actions: ConnectorCatalogAction[];
  expanded: boolean;
  loading: boolean;
  error?: string;
}

export function BotConnectorToolPicker({
  botId,
  selectedRefs,
  onChange,
  className,
}: BotConnectorToolPickerProps) {
  const [providers, setProviders] = useState<ProviderWithActions[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load providers from the open-connector catalog on mount.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { listConnectorCatalogProviders } = await import(
          "@/lib/connectors/connector-catalog.service"
        );
        const catalog = await listConnectorCatalogProviders();
        if (cancelled) return;

        setProviders(
          catalog.map((p): ProviderWithActions => ({
            ...p,
            actions: p.actions ?? [],
            expanded: false,
            loading: false,
          })),
        );
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        logger.error({ err, botId }, 'Failed to load connector catalog');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [botId]);

  const toggleProvider = async (service: string) => {
    setProviders((prev) => {
      const next = [...prev];
      const idx = next.findIndex((p) => p.service === service);
      if (idx === -1) return prev;

      const provider = { ...next[idx], expanded: !next[idx].expanded };
      next[idx] = provider;

      if (provider.expanded && provider.actions.length === 0 && !provider.loading) {
        provider.loading = true;
        // Load actions asynchronously after state update.
        getConnectorCatalogProvider(service)
          .then((detail) => {
            setProviders((current) => {
              const cur = [...current];
              const curIdx = cur.findIndex((p) => p.service === service);
              if (curIdx === -1) return current;
              cur[curIdx] = {
                ...cur[curIdx],
                loading: false,
                actions: detail?.actions ?? [],
                error: detail ? undefined : 'No actions available for this provider',
              };
              return cur;
            });
          })
          .catch((err) => {
            setProviders((current) => {
              const cur = [...current];
              const curIdx = cur.findIndex((p) => p.service === service);
              if (curIdx === -1) return current;
              cur[curIdx] = {
                ...cur[curIdx],
                loading: false,
                error: err instanceof Error ? err.message : String(err),
              };
              return cur;
            });
          });
      }

      return next;
    });
  };

  const toggleAction = (action: ConnectorCatalogAction) => {
    const ref = getConnectorToolRef(action);
    const next = selectedRefs.includes(ref)
      ? selectedRefs.filter((r) => r !== ref)
      : [...selectedRefs, ref];
    onChange(next);
  };

  const toggleAllProviderActions = (provider: ProviderWithActions) => {
    const refs = provider.actions.map(getConnectorToolRef);
    const allSelected = refs.every((ref) => selectedRefs.includes(ref));
    const next = allSelected
      ? selectedRefs.filter((r) => !refs.includes(r))
      : [...new Set([...selectedRefs, ...refs])];
    onChange(next);
  };

  const filteredProviders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.service.toLowerCase().includes(q) ||
        p.categories.some((c) => c.toLowerCase().includes(q)) ||
        p.actions.some(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q),
        ),
    );
  }, [providers, query]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search connectors and actions…"
            className="pl-9 bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
        <div className="text-[12px] text-[var(--text-secondary)] whitespace-nowrap">
          {selectedRefs.length} selected
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 flex items-start gap-2 text-[12px] text-[var(--text-primary)]">
          <Warning size={16} className="shrink-0 mt-0.5 text-[var(--status-error)]" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-[var(--text-secondary)]">
          <Spinner size={28} className="animate-spin text-[var(--text-tertiary)]" />
          <p className="text-sm">Loading connector catalog…</p>
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          <Plugs size={40} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-40" />
          <p className="text-sm">No connectors match your search.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-auto pr-1">
          {filteredProviders.map((provider) => {
            const refs = provider.actions.map(getConnectorToolRef);
            const selectedCount = refs.filter((ref) => selectedRefs.includes(ref)).length;
            const allSelected = refs.length > 0 && selectedCount === refs.length;
            const someSelected = selectedCount > 0 && !allSelected;

            return (
              <div
                key={provider.service}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleProvider(provider.service)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--surface-hover)] transition-colors"
                >
                  {provider.expanded ? (
                    <CaretDown size={16} className="text-[var(--text-tertiary)]" />
                  ) : (
                    <CaretRight size={16} className="text-[var(--text-tertiary)]" />
                  )}
                  <div className="size-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] text-[12px] font-bold uppercase">
                    {provider.displayName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">
                      {provider.displayName}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {provider.categories.join(', ')} • {provider.actionCount} actions
                    </div>
                  </div>
                  {selectedCount > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                      {selectedCount}
                    </span>
                  )}
                </button>

                {provider.expanded && (
                  <div className="border-t border-[var(--border-subtle)] p-3 space-y-2">
                    {provider.loading ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-[var(--text-secondary)] text-[12px]">
                        <Spinner size={16} className="animate-spin" />
                        Loading actions…
                      </div>
                    ) : provider.error ? (
                      <div className="text-[12px] text-[var(--status-error)] py-2">
                        {provider.error}
                      </div>
                    ) : provider.actions.length === 0 ? (
                      <div className="text-[12px] text-[var(--text-secondary)] py-2">
                        No actions available for this provider.
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between pb-2">
                          <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
                            Actions
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px]"
                            onClick={() => toggleAllProviderActions(provider)}
                          >
                            {allSelected ? 'Deselect all' : 'Select all'}
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {provider.actions.map((action) => {
                            const ref = getConnectorToolRef(action);
                            const selected = selectedRefs.includes(ref);
                            return (
                              <button
                                key={ref}
                                type="button"
                                onClick={() => toggleAction(action)}
                                className={cn(
                                  "flex items-start gap-2 p-2.5 rounded-lg border text-left transition-colors",
                                  selected
                                    ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/5"
                                    : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--surface-hover)]"
                                )}
                              >
                                <div
                                  className={cn(
                                    "size-5 rounded border flex items-center justify-center shrink-0 mt-0.5",
                                    selected
                                      ? "bg-[var(--accent-primary)] border-[var(--accent-primary)]"
                                      : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
                                  )}
                                >
                                  {selected && <Check size={12} className="text-white" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                                    {action.name}
                                  </div>
                                  <div className="text-[11px] text-[var(--text-secondary)] line-clamp-2">
                                    {action.description}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-tertiary)] mt-1 font-mono">
                                    {ref}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
