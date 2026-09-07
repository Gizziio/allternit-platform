/**
 * RemotePeersRailSection — minimal "Remote peers" rail panel for the
 * cross-machine fabric (BOT_TEAMMATES_SPEC Phase 3).
 *
 * Self-contained on purpose: ShellRail's integration point is a single marked
 * block rendering this section next to TEAMMATES. Self-prunes to nothing when
 * no remote peer is configured (until the user opens the add form).
 *
 * Ghost-row awareness: peers whose union-roster source failed its last poll
 * render muted with an "unreachable" tooltip; bots reported by an unreachable
 * source are exposed via `useRemotePeers().unreachableSources` for TEAMMATES
 * row rendering (wired at integration).
 */

import React, { useCallback, useState } from 'react';
import { CaretRight, Plus, Trash, Globe } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useRemotePeers } from './use-remote-peers';

export function RemotePeersRailSection(): React.ReactNode {
  const {
    peers,
    roster,
    error,
    addPeer,
    removePeer,
    reachabilityByPeer,
  } = useRemotePeers();
  const [expanded, setExpanded] = useState(false);
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

  // Self-pruning: nothing configured and the form is closed → render nothing.
  if (peers.length === 0 && !adding) {
    return (
      <RemotePeersHeader expanded={expanded} onToggle={() => setExpanded((v) => !v)} onAdd={() => setAdding(true)} />
    );
  }

  return (
    <div className="flex flex-col px-2 shrink-0" data-testid="remote-peers-section">
      <RemotePeersHeader
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onAdd={() => setAdding((v) => !v)}
      />
      {expanded && (
        <div className="flex flex-col gap-0.5 pb-1">
          {peers.map((peer) => {
            const reachable = reachabilityByPeer[peer.name] ?? peer.reachable;
            const ghostCount = roster.filter(
              (r) => r.kind === 'peer' && r.source === peer.name && !r.sourceReachable,
            ).length;
            return (
              <div
                key={peer.name}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--shell-item-hover)]"
              >
                <span
                  className={cn(
                    'size-2 rounded-full shrink-0',
                    reachable ? 'bg-emerald-500' : 'bg-zinc-500',
                  )}
                  title={reachable ? 'reachable' : 'unreachable'}
                  data-testid={`peer-dot-${peer.name}`}
                />
                <Globe size={13} className="text-[var(--shell-item-muted)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-[12px] truncate',
                      reachable
                        ? 'text-[var(--shell-item-fg)]'
                        : 'text-[var(--shell-item-muted)] line-through decoration-dotted',
                    )}
                    title={reachable ? peer.url : 'unreachable'}
                  >
                    {peer.name}
                  </div>
                  <div className="text-[10px] text-[var(--shell-item-muted)] truncate">{peer.url}</div>
                </div>
                {ghostCount > 0 && (
                  <span
                    className="text-[10px] text-[var(--shell-item-muted)]"
                    title={`${ghostCount} known peer(s) on ${peer.name} currently unreachable`}
                  >
                    {ghostCount} ghost
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void removePeer(peer.name)}
                  className="opacity-0 group-hover:opacity-100 size-6 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-red-400 cursor-pointer flex items-center justify-center"
                  title={`Remove ${peer.name}`}
                >
                  <Trash size={12} />
                </button>
              </div>
            );
          })}
          {error && (
            <div className="px-2 py-1 text-[11px] text-red-400">{error}</div>
          )}
          {adding && (
            <div className="flex flex-col gap-1.5 px-2 py-2 border-t border-[var(--shell-border)]">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Peer name"
                className="px-2 py-1 text-[12px] bg-[var(--shell-rail-bg)] border border-[var(--shell-border)] rounded-md text-[var(--shell-item-fg)] outline-none"
              />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://host:8013"
                className="px-2 py-1 text-[12px] bg-[var(--shell-rail-bg)] border border-[var(--shell-border)] rounded-md text-[var(--shell-item-fg)] outline-none"
              />
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Shared key (stored in daemon peers.env)"
                type="password"
                className="px-2 py-1 text-[12px] bg-[var(--shell-rail-bg)] border border-[var(--shell-border)] rounded-md text-[var(--shell-item-fg)] outline-none"
              />
              {formError && <div className="text-[11px] text-red-400">{formError}</div>}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleAdd()}
                  disabled={busy}
                  className="px-2 py-1 text-[11px] rounded-md bg-[var(--shell-item-hover)] border-none text-[var(--shell-item-fg)] cursor-pointer disabled:opacity-50"
                >
                  {busy ? 'Adding…' : 'Add peer'}
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="px-2 py-1 text-[11px] rounded-md bg-transparent border-none text-[var(--shell-item-muted)] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RemotePeersHeader({
  expanded,
  onToggle,
  onAdd,
}: {
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
}): React.ReactNode {
  return (
    <div className="group px-1 py-2 flex items-center justify-between text-[var(--shell-item-muted)] text-[12px] font-extrabold uppercase tracking-[0.08em] select-none">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] cursor-pointer"
      >
        <CaretRight
          size={12}
          className={cn('transition-transform duration-200', expanded && 'rotate-90')}
        />
        <span>Remote peers</span>
      </button>
      <button
        type="button"
        onClick={onAdd}
        className="opacity-0 max-md:opacity-100 group-hover:opacity-100 size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-all"
        title="Add remote peer"
      >
        <Plus size={13} weight="bold" />
      </button>
    </div>
  );
}
