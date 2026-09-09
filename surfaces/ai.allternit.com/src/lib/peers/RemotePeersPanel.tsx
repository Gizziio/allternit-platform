import React, { useCallback, useState } from 'react';
import { Globe, Plus, Trash } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useRemotePeers } from './use-remote-peers';

/**
 * RemotePeersPanel — wide-view "Remote peers" card for the cross-machine
 * fabric (BOT_TEAMMATES_SPEC Phase 3).
 *
 * Renders configured remote peer connections (reachability dot, URL, ghost
 * roster counts) with inline add/remove, styled for a full view rather than
 * the rail: surfaced inside FabricTransportView.
 *
 * Ghost-row awareness: peers whose union-roster source failed its last poll
 * render muted with an "unreachable" tooltip; bots reported by an unreachable
 * source are exposed via `useRemotePeers().unreachableSources`.
 */
export function RemotePeersPanel(): React.ReactNode {
  const {
    peers,
    roster,
    error,
    addPeer,
    removePeer,
    reachabilityByPeer,
  } = useRemotePeers();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    if (!name.trim() || !url.trim()) {
      setFormError('Name and URL are required.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await addPeer({
        name: name.trim(),
        url: url.trim(),
        key: key.trim() || undefined,
      });
      setName('');
      setUrl('');
      setKey('');
      setAdding(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [name, url, key, addPeer]);

  return (
    <section
      className="rounded-2xl border border-solid border-[var(--border-default)] bg-white p-5"
      data-testid="remote-peers-section"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Globe size={16} />
          Remote peers
          <span className="text-[12px] font-normal text-[var(--text-secondary)]">
            {peers.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-solid border-[var(--border-default)] bg-white px-3 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
        >
          <Plus size={13} weight="bold" />
          Add peer
        </button>
      </div>

      {peers.length === 0 && !adding && (
        <p className="mt-3 text-[13px] text-[var(--text-tertiary)]">
          No remote peers configured. Connect another machine's Allternit node
          to share bots across the fabric.
        </p>
      )}

      {peers.length > 0 && (
        <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
          {peers.map((peer) => {
            const reachable = reachabilityByPeer[peer.name] ?? peer.reachable;
            const ghostCount = roster.filter(
              (r) => r.kind === 'peer' && r.source === peer.name && !r.sourceReachable,
            ).length;
            return (
              <li key={peer.name} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    'size-2 rounded-full shrink-0',
                    reachable ? 'bg-emerald-500' : 'bg-zinc-500',
                  )}
                  title={reachable ? 'reachable' : 'unreachable'}
                  data-testid={`peer-dot-${peer.name}`}
                />
                <Globe size={14} className="text-[var(--text-secondary)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-[13px] font-medium truncate',
                      !reachable && 'text-[var(--text-tertiary)] line-through decoration-dotted',
                    )}
                    title={reachable ? peer.url : 'unreachable'}
                  >
                    {peer.name}
                  </div>
                  <div className="font-mono text-[11px] text-[var(--text-tertiary)] truncate">
                    {peer.url}
                  </div>
                </div>
                {ghostCount > 0 && (
                  <span
                    className="text-[11px] text-[var(--text-tertiary)] shrink-0"
                    title={`${ghostCount} known peer(s) on ${peer.name} currently unreachable`}
                  >
                    {ghostCount} ghost
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void removePeer(peer.name)}
                  className="size-7 rounded-md bg-transparent border-none text-[var(--text-tertiary)] hover:text-red-500 cursor-pointer flex items-center justify-center transition-colors"
                  title={`Remove ${peer.name}`}
                >
                  <Trash size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}

      {adding && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-solid border-[var(--border-subtle)] p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Peer name"
            className="rounded-lg border border-solid border-[var(--border-default)] bg-transparent px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://host:8013"
            className="rounded-lg border border-solid border-[var(--border-default)] bg-transparent px-2.5 py-1.5 font-mono text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
          />
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Shared key (stored in daemon peers.env)"
            type="password"
            className="rounded-lg border border-solid border-[var(--border-default)] bg-transparent px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
          />
          {formError && <p className="text-[11px] text-red-500">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={busy}
              className="rounded-lg border border-solid border-[var(--border-default)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)] cursor-pointer transition-colors hover:border-[var(--border-hover)] disabled:opacity-50"
            >
              {busy ? 'Adding…' : 'Add peer'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border-none bg-transparent px-3 py-1.5 text-[12px] text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
