'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Key, Trash } from '@phosphor-icons/react';
import { allternitCloudOrigin } from '@/lib/cloud-api';
import { useToast } from '@/hooks/use-toast';

export interface FabricOperatorKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

interface CreatedOperatorKey extends FabricOperatorKey {
  token: string;
}

export function FabricOperatorKeys({
  getToken,
}: {
  getToken: () => Promise<string | null>;
}): React.ReactNode {
  const { addToast } = useToast();
  const [keys, setKeys] = useState<FabricOperatorKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);
  const [name, setName] = useState('Grokbot');
  const [revealed, setRevealed] = useState<CreatedOperatorKey | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error('Sign in required');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [getToken]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${allternitCloudOrigin()}/api/v1/api-keys`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as FabricOperatorKey[];
      setKeys(Array.isArray(data) ? data : []);
    } catch (error) {
      addToast({
        title: 'Could not load operator keys',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [addToast, authHeaders]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mint = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      addToast({ title: 'Name required', description: 'Give this key a name.', type: 'error' });
      return;
    }
    setMinting(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${allternitCloudOrigin()}/api/v1/api-keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: trimmed, scopes: ['compute'] }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = (await res.json()) as CreatedOperatorKey;
      setRevealed(created);
      setKeys((prev) => [created, ...prev.filter((key) => key.id !== created.id)]);
      addToast({ title: 'Operator key minted', description: 'Copy it now — it is shown once.', type: 'success' });
    } catch (error) {
      addToast({
        title: 'Could not mint key',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setMinting(false);
    }
  }, [addToast, authHeaders, name]);

  const revoke = useCallback(async (id: string) => {
    setRevokingId(id);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${allternitCloudOrigin()}/api/v1/api-keys/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(await res.text());
      setKeys((prev) => prev.filter((key) => key.id !== id));
      if (revealed?.id === id) setRevealed(null);
      addToast({ title: 'Key revoked', type: 'info' });
    } catch (error) {
      addToast({
        title: 'Could not revoke key',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setRevokingId(null);
    }
  }, [addToast, authHeaders, revealed]);

  const copyToken = useCallback(async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      addToast({ title: 'Copied', type: 'success' });
    } catch {
      addToast({ title: 'Copy failed', type: 'error' });
    }
  }, [addToast]);

  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-semibold m-0 mb-1">Operator keys</h2>
      <p className="m-0 mb-3 text-[13px] text-[var(--shell-item-muted)]">
        Bots such as Grokbot sign in as an operator with an <code>alt_</code> key — they are not a node.
        Use <code>Authorization: Bearer alt_…</code> against the same APIs as this page. The token is shown once.
      </p>

      {revealed?.token ? (
        <div className="mb-3 rounded-xl border border-solid border-[var(--status-warning)] bg-[var(--shell-rail-bg)] px-4 py-3">
          <div className="text-[12px] font-semibold mb-1">Copy this token now</div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 text-[12px] break-all">{revealed.token}</code>
            <button
              type="button"
              onClick={() => void copyToken(revealed.token)}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--shell-control-bg)] text-[12px] font-semibold cursor-pointer"
            >
              <Copy size={14} />
              Copy
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Key name"
          className="h-8 px-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--shell-control-bg)] text-[12px] font-semibold text-[var(--shell-item-fg)]"
        />
        <button
          type="button"
          onClick={() => void mint()}
          disabled={minting}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--shell-control-bg)] text-[12px] font-semibold text-[var(--shell-control-fg)] cursor-pointer disabled:opacity-50"
        >
          <Key size={14} />
          {minting ? 'Minting…' : 'Mint compute key'}
        </button>
      </div>

      {loading ? (
        <div className="text-[13px] text-[var(--shell-item-muted)]">Loading keys…</div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-5 text-[13px] text-[var(--shell-item-muted)]">
          No operator keys yet. Mint one for Grokbot or any other bot that should drive your nodes.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-[14px] font-semibold truncate">{key.name}</div>
                <div className="text-[12px] text-[var(--shell-item-muted)] truncate">
                  {key.prefix}… · {(key.scopes || []).join(', ') || 'no scopes'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void revoke(key.id)}
                disabled={revokingId === key.id}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--shell-control-bg)] text-[12px] font-semibold cursor-pointer disabled:opacity-50"
                title="Revoke"
              >
                <Trash size={14} />
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
