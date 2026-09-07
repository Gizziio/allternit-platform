"use client";

import React, { useState } from 'react';
import { Broom, DotsThreeVertical, Trash } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface DispatchOptionsMenuProps {
  onClearMemory: () => void;
  onDeleteConversation: () => void;
}

export function DispatchOptionsMenu({
  onClearMemory,
  onDeleteConversation,
}: DispatchOptionsMenuProps): React.ReactNode {
  const [open, setOpen] = useState(false);

  const items = [
    {
      label: 'Clear memory',
      icon: Broom,
      onSelect: () => {
        onClearMemory();
        setOpen(false);
      },
    },
    {
      label: 'Delete conversation',
      icon: Trash,
      onSelect: () => {
        onDeleteConversation();
        setOpen(false);
      },
    },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Dispatch options"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-center w-8 h-8 border border-solid border-[var(--border-default)] rounded-lg bg-transparent cursor-pointer',
          'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors',
          open && 'bg-[var(--surface-hover)] text-[var(--text-primary)]'
        )}
      >
        <DotsThreeVertical size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-sm py-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onSelect}
                  className={cn(
                    'w-full flex items-center gap-2.5 text-left px-3 py-2 cursor-pointer border-none bg-transparent',
                    'text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors'
                  )}
                >
                  <Icon size={16} className="shrink-0 text-[var(--text-tertiary)]" />
                  <span className="flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
