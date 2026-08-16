"use client";

import React from "react";
import {
  Lightning,
  Key,
  Plugs,
  Warning,
  CheckCircle,
  Lock,
  Plus,
  ComputerTower,
  Globe,
  Terminal,
  Desktop,
  FileCode,
  SquaresFour,
} from "@phosphor-icons/react";
import type { SurfacePalette, ResolvedEnvEntry } from "./context-strip.types";
import type { Agent } from "@/lib/agents/agent.types";

interface RuntimeDrawerProps {
  runtimeEnv?: Record<string, string>;
  runtimeEnvEntries?: ResolvedEnvEntry[];
  connectorBindings?: Array<{
    provider?: string;
    label?: string;
    capabilities?: string[];
    autonomous?: boolean;
  }>;
  secretRefs?: Array<{
    name?: string;
    key?: string;
    required?: boolean;
    description?: string;
  }>;
  missingRuntimeKeys?: string[];
  palette: SurfacePalette;
  botId?: string;
  vmOperator?: Agent['vmOperator'];
  vmSandbox?: { id: string; provider: string; status: string; vncUrl?: string };
  onEditRuntime?: () => void;
}

function maskValue(value: string): string {
  if (value.length <= 8) return "••••••";
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

function sourceIcon(source: ResolvedEnvEntry["source"]) {
  switch (source) {
    case "harness":
      return Lightning;
    case "secret":
      return Key;
    case "connector":
      return Plugs;
    default:
      return Lock;
  }
}

function sourceLabel(source: ResolvedEnvEntry["source"]) {
  switch (source) {
    case "harness":
      return "Harness";
    case "secret":
      return "Secret";
    case "connector":
      return "Connector";
    default:
      return "Runtime";
  }
}

export function RuntimeDrawer({
  runtimeEnv,
  runtimeEnvEntries,
  connectorBindings,
  secretRefs,
  missingRuntimeKeys,
  palette,
  botId,
  vmOperator,
  vmSandbox,
  onEditRuntime,
}: RuntimeDrawerProps) {
  const entries: ResolvedEnvEntry[] = React.useMemo(() => {
    if (runtimeEnvEntries?.length) return runtimeEnvEntries;
    if (!runtimeEnv) return [];
    return Object.entries(runtimeEnv).map(([key, value]) => ({
      key,
      value,
      source: "runtime" as const,
    }));
  }, [runtimeEnv, runtimeEnvEntries]);

  const hasMissing = (missingRuntimeKeys?.length ?? 0) > 0;
  const canEdit = Boolean(botId && onEditRuntime);

  return (
    <div className="space-y-4">
      {hasMissing && (
        <div className="rounded-xl border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 p-3 flex items-start gap-3">
          <Warning size={18} className="text-[var(--status-error)] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[var(--status-error)]">
              Missing runtime keys
            </div>
            <div className="text-[12px] text-[var(--text-secondary)]">
              {missingRuntimeKeys!.join(", ")}
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={onEditRuntime}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--status-error)]/40 text-[var(--status-error)] text-[11px] font-semibold hover:bg-[var(--status-error)]/10 transition-colors"
            >
              <Key size={12} />
              Add secrets
            </button>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Lightning size={14} style={{ color: palette.accent }} />
            Runtime Environment ({entries.length})
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={onEditRuntime}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] font-medium hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors"
            >
              <Plus size={12} />
              Add
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-center">
            <div className="text-[12px] text-[var(--text-secondary)]">
              No env vars injected.
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              Add secrets, connectors, or harness config to give this bot runtime access.
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={onEditRuntime}
                className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: palette.accent }}
              >
                <Plus size={12} weight="bold" />
                Add connector / secret
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {entries.map((entry) => {
              const Icon = sourceIcon(entry.source);
              return (
                <div
                  key={entry.key}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={14} style={{ color: palette.accent }} />
                    <span className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                      {entry.key}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-tertiary)] uppercase">
                      {sourceLabel(entry.source)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] text-[var(--text-tertiary)] font-mono">
                      {maskValue(entry.value)}
                    </span>
                    <CheckCircle size={14} className="text-[var(--status-success)]" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Plugs size={14} style={{ color: palette.accent }} />
              Connectors ({connectorBindings?.length ?? 0})
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={onEditRuntime}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] font-medium hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors"
              >
                <Plus size={12} />
                Add
              </button>
            )}
          </div>
          {connectorBindings?.length ? (
            <div className="space-y-2">
              {connectorBindings.map((binding, idx) => (
                <div
                  key={`${binding.provider}-${idx}`}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2"
                >
                  <div className="text-[12px] font-medium text-[var(--text-primary)]">
                    {binding.label || binding.provider}
                  </div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">
                    {binding.capabilities?.join(", ") || "autonomous"}
                    {binding.autonomous ? " • auto" : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-[var(--text-tertiary)] py-2">
              No connectors bound.
              {canEdit && (
                <button
                  type="button"
                  onClick={onEditRuntime}
                  className="ml-1 text-[var(--palette-accent)] hover:underline"
                  style={{ color: palette.accent }}
                >
                  Add one
                </button>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Key size={14} style={{ color: palette.accent }} />
              Secrets ({secretRefs?.length ?? 0})
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={onEditRuntime}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] font-medium hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors"
              >
                <Plus size={12} />
                Add
              </button>
            )}
          </div>
          {secretRefs?.length ? (
            <div className="space-y-2">
              {secretRefs.map((secret, idx) => {
                const isMissing = missingRuntimeKeys?.includes(secret.key ?? "");
                return (
                  <div
                    key={`${secret.key}-${idx}`}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-[12px] font-medium text-[var(--text-primary)]">
                        {secret.name || secret.key}
                      </div>
                      {isMissing && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--status-error)]/10 text-[var(--status-error)]">
                          missing
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                      {secret.key}
                      {secret.required ? " • required" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[12px] text-[var(--text-tertiary)] py-2">
              No secrets declared.
              {canEdit && (
                <button
                  type="button"
                  onClick={onEditRuntime}
                  className="ml-1 hover:underline"
                  style={{ color: palette.accent }}
                >
                  Add one
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {vmOperator?.enabled && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <ComputerTower size={14} style={{ color: palette.accent }} />
              Virtual Computer
            </div>
            {vmSandbox?.status === 'running' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--status-success)]">
                <span className="size-1.5 rounded-full bg-[var(--status-success)] animate-pulse" />
                Running
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--text-secondary)]">Provider</span>
              <span className="text-[var(--text-primary)] font-medium capitalize">{vmOperator.provider}</span>
            </div>
            {vmOperator.image && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--text-secondary)]">Image</span>
                <span className="text-[var(--text-primary)] font-medium truncate max-w-[240px]">{vmOperator.image}</span>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {(vmOperator.allowedActions?.length ? vmOperator.allowedActions : ['command']).map((action) => {
                const icons: Record<string, React.ElementType> = {
                  command: Terminal,
                  browser: Globe,
                  file: FileCode,
                  desktop: Desktop,
                  code: SquaresFour,
                };
                const Icon = icons[action] || Terminal;
                return (
                  <span
                    key={action}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                  >
                    <Icon size={10} />
                    <span className="capitalize">{action}</span>
                  </span>
                );
              })}
            </div>
            {vmSandbox && (
              <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
                <div className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Active sandbox</div>
                <div className="text-[12px] font-mono text-[var(--text-secondary)] truncate">{vmSandbox.id}</div>
                {vmSandbox.vncUrl && (
                  <a
                    href={vmSandbox.vncUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[var(--accent-primary)] hover:underline mt-0.5 inline-block"
                  >
                    Open VNC
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
