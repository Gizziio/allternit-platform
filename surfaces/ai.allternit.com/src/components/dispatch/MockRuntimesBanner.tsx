'use client';

import React from 'react';
import { Warning } from '@phosphor-icons/react';

export function MockRuntimesBanner(): React.ReactNode {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
      <Warning size={18} className="text-amber-500 shrink-0 mt-0.5" weight="fill" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[var(--text-primary)]">Mock runtimes active</div>
        <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
          Local dev bypass is enabled. These machines are synthetic and cannot receive real Fabric Session commands.
        </div>
      </div>
    </div>
  );
}
