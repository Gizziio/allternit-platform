"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Path, UploadSimple } from "@phosphor-icons/react";
import { api } from "@/integration/api-client";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { Agent } from "@/lib/agents/agent.types";
import {
  isProviderRoutingPin,
  parseOnlyProvidersInput,
  toWireProviderRoutingPin,
  type StoredProviderRoutingPin,
} from "@/lib/agents/provider-routing";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ProviderRoutingCardProps {
  bot: Agent;
  accentColor: string;
}

type SortChoice = "" | "price" | "throughput" | "latency";

type PersistStatus = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

type ExportStatus =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

function readBotPin(bot: Agent): StoredProviderRoutingPin | undefined {
  return isProviderRoutingPin(bot.config?.providerRouting) ? bot.config.providerRouting : undefined;
}

function sortFromPin(pin: StoredProviderRoutingPin | undefined): SortChoice {
  const sort = pin?.sort;
  return sort === "price" || sort === "throughput" || sort === "latency" ? sort : "";
}

/**
 * Per-bot provider routing pin. The pin is stored on the agent record as
 * `config.providerRouting` (`{ model?, sort?, only? }` — the model id is for
 * editing/display only) and sent per chat message as a Hermes provider object
 * with the model key stripped.
 */
export function ProviderRoutingCard({ bot, accentColor }: ProviderRoutingCardProps) {
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const [pin, setPin] = useState<StoredProviderRoutingPin | undefined>(() => readBotPin(bot));
  const [modelInput, setModelInput] = useState(() => (typeof pin?.model === "string" ? pin.model : ""));
  const [sort, setSort] = useState<SortChoice>(() => sortFromPin(pin));
  const [onlyInput, setOnlyInput] = useState(() => (Array.isArray(pin?.only) ? pin.only.join(", ") : ""));
  const [persistStatus, setPersistStatus] = useState<PersistStatus>({ kind: "idle" });
  const [hasPolicy, setHasPolicy] = useState<boolean | null>(null);
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([]);
  const [exportStatus, setExportStatus] = useState<ExportStatus>({ kind: "idle" });

  const enabled = pin !== undefined;
  const hermesAvailable = useMemo(
    () => typeof window !== "undefined" && Boolean(window.allternit?.hermesRouting),
    [],
  );
  const datalistId = useMemo(() => `prov-routing-models-${bot.id}`, [bot.id]);

  // Tenant policy drives the "no policy" hint and the model id suggestions.
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ policy?: unknown }>("/api/v1/gateway/provider-routing")
      .then((res) => {
        if (cancelled) return;
        const policy = isProviderRoutingPin(res?.policy) ? res.policy : undefined;
        setHasPolicy(Boolean(policy && Object.keys(policy).length > 0));
        const models = policy?.models;
        if (isProviderRoutingPin(models)) {
          setModelSuggestions(Object.keys(models));
        }
      })
      .catch(() => {
        if (!cancelled) setHasPolicy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (nextPin: StoredProviderRoutingPin | undefined) => {
    setPin(nextPin);
    setPersistStatus({ kind: "saving" });
    try {
      // The gateway replaces the whole config column — send the merged bag.
      const config: Record<string, unknown> = { ...(bot.config ?? {}) };
      if (nextPin) config.providerRouting = nextPin;
      else delete config.providerRouting;
      await updateAgent(bot.id, { config });
      setPersistStatus({ kind: "saved" });
    } catch (error) {
      setPersistStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to save routing pin",
      });
    }
  };

  const updatePin = (patch: Partial<StoredProviderRoutingPin>) => {
    const base = pin ?? {};
    const next: StoredProviderRoutingPin = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    void persist(next);
  };

  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Re-enable with whatever the record last held, or a fresh pin.
      persist(readBotPin(bot) ?? {});
    } else {
      persist(undefined);
    }
  };

  const handleExport = async () => {
    setExportStatus({ kind: "working" });
    try {
      const response = await api.raw("/api/v1/gateway/provider-routing/export/hermes");
      if (!response.ok) {
        setExportStatus({
          kind: "error",
          message:
            response.status === 404
              ? "No tenant routing policy to export."
              : `Export failed (HTTP ${response.status}).`,
        });
        return;
      }
      const yaml = await response.text();
      const hermes = window.allternit?.hermesRouting;
      if (!hermes) {
        setExportStatus({ kind: "error", message: "Hermes bridge is not available in this app." });
        return;
      }
      const result = await hermes.export(yaml);
      if (result.success) {
        setExportStatus({
          kind: "done",
          message: `Written to ${result.path}${result.backupPath ? ` (backup: ${result.backupPath})` : ""}`,
        });
      } else {
        setExportStatus({ kind: "error", message: result.error || "Hermes export failed." });
      }
    } catch (error) {
      setExportStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Hermes export failed.",
      });
    }
  };

  const wirePreview = toWireProviderRoutingPin(pin);

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="size-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${accentColor} 14%, transparent)` }}
        >
          <Path size={18} style={{ color: accentColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
            Provider routing
          </div>
          <div className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Pin this bot&apos;s requests to specific providers.
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} aria-label="Enable provider routing pin" />
      </div>

      {enabled && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-[12px] font-medium text-[var(--text-secondary)]" htmlFor={`${datalistId}-model`}>
              Model id
            </label>
            <input
              id={`${datalistId}-model`}
              type="text"
              list={modelSuggestions.length > 0 ? datalistId : undefined}
              placeholder="e.g. anthropic/claude-fable-5.1"
              value={modelInput}
              onChange={(e) => {
                setModelInput(e.target.value);
                updatePin({ model: e.target.value.trim() || undefined });
              }}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
            />
            {modelSuggestions.length > 0 && (
              <datalist id={datalistId}>
                {modelSuggestions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            )}
            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
              Display/editing only — model matching on the wire is implicit per request.
            </p>
          </div>

          <div>
            <label className="text-[12px] font-medium text-[var(--text-secondary)]">Sort</label>
            <Select
              value={sort || "unset"}
              onValueChange={(value) => {
                const next: SortChoice = value === "unset" ? "" : (value as SortChoice);
                setSort(next);
                updatePin({ sort: next || undefined });
              }}
            >
              <SelectTrigger className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[13px] text-[var(--text-primary)]">
                <SelectValue placeholder="Inherit (no sort pin)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Inherit (no sort pin)</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="throughput">Throughput</SelectItem>
                <SelectItem value="latency">Latency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[12px] font-medium text-[var(--text-secondary)]" htmlFor={`${datalistId}-only`}>
              Only providers
            </label>
            <input
              id={`${datalistId}-only`}
              type="text"
              placeholder="e.g. anthropic, google"
              value={onlyInput}
              onChange={(e) => {
                setOnlyInput(e.target.value);
                const slugs = parseOnlyProvidersInput(e.target.value);
                updatePin({ only: slugs.length > 0 ? slugs : undefined });
              }}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
            />
          </div>

          <p className="text-[11px] text-[var(--text-tertiary)]">
            {wirePreview
              ? `Sent per message as ${JSON.stringify(wirePreview)}`
              : "Nothing routable set — messages send without a pin."}
          </p>
        </div>
      )}

      {hasPolicy === false && (
        <p className="text-[12px] text-[var(--status-warning)]">
          No tenant routing policy found — pins are applied only when the gateway enforces a policy.
        </p>
      )}

      {persistStatus.kind === "saving" && (
        <p className="text-[12px] text-[var(--text-tertiary)]">Saving…</p>
      )}
      {persistStatus.kind === "error" && (
        <p className="text-[12px] text-[var(--status-error)]">{persistStatus.message}</p>
      )}

      {hermesAvailable && (
        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exportStatus.kind === "working" || hasPolicy === false}
            title={hasPolicy === false ? "No tenant routing policy to export" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 text-[12px] font-medium transition-colors",
              hasPolicy === false || exportStatus.kind === "working"
                ? "cursor-not-allowed text-[var(--text-tertiary)] opacity-60"
                : "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
            )}
          >
            <UploadSimple size={13} />
            {exportStatus.kind === "working" ? "Exporting…" : "Export to Hermes"}
          </button>
          {exportStatus.kind === "done" && (
            <p className="text-[12px] text-[var(--status-success)] break-all">{exportStatus.message}</p>
          )}
          {exportStatus.kind === "error" && (
            <p className="text-[12px] text-[var(--status-error)]">{exportStatus.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
