"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wrench,
  Warning,
  MagnifyingGlass,
  Spinner,
  Plugs,
} from "@phosphor-icons/react";
import type { Agent } from "@/lib/agents/agent.types";
import { updateAgent } from "@/lib/agents/agent.service";
import {
  listConnectorCatalogProviders,
  getConnectorCatalogProvider,
  getConnectorToolRef,
  type ConnectorCatalogAction,
  type ConnectorCatalogProvider,
} from "@/lib/connectors/connector-catalog.service";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ConnectorToolPickerProps {
  bot: Agent;
}

interface ActionGroup {
  provider: ConnectorCatalogProvider;
  actions: ConnectorCatalogAction[];
}

export function ConnectorToolPicker({ bot }: ConnectorToolPickerProps) {
  const [groups, setGroups] = useState<ActionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(bot.allowedTools ?? bot.tools ?? []),
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const providers = await listConnectorCatalogProviders();
        const withActions = await Promise.all(
          providers.map(async (p) => {
            const full = await getConnectorCatalogProvider(p.service);
            return {
              provider: full ?? p,
              actions: full?.actions ?? [],
            };
          }),
        );
        if (cancelled) return;
        setGroups(withActions.filter((g) => g.actions.length > 0));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load tools");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const allActions = useMemo(
    () => groups.flatMap((g) => g.actions),
    [groups],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        provider: g.provider,
        actions: g.actions.filter(
          (a) =>
            a.id.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q) ||
            a.service.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.actions.length > 0);
  }, [groups, query]);

  const toggleTool = useCallback(
    async (ref: string) => {
      const next = new Set(selected);
      if (next.has(ref)) {
        next.delete(ref);
      } else {
        next.add(ref);
      }

      const allowedTools = Array.from(next);
      setSaving(true);
      setError(null);
      try {
        await updateAgent(bot.id, {
          allowedTools,
          tools: allowedTools,
        });
        setSelected(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update tools");
      } finally {
        setSaving(false);
      }
    },
    [bot.id, selected],
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 p-4 text-[13px] text-[var(--status-error)] flex items-start gap-2">
          <Warning size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Wrench size={16} />
            Connector Tools
          </h3>
          <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
            Toggle open-connector actions this bot is allowed to invoke. The
            bot must also have the corresponding app connected.
          </p>
        </div>
        {saving && (
          <span className="text-[12px] text-[var(--text-tertiary)]">
            Saving…
          </span>
        )}
      </div>

      <div className="relative">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${allActions.length} connector actions…`}
          className="pl-9 bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)]"
        />
      </div>

      <div className="min-h-[200px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-[var(--text-secondary)]">
            <Spinner size={28} className="animate-spin text-[var(--text-tertiary)]" />
            <p className="text-sm">Loading connector tools…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            <Plugs size={40} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-40" />
            <p className="text-sm">
              {allActions.length === 0
                ? "No connector tools are available."
                : "No tools match your search."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map((g) => (
              <section key={g.provider.service}>
                <h4 className="flex items-center gap-2 mb-3 px-1 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {g.provider.displayName}
                  <span className="ml-auto text-[11px] normal-case opacity-80">
                    {g.actions.length}
                  </span>
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {g.actions.map((action) => {
                    const ref = getConnectorToolRef(action);
                    const active = selected.has(ref);
                    return (
                      <div
                        key={ref}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border transition-colors",
                          active
                            ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/5"
                            : "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--surface-hover)]",
                        )}
                      >
                        <Switch
                          checked={active}
                          onCheckedChange={() => void toggleTool(ref)}
                          aria-label={`Toggle ${action.name}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-[var(--text-primary)]">
                            {action.name}
                          </div>
                          <div className="text-[12px] text-[var(--text-secondary)] line-clamp-2">
                            {action.description}
                          </div>
                          <code className="text-[11px] text-[var(--text-tertiary)] mt-1 block">
                            {ref}
                          </code>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
