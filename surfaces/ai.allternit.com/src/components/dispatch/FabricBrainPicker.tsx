'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, CaretDown, Check } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { FabricBrain, FabricModelRef } from '@/lib/dispatch/fabric-session-client';

function brainStorageKey(runtimeId: string): string {
  return `allternit.fabric-brain.${runtimeId}`;
}

export function loadFabricBrain(runtimeId: string): FabricModelRef | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(brainStorageKey(runtimeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FabricModelRef;
    if (!parsed?.providerID || !parsed?.modelID) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveFabricBrain(runtimeId: string, brain: FabricModelRef | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!brain) window.localStorage.removeItem(brainStorageKey(runtimeId));
    else window.localStorage.setItem(brainStorageKey(runtimeId), JSON.stringify(brain));
  } catch {
    // ignore quota / private mode
  }
}

export function fabricBrainLabel(brain: FabricModelRef | null, providers: FabricBrain[]): string {
  if (!brain) return 'Choose brain';
  const provider = providers.find((item) => item.id === brain.providerID);
  const model = provider?.models.find((item) => item.id === brain.modelID);
  return model?.name || brain.modelID;
}

export function fabricBrainProvider(brain: FabricModelRef | null, providers: FabricBrain[]): string | null {
  if (!brain) return null;
  return providers.find((item) => item.id === brain.providerID)?.name || brain.providerID;
}

interface FabricBrainPickerProps {
  runtimeId: string;
  brains: FabricBrain[];
  loading?: boolean;
  value: FabricModelRef | null;
  onChange: (brain: FabricModelRef) => void;
}

export function FabricBrainPicker({
  runtimeId,
  brains,
  loading,
  value,
  onChange,
}: FabricBrainPickerProps): React.ReactNode {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, [open]);

  const listed = useMemo(() => {
    const withModels = brains.filter((brain) => brain.models.length > 0);
    return [...withModels].sort((a, b) => Number(Boolean(b.connected)) - Number(Boolean(a.connected)));
  }, [brains]);

  const providerName = fabricBrainProvider(value, brains);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Choose the brain this node should run"
        className="inline-flex items-center gap-1.5 max-w-[220px] rounded-full border-none bg-transparent px-2 py-1 text-[12px] font-medium text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--surface-hover)] cursor-pointer"
      >
        <Brain size={14} weight="fill" className="shrink-0 text-[var(--accent-primary)]" />
        <span className="truncate">
          {loading && listed.length === 0
            ? 'Loading…'
            : providerName
              ? `${providerName} · ${fabricBrainLabel(value, brains)}`
              : fabricBrainLabel(value, brains)}
        </span>
        <CaretDown size={11} className={cn('shrink-0 opacity-70 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-30 w-[min(320px,calc(100vw-48px))] max-h-[360px] overflow-y-auto rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] shadow-[var(--shadow-md)] p-1.5">
          {listed.length === 0 ? (
            <div className="px-3 py-4 text-[12px] text-[var(--shell-item-muted)]">
              {loading ? 'Loading brains on this node…' : 'No brains connected on this machine.'}
            </div>
          ) : (
            listed.map((provider) => (
              <div key={provider.id} className="mb-1">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--shell-item-muted)]">
                  {provider.name}
                  {provider.connected ? '' : ' · not connected'}
                </div>
                {provider.models.map((model) => {
                  const selected = value?.providerID === provider.id && value?.modelID === model.id;
                  return (
                    <button
                      key={`${provider.id}:${model.id}`}
                      type="button"
                      onClick={() => {
                        const next = { providerID: provider.id, modelID: model.id };
                        saveFabricBrain(runtimeId, next);
                        onChange(next);
                        setOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 rounded-xl border-none px-2.5 py-1.5 text-left cursor-pointer',
                        selected
                          ? 'bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)]'
                          : 'bg-transparent text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]'
                      )}
                    >
                      <span className="min-w-0 truncate text-[12px] font-medium">{model.name}</span>
                      {selected ? <Check size={13} weight="bold" className="shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
