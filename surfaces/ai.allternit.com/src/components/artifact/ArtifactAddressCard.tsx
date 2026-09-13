"use client";

/**
 * ArtifactAddressCard — resolves an `a://artifact/<id>` address to the local
 * gateway artifact (A:// Artifacts API Phase 2, docs/design/artifacts-api.md
 * §5 "Cowork"): cowork runs reference artifacts by address instead of
 * embedding bodies in messages, and every surface renders the address through
 * this card — fetch on expand, render the current version body in the same
 * sandboxed iframe as every other artifact.
 */

import React, { memo, useCallback, useState } from 'react';
import { FileHtml, SpinnerGap, Warning, ArrowSquareOut } from '@phosphor-icons/react';
import ArtifactRenderer from './ArtifactRenderer';
import { parseArtifactAddress, getContentArtifact } from '@/lib/design/content-artifact-api';
import { cn } from '@/lib/utils';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export const ArtifactAddressCard = memo(function ArtifactAddressCard({
  address,
}: {
  address: string;
}) {
  const parsed = parseArtifactAddress(address);
  const [state, setState] = useState<LoadState>('idle');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('text/html');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!parsed || state === 'loading' || state === 'loaded') return;
    setState('loading');
    setError('');
    try {
      const res = await getContentArtifact(parsed.id);
      const artifact = res.artifact;
      if (!artifact?.body) {
        setError('Artifact body is empty.');
        setState('error');
        return;
      }
      setTitle(artifact.title ?? 'Untitled artifact');
      setType(artifact.type ?? 'text/html');
      setBody(artifact.body);
      setState('loaded');
    } catch {
      setError('Artifact not found on the local gateway.');
      setState('error');
    }
  }, [parsed, state]);

  if (!parsed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-panel,#1a1a1a)] border border-white/5 text-xs text-white/40 font-mono">
        <Warning className="size-3.5 shrink-0" />
        <span className="truncate">{address}</span>
      </div>
    );
  }

  if (state === 'loaded') {
    return (
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-panel,#1a1a1a)] border-b border-white/5">
          <FileHtml className="size-4 text-amber-400/70 shrink-0" />
          <span className="text-sm text-white/80 truncate">{title}</span>
          <span className="ml-auto text-[11px] font-mono text-white/30 shrink-0">{address}</span>
        </div>
        <ArtifactRenderer content={body} type={type} height="420px" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={load}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-panel,#1a1a1a)] border border-white/5 text-sm text-white/60 cursor-pointer transition-colors hover:border-amber-400/30 hover:text-white/80",
        state === 'error' && "border-red-500/30",
      )}
    >
      {state === 'loading' ? (
        <SpinnerGap className="size-4 shrink-0 animate-spin text-amber-400/70" />
      ) : (
        <ArrowSquareOut className="size-4 shrink-0 text-amber-400/70" />
      )}
      <span className="font-mono text-xs truncate">{address}</span>
      <span className="ml-auto text-xs text-white/30 shrink-0">
        {state === 'loading' ? 'Loading…' : state === 'error' ? error : 'Load artifact'}
      </span>
    </button>
  );
});

export default ArtifactAddressCard;
