import React from 'react';
import { m } from 'framer-motion';
import type { AgentModeGizziTheme } from '../AgentModeGizzi.types';

interface GizziThoughtBubbleProps {
  thought: string;
  thoughtIndex: number;
  theme: AgentModeGizziTheme;
}

export const GizziThoughtBubble = React.memo(({ thought, thoughtIndex, theme }: GizziThoughtBubbleProps) => {
  return (
    <m.div
      key={`bubble-${thoughtIndex}`}
      initial={{ opacity: 0, y: 8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none"
    >
      <div
        className="flex flex-col items-start gap-1.5 w-[236px] p-[10px_12px] rounded-[18px] border border-solid bg-[rgba(14,17,20,0.82)] backdrop-blur-md shadow-lg"
        style={{
          borderColor: theme.soft,
          boxShadow: `0 14px 32px ${theme.glow}`,
        }}
      >
        <div
          className="inline-flex items-center gap-2 text-[rgba(236,236,236,0.72)] text-[12px] font-bold tracking-[0.18em] uppercase"
        >
          <span style={{ color: theme.accent }}>Gizzi</span>
          <span className="opacity-40">/</span>
          <span>A://TERNIT agent</span>
        </div>
        <div
          data-testid="agent-mode-gizzi-thought"
          className="text-[12px] leading-[1.45] text-[rgba(236,236,236,0.9)] text-left tracking-[-0.01em]"
        >
          {thought}
        </div>
      </div>
      {/* Bubble tail */}
      <div className="relative w-[34px] h-[28px] mx-auto mt-1">
        <span className="absolute top-0 left-[14px] size-2 rounded-full" style={{ background: theme.soft }} />
        <span className="absolute top-[10px] left-2 size-[5px] rounded-full opacity-75" style={{ background: theme.soft }} />
        <span className="absolute top-[20px] left-[3px] size-[3px] rounded-full opacity-60" style={{ background: theme.soft }} />
      </div>
    </m.div>
  );
});

GizziThoughtBubble.displayName = 'GizziThoughtBubble';
