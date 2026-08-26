"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Desktop, Plus, Play, Stop, Trash, Spinner, ArrowsClockwise, Warning } from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { Agent } from "@/lib/agents/agent.types";
import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/design/GlassSurface";
import { StatusBadge } from "@/views/components/StatusBadge";
import {
  listAgents,
  listTemplates,
  getCapacity,
  getUsageSummary,
  listUsage,
  listSandboxes,
  provisionDesktop,
  startDesktop,
  stopDesktop,
  deprovisionDesktop,
  type DesktopTemplate,
  type CapacityStatus,
  type UsageSummary,
  type UsageRow,
  type DesktopSandboxSummary,
  type DesktopCloudApiError,
} from "@/lib/desktop-cloud-api";

interface Loadable<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

function initialLoadable<T>(data: T): Loadable<T> {
  return { data, loading: false, error: null };
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function mapStatus(status: string): "running" | "stopped" | "pending" | "failed" {
  const s = status.toLowerCase();
  if (s === "running") return "running";
  if (s === "stopped") return "stopped";
  if (s === "creating" || s === "starting" || s === "stopping") return "pending";
  return "failed";
}

export function DesktopCloudAdminView(): React.ReactNode {
  // Bots
  const storeAgents = useAgentStore((s) => s.agents);
  const fetchStoreAgents = useAgentStore((s) => s.fetchAgents);

  // Data
  const [agents, setAgents] = useState<Loadable<Agent[]>>(initialLoadable([]));
  const [templates, setTemplates] = useState<Loadable<DesktopTemplate[]>>(initialLoadable([]));
  const [capacity, setCapacity] = useState<Loadable<CapacityStatus>>(initialLoadable({ snapshots: [], scale_up_recommended: false }));
  const [usageSummary, setUsageSummary] = useState<Loadable<UsageSummary>>(initialLoadable({ total_minutes: 0, total_cost: 0, currency: "USD", rows: 0 }));
  const [usageRows, setUsageRows] = useState<Loadable<UsageRow[]>>(initialLoadable([]));
  const [sandboxes, setSandboxes] = useState<Loadable<DesktopSandboxSummary[]>>(initialLoadable([]));

  // Provision form
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [provisioning, setProvisioning] = useState(false);

  // One-shot defaults: prevent auto-selection from clobbering a user choice
  // when a stale loadAgents/loadTemplates closure fires after the select changes.
  const initialBotSetRef = useRef(false);
  const initialTemplateSetRef = useRef(false);

  // Read the live DOM value at provision time so a stale React closure cannot
  // provision the wrong bot/template.
  const botSelectRef = useRef<HTMLSelectElement>(null);
  const templateSelectRef = useRef<HTMLSelectElement>(null);

  // Actions
  const [actingBotId, setActingBotId] = useState<string | null>(null);

  const bots = useMemo(() => {
    // The agent store merges API agents with a local fallback catalog, which
    // can create duplicate display names with different ids. The canonical API
    // list (agents.data) is the source of truth for provisioning, so prefer it
    // and only fall back to the store for name lookups of bots the API no
    // longer returns.
    const byName = new Map<string, Agent>();
    for (const agent of agents.data) byName.set(agent.name, agent);
    for (const agent of storeAgents) {
      if (!byName.has(agent.name)) byName.set(agent.name, agent);
    }
    return Array.from(byName.values());
  }, [storeAgents, agents.data]);

  const setLoading = <T,>(setter: React.Dispatch<React.SetStateAction<Loadable<T>>>, loading: boolean) => {
    setter((prev) => ({ ...prev, loading }));
  };

  const setError = <T,>(setter: React.Dispatch<React.SetStateAction<Loadable<T>>>, error: string | null) => {
    setter((prev) => ({ ...prev, error }));
  };

  const handleApiError = (err: unknown, context: string): string => {
    const message = err instanceof Error ? err.message : String(err);
    return `${context}: ${message}`;
  };

  const loadAgents = useCallback(async () => {
    setLoading(setAgents, true);
    setError(setAgents, null);
    try {
      await fetchStoreAgents();
      const data = await listAgents();
      setAgents({ data, loading: false, error: null });
      if (data.length > 0 && !initialBotSetRef.current) {
        initialBotSetRef.current = true;
        setSelectedBotId(data[0].id);
      }
    } catch (err) {
      setAgents((prev) => ({ ...prev, loading: false, error: handleApiError(err, "Failed to load bots") }));
    }
  }, [fetchStoreAgents]);

  const loadTemplates = useCallback(async () => {
    setLoading(setTemplates, true);
    setError(setTemplates, null);
    try {
      const data = await listTemplates();
      setTemplates({ data, loading: false, error: null });
      if (data.length > 0 && !initialTemplateSetRef.current) {
        initialTemplateSetRef.current = true;
        setSelectedTemplateId(data[0].id);
      }
    } catch (err) {
      setTemplates((prev) => ({ ...prev, loading: false, error: handleApiError(err, "Failed to load templates") }));
    }
  }, []);

  const loadCapacity = useCallback(async () => {
    setLoading(setCapacity, true);
    setError(setCapacity, null);
    try {
      const data = await getCapacity();
      setCapacity({ data, loading: false, error: null });
    } catch (err) {
      const error = handleApiError(err, "Failed to load capacity");
      setCapacity((prev) => ({ ...prev, loading: false, error }));
    }
  }, []);

  const loadUsage = useCallback(async () => {
    setLoading(setUsageSummary, true);
    setLoading(setUsageRows, true);
    setError(setUsageSummary, null);
    setError(setUsageRows, null);
    try {
      const [summary, rows] = await Promise.all([getUsageSummary(), listUsage()]);
      setUsageSummary({ data: summary, loading: false, error: null });
      setUsageRows({ data: rows, loading: false, error: null });
    } catch (err) {
      const error = handleApiError(err, "Failed to load usage");
      setUsageSummary((prev) => ({ ...prev, loading: false, error }));
      setUsageRows((prev) => ({ ...prev, loading: false, error }));
    }
  }, []);

  const loadSandboxes = useCallback(async () => {
    setLoading(setSandboxes, true);
    setError(setSandboxes, null);
    try {
      const data = await listSandboxes();
      setSandboxes({ data, loading: false, error: null });
    } catch (err) {
      setSandboxes((prev) => ({ ...prev, loading: false, error: handleApiError(err, "Failed to load sandboxes") }));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadAgents(), loadTemplates(), loadCapacity(), loadUsage(), loadSandboxes()]);
  }, [loadAgents, loadTemplates, loadCapacity, loadUsage, loadSandboxes]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleProvision = async () => {
    const botId = botSelectRef.current?.value ?? selectedBotId;
    const templateId = templateSelectRef.current?.value ?? selectedTemplateId;
    if (!botId) return;
    setProvisioning(true);
    try {
      await provisionDesktop(botId, templateId || undefined);
      await loadSandboxes();
    } catch (err) {
      setSandboxes((prev) => ({ ...prev, error: handleApiError(err, "Failed to provision desktop") }));
    } finally {
      setProvisioning(false);
    }
  };

  const handleStart = async (botId: string) => {
    setActingBotId(botId);
    try {
      await startDesktop(botId);
      await loadSandboxes();
    } catch (err) {
      setSandboxes((prev) => ({ ...prev, error: handleApiError(err, "Failed to start desktop") }));
    } finally {
      setActingBotId(null);
    }
  };

  const handleStop = async (botId: string) => {
    setActingBotId(botId);
    try {
      await stopDesktop(botId);
      await loadSandboxes();
    } catch (err) {
      setSandboxes((prev) => ({ ...prev, error: handleApiError(err, "Failed to stop desktop") }));
    } finally {
      setActingBotId(null);
    }
  };

  const handleDeprovision = async (botId: string) => {
    setActingBotId(botId);
    try {
      await deprovisionDesktop(botId);
      await loadSandboxes();
    } catch (err) {
      setSandboxes((prev) => ({ ...prev, error: handleApiError(err, "Failed to deprovision desktop") }));
    } finally {
      setActingBotId(null);
    }
  };

  const anyLoading = agents.loading || templates.loading || capacity.loading || usageSummary.loading || sandboxes.loading;
  const anyError = agents.error || templates.error || capacity.error || usageSummary.error || sandboxes.error;

  return (
    <div className="size-full overflow-auto p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              <Desktop size={22} weight="fill" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Desktop Cloud</h1>
              <p className="text-sm text-[var(--ui-text-muted)]">Provision and manage bot desktops</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={anyLoading}>
            {anyLoading ? <Spinner size={16} className="animate-spin" /> : <ArrowsClockwise size={16} />}
            Refresh
          </Button>
        </div>

        {anyError && (
          <GlassSurface intensity="thin" className="flex items-center gap-3 bg-red-500/10 text-sm text-red-300">
            <Warning size={18} />
            {anyError}
          </GlassSurface>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GlassSurface intensity="thin" className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">Templates</div>
            <div className="text-2xl font-bold">{templates.data.length}</div>
          </GlassSurface>
          <GlassSurface intensity="thin" className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">Sandboxes</div>
            <div className="text-2xl font-bold">{sandboxes.data.length}</div>
          </GlassSurface>
          <GlassSurface intensity="thin" className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">Usage</div>
            <div className="text-2xl font-bold">{formatMinutes(usageSummary.data.total_minutes)}</div>
          </GlassSurface>
          <GlassSurface intensity="thin" className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]">Cost</div>
            <div className="text-2xl font-bold">{formatCurrency(usageSummary.data.total_cost)}</div>
          </GlassSurface>
        </div>

        {/* Provision form */}
        <GlassSurface intensity="base" className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">Provision Desktop</h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-[var(--ui-text-muted)]">Bot</label>
              <select
                ref={botSelectRef}
                aria-label="Bot"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
                value={selectedBotId}
                onChange={(e) => setSelectedBotId(e.target.value)}
              >
                <option value="">Select a bot</option>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>{bot.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-[var(--ui-text-muted)]">Template</label>
              <select
                ref={templateSelectRef}
                aria-label="Template"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="">Default</option>
                {templates.data.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.os})</option>
                ))}
              </select>
            </div>
            <Button onClick={handleProvision} disabled={!selectedBotId || provisioning}>
              {provisioning ? <Spinner size={16} className="animate-spin" /> : <Plus size={16} />}
              Provision
            </Button>
          </div>
        </GlassSurface>

        {/* Sandboxes */}
        <GlassSurface intensity="base" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">Sandboxes</h2>
            {sandboxes.loading && <Spinner size={16} className="animate-spin text-[var(--ui-text-muted)]" />}
          </div>
          {sandboxes.data.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--ui-text-muted)]">
              No desktops provisioned yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="sandboxes-table">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--ui-text-muted)]">
                    <th className="pb-2 font-medium">Bot</th>
                    <th className="pb-2 font-medium">Sandbox</th>
                    <th className="pb-2 font-medium">Provider</th>
                    <th className="pb-2 font-medium">OS</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {sandboxes.data.map((sb) => (
                    <tr key={sb.sandbox_id} className="group">
                      <td className="py-3 font-medium">{bots.find((b) => b.id === sb.bot_id)?.name ?? sb.bot_id}</td>
                      <td className="py-3 font-mono text-xs text-[var(--ui-text-muted)]">{sb.sandbox_id}</td>
                      <td className="py-3 capitalize">{sb.provider}</td>
                      <td className="py-3 capitalize">{sb.os}</td>
                      <td className="py-3">
                        <StatusBadge status={mapStatus(sb.status)} text={sb.status} />
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {sb.status.toLowerCase() !== "running" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStart(sb.bot_id)}
                              disabled={actingBotId === sb.bot_id}
                            >
                              {actingBotId === sb.bot_id ? <Spinner size={14} className="animate-spin" /> : <Play size={14} />}
                              Start
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStop(sb.bot_id)}
                              disabled={actingBotId === sb.bot_id}
                            >
                              {actingBotId === sb.bot_id ? <Spinner size={14} className="animate-spin" /> : <Stop size={14} />}
                              Stop
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeprovision(sb.bot_id)}
                            disabled={actingBotId === sb.bot_id}
                          >
                            {actingBotId === sb.bot_id ? <Spinner size={14} className="animate-spin" /> : <Trash size={14} />}
                            Deprovision
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassSurface>

        {/* Templates */}
        <GlassSurface intensity="base" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">Templates</h2>
            {templates.loading && <Spinner size={16} className="animate-spin text-[var(--ui-text-muted)]" />}
          </div>
          {templates.data.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--ui-text-muted)]">
              No desktop templates found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--ui-text-muted)]">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">OS</th>
                    <th className="pb-2 font-medium">Image</th>
                    <th className="pb-2 font-medium">CPU</th>
                    <th className="pb-2 font-medium">Memory</th>
                    <th className="pb-2 font-medium">Disk</th>
                    <th className="pb-2 font-medium">Network</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {templates.data.map((tpl) => (
                    <tr key={tpl.id}>
                      <td className="py-3 font-medium">{tpl.name}</td>
                      <td className="py-3 capitalize">{tpl.os}</td>
                      <td className="py-3 font-mono text-xs text-[var(--ui-text-muted)]">{tpl.image}</td>
                      <td className="py-3">{(tpl.cpu_millis / 1000).toFixed(1)} cores</td>
                      <td className="py-3">{Math.round(tpl.memory_mib / 1024)} GB</td>
                      <td className="py-3">{Math.round(tpl.disk_mib / 1024)} GB</td>
                      <td className="py-3">{tpl.network_enabled ? "Enabled" : "Disabled"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassSurface>

        {/* Capacity & Usage */}
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassSurface intensity="base" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">Capacity</h2>
              {capacity.loading && <Spinner size={16} className="animate-spin text-[var(--ui-text-muted)]" />}
            </div>
            {capacity.data.snapshots.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--ui-text-muted)]">
                Capacity monitor has no host snapshots yet.
              </div>
            ) : (
              <div className="space-y-3">
                {capacity.data.snapshots.map((snap, idx) => (
                  <div key={idx} className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{snap.provider}</span>
                      <StatusBadge status={snap.healthy ? "success" : "failed"} text={snap.healthy ? "Healthy" : "Unhealthy"} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--ui-text-muted)]">
                      <div>Host: {snap.host}</div>
                      <div>Active: {snap.active_executions}</div>
                      <div>CPU: {snap.available_cpu_millis}/{snap.total_cpu_millis} mCPU</div>
                      <div>Mem: {snap.available_memory_mib}/{snap.total_memory_mib} MiB</div>
                    </div>
                  </div>
                ))}
                {capacity.data.scale_up_recommended && (
                  <div className="rounded-lg bg-yellow-500/10 p-3 text-xs text-yellow-300">
                    Scale-up recommended: {capacity.data.scale_up_reason}
                  </div>
                )}
              </div>
            )}
          </GlassSurface>

          <GlassSurface intensity="base" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">Usage</h2>
              {usageSummary.loading && <Spinner size={16} className="animate-spin text-[var(--ui-text-muted)]" />}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <div className="text-xs text-[var(--ui-text-muted)]">Total Minutes</div>
                <div className="text-xl font-bold">{formatMinutes(usageSummary.data.total_minutes)}</div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <div className="text-xs text-[var(--ui-text-muted)]">Total Cost</div>
                <div className="text-xl font-bold">{formatCurrency(usageSummary.data.total_cost)}</div>
              </div>
            </div>
            {usageRows.data.length === 0 ? (
              <div className="py-4 text-center text-sm text-[var(--ui-text-muted)]">
                No usage records yet.
              </div>
            ) : (
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--ui-text-muted)]">
                      <th className="pb-2 font-medium">Bot</th>
                      <th className="pb-2 font-medium">Provider</th>
                      <th className="pb-2 font-medium">Minutes</th>
                      <th className="pb-2 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {usageRows.data.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2">{bots.find((b) => b.id === row.bot_id)?.name ?? row.bot_id}</td>
                        <td className="py-2 capitalize">{row.provider}</td>
                        <td className="py-2">{row.minutes ?? 0}</td>
                        <td className="py-2 text-right">{formatCurrency(row.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassSurface>
        </div>
      </div>
    </div>
  );
}

export default DesktopCloudAdminView;
