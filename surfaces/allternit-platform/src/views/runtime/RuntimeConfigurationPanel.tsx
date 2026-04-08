"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Warning,
  Stack,
  CheckCircle,
  Cpu,
  Gauge,
  GitBranch,
  ClockCounterClockwise,
  CircleNotch,
  ArrowsClockwise,
  ArrowCounterClockwise,
  Shield,
  Sparkle,
} from '@phosphor-icons/react';
import {
  useRuntimeSettings,
  type RuntimeDriverRecord,
  type RuntimeDriverType,
  type RuntimeIsolationLevel,
  type RuntimeReplayCaptureLevel,
  type RuntimeSettings,
  type RuntimeSettingsPatch,
} from "@/hooks/useRuntimeSettings";
import { StatusBadge } from "../components/StatusBadge";

type RuntimeManagementView =
  | "native-agent"
  | "runtime-ops"
  | "budget-dashboard"
  | "replay-manager"
  | "prewarm-manager";

interface RuntimeConfigurationPanelProps {
  settings: RuntimeSettings | null;
  drivers: RuntimeDriverRecord[];
  isLoading?: boolean;
  isSaving?: boolean;
  isResetting?: boolean;
  isActivatingDriver?: boolean;
  error?: Error | null;
  onRefresh?: () => Promise<void> | void;
  onUpdateSettings?: (patch: RuntimeSettingsPatch) => Promise<unknown> | void;
  onResetSettings?: () => Promise<unknown> | void;
  onActivateDriver?: (driverType: RuntimeDriverType) => Promise<unknown> | void;
  showManagementLinks?: boolean;
  onOpenView?: (viewType: RuntimeManagementView) => void;
  compact?: boolean;
}

interface ConnectedRuntimeConfigurationPanelProps {
  showManagementLinks?: boolean;
  onOpenView?: (viewType: RuntimeManagementView) => void;
  compact?: boolean;
}

function driverBadgeStatus(
  driver: RuntimeDriverRecord,
): "success" | "warning" | "failed" | "pending" {
  if (driver.isActive && driver.available && driver.statusInfo?.healthy) {
    return "success";
  }

  if (driver.isActive && driver.available) {
    return "warning";
  }

  if (!driver.available) {
    return "failed";
  }

  return "pending";
}

function isolationTone(level: RuntimeIsolationLevel): string {
  if (level === "maximum") {
    return "text-emerald-200";
  }

  if (level === "standard" || level === "hardened") {
    return "text-sky-200";
  }

  return "text-amber-200";
}

function parseWarmupCommands(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function ManagementLink({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-left transition hover:bg-black/25 disabled:cursor-default disabled:opacity-70"
    >
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

export function RuntimeConfigurationPanel({
  settings,
  drivers,
  isLoading = false,
  isSaving = false,
  isResetting = false,
  isActivatingDriver = false,
  error = null,
  onRefresh,
  onUpdateSettings,
  onResetSettings,
  onActivateDriver,
  showManagementLinks = false,
  onOpenView,
  compact = false,
}: RuntimeConfigurationPanelProps) {
  const [draftSettings, setDraftSettings] = useState<RuntimeSettings | null>(null);
  const [warmupCommandsDraft, setWarmupCommandsDraft] = useState("");

  useEffect(() => {
    if (!settings) {
      return;
    }

    setDraftSettings(settings);
    setWarmupCommandsDraft(settings.prewarm.warmup_commands.join("\n"));
  }, [settings]);

  const activeDriver = useMemo(
    () => drivers.find((driver) => driver.isActive) ?? null,
    [drivers],
  );

  const handleSave = async () => {
    if (!draftSettings || !onUpdateSettings) {
      return;
    }

    await onUpdateSettings({
      driver: draftSettings.driver,
      resources: draftSettings.resources,
      replay: draftSettings.replay,
      prewarm: {
        ...draftSettings.prewarm,
        warmup_commands: parseWarmupCommands(warmupCommandsDraft),
      },
      versioning: draftSettings.versioning,
    });
  };

  const handleReset = async () => {
    await onResetSettings?.();
  };

  if (isLoading && !settings) {
    return (
      <div className="flex h-48 items-center justify-center">
        <CircleNotch className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!draftSettings) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 px-4 py-6 text-sm text-muted-foreground">
        Runtime settings are not available yet.
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${compact ? "text-sm" : ""}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <Stack className="h-5 w-5 text-amber-200" />
            <h3 className="text-lg font-medium text-foreground">
              Active Driver Fabric
            </h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            These controls now use the live runtime settings and driver routes,
            not placeholder overlay state. Global agent mode lives in Runtime
            Ops above; session-level work stays in Agent Sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onRefresh?.()}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-foreground transition hover:bg-black/25"
          >
            <ArrowsClockwise className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={isResetting}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-foreground transition hover:bg-black/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResetting ? (
              <ArrowsClockwise className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowCounterClockwise size={16} />
            )}
            Reset defaults
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <ArrowsClockwise className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle size={16} />
            )}
            Save runtime settings
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          {error.message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        {drivers.map((driver) => (
          <div
            key={driver.driver_type}
            className={`rounded-3xl border p-4 transition ${
              driver.isActive
                ? "border-amber-300/30 bg-amber-300/10"
                : "border-white/10 bg-black/10"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium uppercase tracking-[0.18em] text-foreground">
                  {driver.driver_type}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{driver.name}</p>
              </div>
              <StatusBadge
                status={driverBadgeStatus(driver)}
                text={driver.isActive ? "Active" : driver.statusInfo?.status ?? "idle"}
              />
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              {driver.description}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <div className="rounded-2xl border border-white/5 bg-black/10 px-3 py-3">
                <div>Isolation</div>
                <div className={`mt-2 text-sm font-medium ${isolationTone(driver.isolation)}`}>
                  {driver.isolation}
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/10 px-3 py-3">
                <div>Instances</div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {driver.statusInfo?.active_instances ?? 0}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {driver.recommended ? "Recommended for hardened work" : "Available for current lane"}
              </div>
              <button
                type="button"
                onClick={() => void onActivateDriver?.(driver.driver_type)}
                disabled={!driver.available || driver.isActive || isActivatingDriver}
                className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-foreground transition hover:bg-black/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {driver.available ? "Activate" : "Unavailable"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={`grid gap-6 ${compact ? "xl:grid-cols-1" : "xl:grid-cols-[1.1fr_0.9fr]"}`}>
        <div className="rounded-3xl border border-white/5 bg-black/10 p-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-sky-200" />
            <h4 className="text-base font-medium text-foreground">
              Driver Envelope
            </h4>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
              Driver isolation
              <select
                value={draftSettings.driver.isolation_level}
                onChange={(event) =>
                  setDraftSettings((current) =>
                    current
                      ? {
                          ...current,
                          driver: {
                            ...current.driver,
                            isolation_level: event.target.value as RuntimeIsolationLevel,
                          },
                        }
                      : current,
                  )
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-foreground outline-none transition focus:border-sky-300/40 focus:bg-black/30"
              >
                <option value="limited">Limited</option>
                <option value="standard">Standard</option>
                <option value="hardened">Hardened</option>
                <option value="maximum">Maximum</option>
              </select>
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-foreground">
              <span>Driver enabled</span>
              <input
                aria-label="Driver enabled"
                type="checkbox"
                checked={draftSettings.driver.enabled}
                onChange={(event) =>
                  setDraftSettings((current) =>
                    current
                      ? {
                          ...current,
                          driver: {
                            ...current.driver,
                            enabled: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>
          </div>

          <div className="mt-5 space-y-5">
            <label className="block text-sm text-muted-foreground">
              CPU budget
              <input
                aria-label="CPU budget"
                type="range"
                min={100}
                max={32000}
                step={100}
                value={draftSettings.resources.cpu_millicores}
                onChange={(event) =>
                  setDraftSettings((current) =>
                    current
                      ? {
                          ...current,
                          resources: {
                            ...current.resources,
                            cpu_millicores: Number(event.target.value),
                          },
                        }
                      : current,
                  )
                }
                className="mt-3 w-full accent-[var(--accent)]"
              />
              <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <span>100m</span>
                <span>{draftSettings.resources.cpu_millicores}m</span>
                <span>32000m</span>
              </div>
            </label>

            <label className="block text-sm text-muted-foreground">
              Memory budget
              <input
                aria-label="Memory budget"
                type="range"
                min={64}
                max={32768}
                step={64}
                value={draftSettings.resources.memory_mib}
                onChange={(event) =>
                  setDraftSettings((current) =>
                    current
                      ? {
                          ...current,
                          resources: {
                            ...current.resources,
                            memory_mib: Number(event.target.value),
                          },
                        }
                      : current,
                  )
                }
                className="mt-3 w-full accent-[var(--accent)]"
              />
              <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <span>64 MiB</span>
                <span>{draftSettings.resources.memory_mib} MiB</span>
                <span>32768 MiB</span>
              </div>
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-white/5 bg-black/10 px-4 py-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground">
              <Shield className="h-4 w-4 text-amber-200" />
              <span className="font-medium">Active driver</span>
            </div>
            <p className="mt-2">
              {activeDriver
                ? `${activeDriver.name} is currently selected with ${activeDriver.statusInfo?.status ?? "unknown"} health.`
                : "No runtime driver is active yet."}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/5 bg-black/10 p-5">
          <div className="flex items-center gap-2">
            <ClockCounterClockwise className="h-5 w-5 text-amber-200" />
            <h4 className="text-base font-medium text-foreground">
              Replay, Prewarm, and Versioning
            </h4>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <div className="mb-3 text-sm font-medium text-foreground">
                Replay capture level
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["none", "minimal", "full"] as RuntimeReplayCaptureLevel[]).map(
                  (level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() =>
                        setDraftSettings((current) =>
                          current
                            ? {
                                ...current,
                                replay: {
                                  ...current.replay,
                                  capture_level: level,
                                },
                              }
                            : current,
                        )
                      }
                      className={`rounded-2xl border px-3 py-3 text-sm uppercase tracking-[0.16em] transition ${
                        draftSettings.replay.capture_level === level
                          ? "border-amber-300/30 bg-amber-300/10 text-foreground"
                          : "border-white/10 bg-black/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {level}
                    </button>
                  ),
                )}
              </div>
            </div>

            <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-foreground">
              <span>Deterministic replay</span>
              <input
                aria-label="Deterministic replay"
                type="checkbox"
                checked={draftSettings.replay.deterministic_mode}
                onChange={(event) =>
                  setDraftSettings((current) =>
                    current
                      ? {
                          ...current,
                          replay: {
                            ...current.replay,
                            deterministic_mode: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>

            <label className="block text-sm text-muted-foreground">
              Snapshot interval (seconds)
              <input
                aria-label="Snapshot interval seconds"
                type="number"
                min={10}
                max={600}
                step={10}
                value={draftSettings.replay.snapshot_interval_seconds}
                onChange={(event) =>
                  setDraftSettings((current) =>
                    current
                      ? {
                          ...current,
                          replay: {
                            ...current.replay,
                            snapshot_interval_seconds: Number(event.target.value),
                          },
                        }
                      : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-foreground outline-none transition focus:border-amber-300/40 focus:bg-black/30"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-foreground">
              <span>Enable prewarm lane</span>
              <input
                aria-label="Enable prewarm lane"
                type="checkbox"
                checked={draftSettings.prewarm.enabled}
                onChange={(event) =>
                  setDraftSettings((current) =>
                    current
                      ? {
                          ...current,
                          prewarm: {
                            ...current.prewarm,
                            enabled: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-muted-foreground">
                Target pool size
                <input
                  aria-label="Target pool size"
                  type="number"
                  min={1}
                  max={12}
                  step={1}
                  value={draftSettings.prewarm.pool_size}
                  onChange={(event) =>
                    setDraftSettings((current) =>
                      current
                        ? {
                            ...current,
                            prewarm: {
                              ...current.prewarm,
                              pool_size: Number(event.target.value),
                            },
                          }
                        : current,
                    )
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-foreground outline-none transition focus:border-amber-300/40 focus:bg-black/30"
                />
              </label>

              <label className="block text-sm text-muted-foreground">
                Branch prefix
                <input
                  aria-label="Branch prefix"
                  type="text"
                  value={draftSettings.versioning.branch_prefix}
                  onChange={(event) =>
                    setDraftSettings((current) =>
                      current
                        ? {
                            ...current,
                            versioning: {
                              ...current.versioning,
                              branch_prefix: event.target.value,
                            },
                          }
                        : current,
                    )
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-foreground outline-none transition focus:border-amber-300/40 focus:bg-black/30"
                />
              </label>
            </div>

            <label className="block text-sm text-muted-foreground">
              Warmup commands
              <textarea
                aria-label="Warmup commands"
                value={warmupCommandsDraft}
                onChange={(event) => setWarmupCommandsDraft(event.target.value)}
                className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-foreground outline-none transition focus:border-amber-300/40 focus:bg-black/30"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-foreground">
              <span>Auto commit receipts</span>
              <input
                aria-label="Auto commit receipts"
                type="checkbox"
                checked={draftSettings.versioning.auto_commit}
                onChange={(event) =>
                  setDraftSettings((current) =>
                    current
                      ? {
                          ...current,
                          versioning: {
                            ...current.versioning,
                            auto_commit: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>

            <label className="block text-sm text-muted-foreground">
              Commit message template
              <input
                aria-label="Commit message template"
                type="text"
                value={draftSettings.versioning.commit_message_template}
                onChange={(event) =>
                  setDraftSettings((current) =>
                    current
                      ? {
                          ...current,
                          versioning: {
                            ...current.versioning,
                            commit_message_template: event.target.value,
                          },
                        }
                      : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-foreground outline-none transition focus:border-amber-300/40 focus:bg-black/30"
              />
            </label>
          </div>
        </div>
      </div>

      {showManagementLinks ? (
        <div className="rounded-3xl border border-white/5 bg-black/10 p-5">
          <div className="flex items-center gap-2">
            <Sparkle className="h-5 w-5 text-sky-200" />
            <h4 className="text-base font-medium text-foreground">
              Runtime Navigation
            </h4>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <ManagementLink
              label="Agent Sessions"
              description="Open session briefs, notes, and conversation state."
              onClick={onOpenView ? () => onOpenView("native-agent") : undefined}
            />
            <ManagementLink
              label="Runtime Ops"
              description="Open the full runtime command deck."
              onClick={onOpenView ? () => onOpenView("runtime-ops") : undefined}
            />
            <ManagementLink
              label="Budget"
              description="Inspect live pressure and quota posture."
              onClick={
                onOpenView ? () => onOpenView("budget-dashboard") : undefined
              }
            />
            <ManagementLink
              label="Replay"
              description="Review captured runs and launch replays."
              onClick={
                onOpenView ? () => onOpenView("replay-manager") : undefined
              }
            />
            <ManagementLink
              label="Prewarm"
              description="Tune shared warm capacity and warmup behavior."
              onClick={
                onOpenView ? () => onOpenView("prewarm-manager") : undefined
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ConnectedRuntimeConfigurationPanel({
  showManagementLinks = false,
  onOpenView,
  compact = false,
}: ConnectedRuntimeConfigurationPanelProps) {
  const {
    settings,
    drivers,
    isLoading,
    isSaving,
    isResetting,
    isActivatingDriver,
    error,
    refetch,
    updateSettings,
    resetSettings,
    activateDriver,
  } = useRuntimeSettings();

  return (
    <RuntimeConfigurationPanel
      settings={settings}
      drivers={drivers}
      isLoading={isLoading}
      isSaving={isSaving}
      isResetting={isResetting}
      isActivatingDriver={isActivatingDriver}
      error={error}
      onRefresh={refetch}
      onUpdateSettings={updateSettings}
      onResetSettings={resetSettings}
      onActivateDriver={activateDriver}
      showManagementLinks={showManagementLinks}
      onOpenView={onOpenView}
      compact={compact}
    />
  );
}

export default ConnectedRuntimeConfigurationPanel;
