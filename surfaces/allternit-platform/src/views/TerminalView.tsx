import React from 'react';
import { TerminalTabs } from './nodes/terminal';
import { GlassCard } from '@/design/GlassCard';
import { tokens } from '@/design/tokens';

export function TerminalView({ noPadding = false }: { noPadding?: boolean }) {
  return (
    <div
      style={{
        height: '100%',
        padding: noPadding ? 0 : tokens.space.lg,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <GlassCard
        style={{
          flex: 1,
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: noPadding ? 0 : 12,
          border: noPadding ? 'none' : '1px solid var(--border-strong)',
        }}
      >
        <TerminalTabs className="h-full" />
      </GlassCard>
    </div>
  );
}

export default TerminalView;
