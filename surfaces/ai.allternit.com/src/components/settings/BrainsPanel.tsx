'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plug, CheckCircle, WarningCircle, XCircle, CircleNotch, ArrowSquareOut, Key } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// Wires the Settings "Brains" panel to the REAL allternit-api provider-auth surface:
//   GET  /api/v1/providers/auth/status          per-provider readiness + auth + models
//   POST /api/v1/providers/:id/connect          one-click subscription/CLI connect
//   GET  /api/v1/providers/:id/connect/status   poll after an interactive sign-in
//   POST /api/v1/providers/:id/connect/confirm  user-attested sign-in completion
// Detection (claude/codex/qwen/kimi/antigravity/zai) already lives in allternit-api;
// this component only renders + triggers. No hardcoded provider list, no demo data.

type RowStatus = 'ok' | 'missing' | 'unknown' | 'not_required';

interface ProviderRow {
  provider_id: string;
  status: RowStatus;
  authenticated: boolean;
  auth_required: boolean;
  auth_profile_id?: string | null;
  chat_profile_ids: string[];
  details?: {
    provider_type?: string;
    base_url?: string | null;
    api_key_set?: boolean;
    model_count?: number;
    capabilities?: { default_model?: string; vision?: boolean; tool_call?: boolean };
  };
}

type ConnectPhase =
  | { phase: 'idle' }
  | { phase: 'busy' }
  | { phase: 'polling'; label: string }
  | { phase: 'confirm'; label: string }
  | { phase: 'needs_key'; label: string; page?: string }
  | { phase: 'not_installed'; label: string; page?: string; binary?: string }
  | { phase: 'api_key' }
  | { phase: 'error'; message: string };

const STATUS_META: Record<RowStatus, { label: string; tone: 'success' | 'warning' | 'error' | 'muted' }> = {
  ok: { label: 'Ready', tone: 'success' },
  not_required: { label: 'Ready', tone: 'success' },
  missing: { label: 'Needs auth', tone: 'warning' },
  unknown: { label: 'Offline', tone: 'error' },
};

function toneVar(tone: 'success' | 'warning' | 'error' | 'muted') {
  switch (tone) {
    case 'success':
      return 'var(--status-success)';
    case 'warning':
      return 'var(--status-warning)';
    case 'error':
      return 'var(--status-error)';
    default:
      return 'var(--text-tertiary)';
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: 'no-store', ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err: any = new Error(text || `${res.status}`);
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export function BrainsPanel() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connect, setConnect] = useState<Record<string, ConnectPhase>>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const setPhase = (id: string, c: ConnectPhase) =>
    setConnect((prev) => ({ ...prev, [id]: c }));

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<{ providers: ProviderRow[] }>('/api/v1/providers/auth/status');
      const rows = (data.providers ?? []).slice().sort((a, b) => {
        if (a.authenticated !== b.authenticated) return a.authenticated ? -1 : 1;
        return a.provider_id.localeCompare(b.provider_id);
      });
      setProviders(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load provider status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // One-time migration from the former browser-local provider gallery. Move
    // each legacy value directly into the selected runtime and delete it only
    // after Gizzi confirms the write.
    void (async () => {
      const prefix = 'allternit_provider_key_';
      const legacy = Object.keys(localStorage)
        .filter((name) => name.startsWith(prefix))
        .map((name) => ({ name, provider: name.slice(prefix.length), key: localStorage.getItem(name) || '' }))
        .filter(({ provider, key }) => /^[a-z0-9._-]{1,80}$/i.test(provider) && Boolean(key));
      let migrated = false;
      for (const item of legacy) {
        try {
          await api('/api/v1/onboarding/provider', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: item.provider,
              name: item.provider,
              apiKey: item.key,
              authType: 'api_key',
              setDefault: false,
            }),
          });
          localStorage.removeItem(item.name);
          migrated = true;
        } catch {
          // Keep the legacy value until a runtime is available to receive it.
        }
      }
      if (migrated) await load();
    })();
    return () => {
      Object.values(pollTimers.current).forEach(clearInterval);
    };
  }, [load]);

  const stopPoll = (id: string) => {
    if (pollTimers.current[id]) {
      clearInterval(pollTimers.current[id]);
      delete pollTimers.current[id];
    }
  };

  const startPoll = (id: string, label: string) => {
    stopPoll(id);
    setPhase(id, { phase: 'polling', label });
    let elapsed = 0;
    pollTimers.current[id] = setInterval(async () => {
      elapsed += 2000;
      try {
        const s = await api<{ status: string }>(`/api/v1/providers/${encodeURIComponent(id)}/connect/status`);
        if (s.status === 'success') {
          stopPoll(id);
          setPhase(id, { phase: 'idle' });
          load();
          return;
        }
      } catch {
        // keep polling; detection may lag
      }
      if (elapsed >= 120_000) {
        stopPoll(id);
        // Could not auto-detect completion — let the user attest (matches backend confirm flow).
        setPhase(id, { phase: 'confirm', label });
      }
    }, 2000);
  };

  const onConnect = async (id: string) => {
    setPhase(id, { phase: 'busy' });
    try {
      const r = await api<any>(`/api/v1/providers/${encodeURIComponent(id)}/connect`, { method: 'POST' });
      switch (r.status) {
        case 'already_connected':
          setPhase(id, { phase: 'idle' });
          load();
          break;
        case 'started':
          startPoll(id, r.label ?? id);
          break;
        case 'not_installed':
          setPhase(id, { phase: 'not_installed', label: r.label ?? id, page: r.page, binary: r.binary });
          break;
        case 'needs_api_key':
          setPhase(id, { phase: 'needs_key', label: r.label ?? id, page: r.page });
          break;
        default:
          setPhase(id, { phase: 'idle' });
          load();
      }
    } catch (e: any) {
      // 404 unknown_provider => not a subscription/CLI brain; it uses an API key instead.
      if (e?.status === 404) setPhase(id, { phase: 'api_key' });
      else setPhase(id, { phase: 'error', message: e?.message ?? 'Connect failed' });
    }
  };

  const onConfirm = async (id: string) => {
    try {
      await api(`/api/v1/providers/${encodeURIComponent(id)}/connect/confirm`, { method: 'POST' });
      setPhase(id, { phase: 'idle' });
      load();
    } catch (e: any) {
      setPhase(id, { phase: 'error', message: e?.message ?? 'Confirm failed' });
    }
  };

  const saveApiKey = async (id: string) => {
    const key = apiKeys[id]?.trim();
    if (!key) return;
    setPhase(id, { phase: 'busy' });
    try {
      await api('/api/v1/onboarding/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: id,
          name: id,
          apiKey: key,
          authType: 'api_key',
          setDefault: false,
        }),
      });
      setApiKeys((previous) => ({ ...previous, [id]: '' }));
      localStorage.removeItem(`allternit_provider_key_${id}`);
      setPhase(id, { phase: 'idle' });
      await load();
    } catch (failure: any) {
      setPhase(id, { phase: 'error', message: failure?.message ?? 'Could not store provider credential' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-[12px] text-[var(--text-tertiary)]">
        <CircleNotch size={16} className="animate-spin" /> Detecting brains…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-solid border-[var(--status-error)]/40 bg-[var(--status-error)]/10 text-[12px] text-[var(--status-error)]">
          <WarningCircle size={16} weight="fill" /> {error}
        </div>
      )}

      {providers.map((p) => {
        const meta = STATUS_META[p.status] ?? STATUS_META.unknown;
        const d = p.details ?? {};
        const phase = connect[p.provider_id] ?? { phase: 'idle' as const };
        const letter = (p.provider_id || '?').slice(0, 1).toUpperCase();
        const isReady = p.authenticated;
        const showConnect = phase.phase !== 'api_key';

        return (
          <div
            key={p.provider_id}
            className="flex flex-col gap-2 p-4 rounded-xl bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] hover:border-[var(--ui-border-default)] transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="size-11 rounded-xl bg-[var(--accent-primary)] flex items-center justify-center text-[var(--ui-text-inverse)] text-xl font-black shadow-lg shadow-[var(--accent-primary)]/10 uppercase">
                {letter}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[var(--text-primary)] truncate">{p.provider_id}</span>
                  {d.provider_type && (
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-tertiary)]">
                      {d.provider_type}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="size-1.5 rounded-full" style={{ background: toneVar(meta.tone) }} />
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: toneVar(meta.tone) }}>
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-[var(--text-tertiary)]">
                    · {d.model_count ?? 0} model{(d.model_count ?? 0) === 1 ? '' : 's'}
                    {d.capabilities?.default_model ? ` · ${d.capabilities.default_model}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {phase.phase === 'busy' || phase.phase === 'polling' ? (
                  <span className="flex items-center gap-2 text-[12px] font-bold text-[var(--text-secondary)]">
                    <CircleNotch size={16} className="animate-spin" />
                    {phase.phase === 'polling' ? 'Waiting for sign-in…' : 'Connecting…'}
                  </span>
                ) : phase.phase === 'confirm' ? (
                  <button
                    type="button"
                    onClick={() => onConfirm(p.provider_id)}
                    className="flex items-center gap-1.5 p-2 px-4 rounded-lg border border-solid border-[var(--status-success)]/50 bg-[var(--status-success)]/10 text-[var(--status-success)] text-[12px] font-bold cursor-pointer active:scale-95 transition-all"
                  >
                    <CheckCircle size={14} weight="fill" /> I signed in
                  </button>
                ) : showConnect ? (
                  <button
                    type="button"
                    onClick={() => onConnect(p.provider_id)}
                    className={cn(
                      'flex items-center gap-1.5 p-2 px-4 rounded-lg border border-solid text-[12px] font-bold cursor-pointer active:scale-95 transition-all',
                      isReady
                        ? 'border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-white/5'
                        : 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--ui-text-inverse)]',
                    )}
                  >
                    <Plug size={14} weight="fill" /> {isReady ? 'Reconnect' : 'Connect'}
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                    <Key size={14} /> API key
                  </span>
                )}
              </div>
            </div>

            {/* Inline connect outcomes */}
            {phase.phase === 'not_installed' && (
              <div className="flex items-center gap-2 pl-15 text-[12px] text-[var(--status-warning)]">
                <XCircle size={15} weight="fill" />
                <span>
                  {phase.label} CLI{phase.binary ? ` (${phase.binary})` : ''} is not installed.
                </span>
                {phase.page && (
                  <a
                    href={phase.page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 underline text-[var(--text-secondary)]"
                  >
                    Install guide <ArrowSquareOut size={12} />
                  </a>
                )}
              </div>
            )}
            {(phase.phase === 'needs_key' || phase.phase === 'api_key') && (
              <div className="flex flex-col gap-2 pl-15 text-[12px] text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <Key size={15} />
                  <span>This provider uses an API key stored by the selected Gizzi runtime.</span>
                  {phase.phase === 'needs_key' && phase.page && (
                    <a
                      href={phase.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 underline"
                    >
                      Get a key <ArrowSquareOut size={12} />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    aria-label={`${p.provider_id} API key`}
                    value={apiKeys[p.provider_id] || ''}
                    onChange={(event) => setApiKeys((previous) => ({ ...previous, [p.provider_id]: event.target.value }))}
                    placeholder="Paste API key"
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                  />
                  <button
                    type="button"
                    disabled={!apiKeys[p.provider_id]?.trim()}
                    onClick={() => void saveApiKey(p.provider_id)}
                    className="rounded-lg border border-solid border-[var(--accent-primary)] bg-[var(--accent-primary)] px-3 py-2 text-[12px] font-bold text-[var(--ui-text-inverse)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Connect
                  </button>
                </div>
              </div>
            )}
            {phase.phase === 'error' && (
              <div className="flex items-center gap-2 pl-15 text-[12px] text-[var(--status-error)]">
                <WarningCircle size={15} weight="fill" /> {phase.message}
              </div>
            )}
          </div>
        );
      })}

      {providers.length === 0 && !error && (
        <div className="p-6 text-center text-[12px] text-[var(--text-tertiary)] border border-dashed border-[var(--border-subtle)] rounded-xl">
          No brains detected. Start the gizzi runtime or allternit-api, then refresh.
        </div>
      )}
    </div>
  );
}
