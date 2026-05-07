import React from 'react';
import { GlassCard } from '../../design/GlassCard';
import { Warning, XCircle } from '@phosphor-icons/react';

export function ProblemsView() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <GlassCard style={{ padding: 12, display: 'flex', alignItems: 'flex-start', gap: 12, borderLeft: '4px solid #ff3b30' }}>
        <XCircle size={20} color="#ff3b30" weight="fill" style={{ marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Syntax Error</div>
          <div style={{ fontSize: 12, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>src/views/code/CodeCanvas.tsx:44:12</div>
          <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>Unexpected token, expected curly braces</div>
        </div>
      </GlassCard>
      
      <GlassCard style={{ padding: 12, display: 'flex', alignItems: 'flex-start', gap: 12, borderLeft: '4px solid #ff9500' }}>
        <Warning size={20} color="#ff9500" weight="fill" style={{ marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Unused Variable</div>
          <div style={{ fontSize: 12, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>src/shell/ShellRail.tsx:120:5</div>
          <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>'isExpanded' is declared but never read</div>
        </div>
      </GlassCard>
    </div>
  );
}
