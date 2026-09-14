"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Key, TrashSimple } from "@phosphor-icons/react";
import { api } from "@/integration/api-client";
import { cn } from "@/lib/utils";

/**
 * Media provider BYOK card (MEDIA_PLUGINS Phase 1).
 *
 * Lets the user attach their own MiniMax / fal / OpenAI keys for the metered
 * media lanes (video: MiniMax H3, Seedance 2.0; image: gpt-image, FLUX).
 * Keys go through the existing V134 route-credential store
 * (`/api/v1/gateway/route-credentials`) — sealed server-side, never returned
 * in full; the media plane decrypts them only server-side when generating.
 *
 * Copy is Register 1: plain, direct, no quality guarantees.
 */

interface CredentialRow {
  provider_id: string;
  base_url: string | null;
  label: string | null;
  status: string;
  masked: string;
  last_validated_at: string | null;
}

interface CatalogProvider {
  id: string;
  kind: "video" | "image";
  name: string;
  credential_provider_id: string;
  byok?: { configured?: boolean };
  platform_funded?: { enabled?: boolean };
}

const CREDENTIAL_LABELS: Record<string, { name: string; blurb: string; placeholder: string }> = {
  minimax: {
    name: "MiniMax",
    blurb: "Powers the MiniMax H3 video lane. Key from platform.minimax.io (pay-as-you-go).",
    placeholder: "Paste your MiniMax API key",
  },
  fal: {
    name: "fal",
    blurb: "Powers Seedance 2.0 video and FLUX image lanes. Key from fal.ai.",
    placeholder: "Paste your fal key (Key …)",
  },
  openai: {
    name: "OpenAI",
    blurb: "Powers the gpt-image lane. Key from platform.openai.com.",
    placeholder: "Paste your OpenAI API key (sk-…)",
  },
};

const CREDENTIAL_IDS = ["minimax", "fal", "openai"] as const;

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

export function MediaProvidersCard() {
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogProvider[]>([]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [credRes, catRes] = await Promise.all([
        api.get<{ credentials?: CredentialRow[] }>("/api/v1/gateway/route-credentials"),
        api.get<{ providers?: CatalogProvider[] }>("/api/v1/media/catalog").catch(() => ({ providers: [] as CatalogProvider[] })),
      ]);
      setCredentials(credRes?.credentials ?? []);
      setCatalog(catRes?.providers ?? []);
    } catch {
      // Settings panel is best-effort; the generate paths fail closed on their own.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async (providerId: string) => {
    const key = (keys[providerId] ?? "").trim();
    if (!key) return;
    setStates((s) => ({ ...s, [providerId]: { kind: "saving" } }));
    try {
      const res = await api.put<{ credentials?: CredentialRow[] }>("/api/v1/gateway/route-credentials", {
        provider_id: providerId,
        api_key: key,
      });
      setCredentials(res?.credentials ?? []);
      setKeys((s) => ({ ...s, [providerId]: "" }));
      setStates((s) => ({ ...s, [providerId]: { kind: "saved" } }));
    } catch (error) {
      setStates((s) => ({
        ...s,
        [providerId]: { kind: "error", message: error instanceof Error ? error.message : "Failed to save key" },
      }));
    }
  };

  const remove = async (providerId: string) => {
    setStates((s) => ({ ...s, [providerId]: { kind: "saving" } }));
    try {
      await api.delete(`/api/v1/gateway/route-credentials/${providerId}`);
      await refresh();
      setStates((s) => ({ ...s, [providerId]: { kind: "idle" } }));
    } catch (error) {
      setStates((s) => ({
        ...s,
        [providerId]: { kind: "error", message: error instanceof Error ? error.message : "Failed to remove key" },
      }));
    }
  };

  const platformLanes = catalog.filter((p) => p.platform_funded?.enabled).map((p) => p.name);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)]">
          <Key size={18} className="text-[var(--accent-primary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
            Media providers
          </div>
          <div className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Bring your own keys for metered video and image generation. Keys are stored sealed and never shown back in
            full. Generation bills your own provider account.
          </div>
        </div>
      </div>

      {platformLanes.length > 0 && (
        <p className="text-[12px] text-[var(--text-secondary)]">
          Operator-funded lanes currently enabled: {platformLanes.join(", ")}. Your own key still takes precedence.
        </p>
      )}

      {loaded &&
        CREDENTIAL_IDS.map((id) => {
          const meta = CREDENTIAL_LABELS[id];
          const existing = credentials.find((c) => c.provider_id === id);
          const state = states[id] ?? { kind: "idle" };
          const lanes = catalog.filter((p) => p.credential_provider_id === id);
          return (
            <div
              key={id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-medium text-[var(--text-primary)]">{meta.name}</div>
                {existing && (
                  <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{existing.masked}</span>
                )}
              </div>
              <p className="text-[12px] text-[var(--text-secondary)]">{meta.blurb}</p>
              {lanes.length > 0 && (
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Lanes: {lanes.map((l) => `${l.name} (${l.kind})`).join(", ")}
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="password"
                  autoComplete="off"
                  aria-label={`${meta.name} API key`}
                  placeholder={meta.placeholder}
                  value={keys[id] ?? ""}
                  onChange={(e) => setKeys((s) => ({ ...s, [id]: e.target.value }))}
                  className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
                />
                <button
                  type="button"
                  disabled={!(keys[id] ?? "").trim() || state.kind === "saving"}
                  onClick={() => void save(id)}
                  className={cn(
                    "h-9 rounded-lg border border-[var(--border-subtle)] px-3 text-[12px] font-medium transition-colors",
                    !(keys[id] ?? "").trim() || state.kind === "saving"
                      ? "cursor-not-allowed text-[var(--text-tertiary)] opacity-60"
                      : "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                  )}
                >
                  {state.kind === "saving" ? "Saving…" : existing ? "Replace key" : "Save key"}
                </button>
                {existing && (
                  <button
                    type="button"
                    onClick={() => void remove(id)}
                    aria-label={`Remove ${meta.name} key`}
                    className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--status-error)] hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <TrashSimple size={14} />
                  </button>
                )}
              </div>
              {state.kind === "saved" && <p className="text-[12px] text-[var(--status-success)]">Key saved.</p>}
              {state.kind === "error" && <p className="text-[12px] text-[var(--status-error)]">{state.message}</p>}
            </div>
          );
        })}
    </div>
  );
}

export default MediaProvidersCard;
