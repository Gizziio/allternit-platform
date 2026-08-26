"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowsClockwise,
  ArrowsLeftRight,
  Brain,
  CheckCircle,
  CircleNotch,
  Cloud,
  ComputerTower,
  Gauge,
  HardDrives,
  MapPin,
  Plus,
  ShieldCheck,
  Trash,
  X,
} from "@phosphor-icons/react";
import { usePlatformAuth, usePlatformUser } from "@/lib/platform-auth-client";
import {
  createHostedRuntime,
  destroyHostedRuntime,
  getHostedEntitlement,
  listHostedRuntimes,
  startHostedRuntime,
  stopHostedRuntime,
  type HostedRuntime,
  type HostedRuntimeEntitlement,
} from "@/lib/hosted-compute";
import {
  inferenceRouterApi,
  PROVIDER_LABELS,
  type RoutedUsageEvent,
} from "@/lib/inference-router";
import { SectionHeading } from "@/components/settings/SectionHeading";
import { EmptyState } from "@/components/settings/EmptyState";
import { SkeletonRow } from "@/components/settings/SkeletonRow";
import { Badge } from "@/components/settings/Badge";
import {
  QUIET_BUTTON_CLASS,
  DESTRUCTIVE_BUTTON_CLASS,
  SETTINGS_SELECT_CLASS,
} from "@/components/settings/buttonStyles";
import { cn } from "@/lib/utils";

const MEMORY_OPTIONS = [512, 1024, 2048, 4096];

function openSettings(section: string) {
  window.dispatchEvent(
    new CustomEvent("allternit:navigate-settings", { detail: { section } }),
  );
}

function formatHours(seconds: number) {
  if (seconds < 3600) return `${Math.max(0, Math.round(seconds / 60))} min`;
  return `${(seconds / 3600).toFixed(seconds < 36_000 ? 1 : 0)} hr`;
}

function formatMemory(memoryMb: number) {
  return memoryMb >= 1024
    ? `${Number((memoryMb / 1024).toFixed(1))} GB`
    : `${memoryMb} MB`;
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safePlanUrl(value?: string) {
  try {
    const url = new URL(value || "https://allternit.com/pricing");
    return url.protocol === "https:" ? url.toString() : "https://allternit.com/pricing";
  } catch {
    return "https://allternit.com/pricing";
  }
}

function ProductCard({
  icon,
  title,
  eyebrow,
  description,
  children,
  active,
}: {
  icon: React.ReactNode;
  title: string;
  eyebrow: string;
  description: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-solid p-4",
        active
          ? "border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.04)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="size-9 shrink-0 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
            {eyebrow}
          </div>
          <div className="text-[14px] font-semibold text-[var(--text-primary)] mt-0.5">
            {title}
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] mt-1 mb-3">
            {description}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}

function RoutedUsageCard() {
  const [events, setEvents] = useState<RoutedUsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await inferenceRouterApi.getUsage(50);
      setEvents(data);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load routed usage");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const byProvider = new Map<string, { input: number; output: number; cache: number; reasoning: number; count: number }>();
    for (const e of events) {
      const current = byProvider.get(e.provider) ?? { input: 0, output: 0, cache: 0, reasoning: 0, count: 0 };
      current.input += e.promptTokens;
      current.output += e.completionTokens;
      current.cache += e.cachedTokens;
      current.reasoning += e.reasoningTokens;
      current.count += 1;
      byProvider.set(e.provider, current);
    }
    return Array.from(byProvider.entries())
      .map(([provider, t]) => ({ provider, ...t, total: t.input + t.output + t.cache + t.reasoning }))
      .sort((a, b) => b.total - a.total);
  }, [events]);

  const recent = useMemo(() => events.slice(0, 5), [events]);

  return (
    <ProductCard
      icon={<ArrowsLeftRight size={18} />}
      eyebrow="Local CLI"
      title="Routed inference"
      description="Usage from local CLI providers such as Codex and Claude Code."
    >
      {loading ? (
        <SkeletonRow lines={2} />
      ) : error ? (
        <div className="text-[11px] text-[var(--status-error)]">{error}</div>
      ) : totals.length === 0 ? (
        <div className="text-[11px] text-[var(--text-tertiary)]">No routed usage yet. Run a test turn in Router settings to see it here.</div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {totals.map((t) => (
              <div key={t.provider} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[11px]">
                <Brain size={12} className="text-[var(--accent-primary)]" />
                <span className="font-medium text-[var(--text-primary)]">{PROVIDER_LABELS[t.provider as keyof typeof PROVIDER_LABELS] ?? t.provider}</span>
                <span className="text-[var(--text-tertiary)]">{t.total.toLocaleString()} tokens · {t.count} turn{t.count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-solid border-[var(--border-subtle)] overflow-hidden">
            <table className="w-full text-[10px]">
              <thead className="bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Provider</th>
                  <th className="px-2 py-1.5 text-right font-medium">Tokens</th>
                  <th className="px-2 py-1.5 text-right font-medium">Latency</th>
                  <th className="px-2 py-1.5 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e) => (
                  <tr key={e.id} className="border-t border-[var(--border-subtle)]">
                    <td className="px-2 py-1.5 text-[var(--text-primary)]">{PROVIDER_LABELS[e.provider as keyof typeof PROVIDER_LABELS] ?? e.provider}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">{(e.promptTokens + e.completionTokens + e.cachedTokens + e.reasoningTokens).toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">{e.latencyMs}ms</td>
                    <td className="px-2 py-1.5 text-right text-[var(--text-tertiary)]">{new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end">
            <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => void load()} disabled={loading}>
              <ArrowsClockwise size={13} /> Refresh
            </button>
          </div>
        </div>
      )}
    </ProductCard>
  );
}

export function ComputeBillingPanel() {
  const { getToken } = usePlatformAuth();
  const { isLoaded, isSignedIn } = usePlatformUser();
  const [entitlement, setEntitlement] = useState<HostedRuntimeEntitlement | null>(null);
  const [runtimes, setRuntimes] = useState<HostedRuntime[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDestroyId, setConfirmDestroyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("My hosted runtime");
  const [createRegion, setCreateRegion] = useState("lax");
  const [createMemoryMb, setCreateMemoryMb] = useState(1024);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setEntitlement(null);
      setRuntimes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("A web account session is required to manage hosted compute.");
      const [nextEntitlement, nextRuntimes] = await Promise.all([
        getHostedEntitlement(token),
        listHostedRuntimes(token),
      ]);
      setEntitlement(nextEntitlement);
      setRuntimes(nextRuntimes);
      const allowedRegions = nextEntitlement.allowedRegions?.length
        ? nextEntitlement.allowedRegions
        : ["lax"];
      setCreateRegion((current) => allowedRegions.includes(current) ? current : allowedRegions[0]);
      const allowedMemory = MEMORY_OPTIONS.filter((value) => value <= nextEntitlement.maxMemoryMb);
      setCreateMemoryMb((current) =>
        allowedMemory.includes(current) ? current : (allowedMemory.at(-1) ?? nextEntitlement.maxMemoryMb),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load hosted compute");
    } finally {
      setLoading(false);
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!runtimes.some((runtime) => ["creating", "starting", "stopping", "destroying"].includes(runtime.status))) return;
    const timer = window.setInterval(() => void load(), 5_000);
    return () => window.clearInterval(timer);
  }, [load, runtimes]);

  const mutate = useCallback(
    async (id: string, action: (token: string) => Promise<unknown>) => {
      setBusyId(id);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("A web account session is required.");
        await action(token);
        setConfirmDestroyId(null);
        await load();
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Hosted runtime action failed");
      } finally {
        setBusyId(null);
      }
    },
    [getToken, load],
  );

  const handleCreate = useCallback(async () => {
    setBusyId("create");
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("A web account session is required.");
      await createHostedRuntime(token, {
        name: createName.trim() || undefined,
        region: createRegion,
        memoryMb: createMemoryMb,
      });
      setShowCreate(false);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to create hosted runtime");
    } finally {
      setBusyId(null);
    }
  }, [createMemoryMb, createName, createRegion, getToken, load]);

  const usagePercent = entitlement?.maxHoursMonthly
    ? Math.min(100, (entitlement.usedSecondsMonthly / (entitlement.maxHoursMonthly * 3600)) * 100)
    : 0;
  const allowedRegions = entitlement?.allowedRegions?.length ? entitlement.allowedRegions : ["lax"];
  const allowedMemory = useMemo(
    () => MEMORY_OPTIONS.filter((value) => value <= (entitlement?.maxMemoryMb ?? 0)),
    [entitlement?.maxMemoryMb],
  );
  const hasCapacity = Boolean(
    entitlement?.canCreateHostedRuntime &&
    entitlement.activeInstances < entitlement.maxHostedRuntimes,
  );

  return (
    <div className="space-y-5">
      <div>
        <SectionHeading className="mb-1">Plans & compute</SectionHeading>
        <p className="text-[12px] text-[var(--text-secondary)] m-0 leading-relaxed">
          Local compute stays the default. Add your own VPS, managed Fly hosting,
          or organization-scoped enterprise BYOC when the workload needs it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <ProductCard
          icon={<ComputerTower size={18} />}
          eyebrow="Included"
          title="Local compute"
          description="Your brain, provider credentials, and local models stay on your computer. Allternit does not meter your machine."
          active
        >
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--status-success)]">
              <CheckCircle size={13} weight="fill" /> Ready
            </span>
            <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => openSettings("models")}>
              Manage models
            </button>
          </div>
        </ProductCard>

        <RoutedUsageCard />

        <ProductCard
          icon={<HardDrives size={18} />}
          eyebrow="Provider-priced"
          title="Your VPS"
          description="Rent from a supported provider or connect a server you already own. The provider bills the server directly."
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-[var(--text-tertiary)]">From provider pricing · no Allternit compute markup</span>
            <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => openSettings("vps")}>
              Buy or connect VPS
            </button>
          </div>
        </ProductCard>

        <ProductCard
          icon={<Cloud size={18} />}
          eyebrow="Paid add-on"
          title="Allternit managed hosting"
          description="A private Fly Machine runs your Gizzi brain and stops after inactivity. Plan limits enforce runtime hours, instance count, memory, and spend."
          active={Boolean(entitlement?.canCreateHostedRuntime)}
        >
          {!isLoaded || loading ? (
            <SkeletonRow lines={3} />
          ) : !isSignedIn ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-solid border-[var(--border-subtle)] px-3 py-2.5">
              <span className="text-[11px] text-[var(--text-secondary)]">Sign in to view plans and manage hosted runtimes.</span>
              <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => openSettings("signin")}>Sign in</button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge>{entitlement?.planDisplayName ?? "Free"}</Badge>
                {entitlement?.canCreateHostedRuntime && (
                  <Badge className="text-[var(--status-success)] bg-[var(--status-success)]/10">Hosted enabled</Badge>
                )}
                {entitlement && (
                  <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
                    {entitlement.activeInstances} / {entitlement.maxHostedRuntimes} runtimes
                  </span>
                )}
              </div>

              {entitlement && entitlement.maxHoursMonthly > 0 && (
                <div className="rounded-lg border border-solid border-[var(--border-subtle)] p-3 mb-3">
                  <div className="flex items-center justify-between gap-3 text-[10px] mb-2">
                    <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]"><Gauge size={12} /> Monthly runtime usage</span>
                    <span className="font-mono text-[var(--text-primary)]">
                      {formatHours(entitlement.usedSecondsMonthly)} / {entitlement.maxHoursMonthly} hr
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--accent-primary)] transition-[width]" style={{ width: `${usagePercent}%` }} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[10px] text-[var(--text-tertiary)] mt-2">
                    <span>{formatHours(entitlement.remainingSecondsMonthly)} remaining</span>
                    <span>${entitlement.estimatedCostUsdMonthly.toFixed(2)} estimated infrastructure</span>
                  </div>
                </div>
              )}

              {runtimes.length === 0 && entitlement?.canCreateHostedRuntime && !showCreate && (
                <div className="rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-4 text-center mb-3">
                  <Cloud size={22} weight="thin" className="mx-auto text-[var(--text-tertiary)] mb-1.5" />
                  <div className="text-[11px] font-medium text-[var(--text-primary)]">No managed runtime yet</div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-1">Create one within this plan's memory, hour, and instance limits.</div>
                </div>
              )}

              {runtimes.length > 0 && (
                <div className="space-y-2 mb-3">
                  {runtimes.map((runtime) => (
                    <div key={runtime.id} className="rounded-lg border border-solid border-[var(--border-subtle)] px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "size-1.5 rounded-full shrink-0",
                          runtime.status === "running" ? "bg-[var(--status-success)]" :
                            runtime.status === "error" ? "bg-[var(--status-error)]" : "bg-[var(--text-tertiary)]",
                        )} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{runtime.name}</div>
                          <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                            {formatMemory(runtime.memoryMb)} · {runtime.region} · idle stop {runtime.idleTimeoutMinutes} min
                            {runtime.stopReason ? ` · ${titleCase(runtime.stopReason)}` : ""}
                          </div>
                        </div>
                        <Badge>{titleCase(runtime.status)}</Badge>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 mt-2">
                        {runtime.status === "stopped" && (
                          <button type="button" className={QUIET_BUTTON_CLASS} disabled={busyId === runtime.id} onClick={() => void mutate(runtime.id, (token) => startHostedRuntime(token, runtime.id))}>
                            {busyId === runtime.id && <CircleNotch size={12} className="animate-spin" />} Start
                          </button>
                        )}
                        {["running", "starting"].includes(runtime.status) && (
                          <button type="button" className={QUIET_BUTTON_CLASS} disabled={busyId === runtime.id} onClick={() => void mutate(runtime.id, (token) => stopHostedRuntime(token, runtime.id))}>
                            {busyId === runtime.id && <CircleNotch size={12} className="animate-spin" />} Stop
                          </button>
                        )}
                        {confirmDestroyId === runtime.id ? (
                          <>
                            <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => setConfirmDestroyId(null)}>Cancel</button>
                            <button type="button" className={DESTRUCTIVE_BUTTON_CLASS} disabled={busyId === runtime.id} onClick={() => void mutate(runtime.id, (token) => destroyHostedRuntime(token, runtime.id))}>
                              Permanently destroy
                            </button>
                          </>
                        ) : (
                          <button type="button" className={DESTRUCTIVE_BUTTON_CLASS} aria-label={`Destroy ${runtime.name}`} disabled={busyId === runtime.id} onClick={() => setConfirmDestroyId(runtime.id)}>
                            <Trash size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showCreate && entitlement && (
                <div className="rounded-lg border border-solid border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/[0.03] p-3 mb-3">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-[12px] font-semibold text-[var(--text-primary)]">Create managed runtime</div>
                    <button type="button" className="p-1 border-none bg-transparent text-[var(--text-tertiary)] cursor-pointer" aria-label="Cancel runtime creation" onClick={() => setShowCreate(false)}><X size={14} /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="sm:col-span-3 text-[10px] text-[var(--text-tertiary)]">
                      Name
                      <input
                        value={createName}
                        maxLength={80}
                        onChange={(event) => setCreateName(event.target.value)}
                        className="mt-1 w-full p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                      />
                    </label>
                    <label className="text-[10px] text-[var(--text-tertiary)]">
                      Region
                      <select value={createRegion} onChange={(event) => setCreateRegion(event.target.value)} className={cn(SETTINGS_SELECT_CLASS, "mt-1 w-full")}>
                        {allowedRegions.map((region) => <option key={region} value={region}>{region}</option>)}
                      </select>
                    </label>
                    <label className="text-[10px] text-[var(--text-tertiary)]">
                      Memory
                      <select value={createMemoryMb} onChange={(event) => setCreateMemoryMb(Number(event.target.value))} className={cn(SETTINGS_SELECT_CLASS, "mt-1 w-full")}>
                        {allowedMemory.map((memory) => <option key={memory} value={memory}>{formatMemory(memory)}</option>)}
                      </select>
                    </label>
                    <div className="flex items-end">
                      <button type="button" className={cn(QUIET_BUTTON_CLASS, "w-full justify-center")} disabled={busyId === "create" || !createName.trim()} onClick={() => void handleCreate()}>
                        {busyId === "create" ? <CircleNotch size={13} className="animate-spin" /> : <Plus size={13} />}
                        Create
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-[var(--text-tertiary)]">
                    <MapPin size={11} /> Private Fly Machine · no public ports · auto-stop after {entitlement.idleTimeoutMinutes} minutes idle
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 flex-wrap">
                <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => void load()} disabled={loading}>
                  <ArrowsClockwise size={13} /> Refresh
                </button>
                {hasCapacity ? (
                  <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => setShowCreate(true)} disabled={showCreate || busyId === "create"}>
                    <Plus size={13} /> Create runtime
                  </button>
                ) : (
                  <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => window.open(safePlanUrl(entitlement?.upgradeUrl), "_blank", "noopener,noreferrer")}>
                    View hosting plans
                  </button>
                )}
                {entitlement?.billingPortalUrl && (
                  <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => window.open(safePlanUrl(entitlement.billingPortalUrl), "_blank", "noopener,noreferrer")}>Billing portal</button>
                )}
              </div>
            </>
          )}
        </ProductCard>

        <ProductCard
          icon={<ShieldCheck size={18} />}
          eyebrow="Enterprise · metered"
          title="Bring your own cloud"
          description="Run isolated workloads in your AWS, Google Cloud, or Azure account. Your provider charges infrastructure; Allternit meters the enterprise platform service."
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-[var(--text-tertiary)]">Organization admin access required</span>
            <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => openSettings("cloud-credentials")}>Manage enterprise BYOC</button>
          </div>
        </ProductCard>
      </div>

      {error && (
        <EmptyState icon={<Cloud size={28} />} title="Hosted compute unavailable" caption={error} ctaLabel="Retry" onCtaClick={() => void load()} />
      )}
    </div>
  );
}

export default ComputeBillingPanel;
