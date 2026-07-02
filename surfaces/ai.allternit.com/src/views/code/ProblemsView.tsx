import React from 'react';
import { GlassCard } from '../../design/glass/GlassCard';
import { Warning, XCircle } from '@phosphor-icons/react';

export function ProblemsView(): React.ReactNode {
  return (
    <div className="p-5 flex flex-col gap-3">
      <GlassCard className="p-3 flex items-start gap-3 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff3b30]" />
        <XCircle size={20} color="#ff3b30" weight="fill" className="mt-0.5" />
        <div>
          <div className="font-semibold text-[13px] mb-1">Syntax Error</div>
          <div className="text-[12px] opacity-70 font-mono">src/views/code/CodeCanvas.tsx:44:12</div>
          <div className="text-[12px] mt-1 text-[var(--text-secondary)]">Unexpected token, expected curly braces</div>
        </div>
      </GlassCard>
      
      <GlassCard className="p-3 flex items-start gap-3 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff9500]" />
        <Warning size={20} color="#ff9500" weight="fill" className="mt-0.5" />
        <div>
          <div className="font-semibold text-[13px] mb-1">Unused Variable</div>
          <div className="text-[12px] opacity-70 font-mono">src/shell/ShellRail.tsx:120:5</div>
          <div className="text-[12px] mt-1 text-[var(--text-secondary)]">'isExpanded' is declared but never read</div>
        </div>
      </GlassCard>
    </div>
  );
}
