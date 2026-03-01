import React from 'react';
import { tokens } from '../tokens';

export function SegmentedControl({ options, value, onChange }: any) {
  return (
    <div style={{
      display: 'flex',
      background: 'rgba(30, 30, 40, 0.4)',
      padding: 4,
      borderRadius: 12,
      gap: 2,
      border: '1px solid rgba(255, 255, 255, 0.1)',
    }}>
      {options.map((opt: any) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: 'none',
            background: value === opt.value ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            color: value === opt.value ? tokens.colors.textPrimary : tokens.colors.textTertiary,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            transition: 'all 0.2s ' + tokens.motion.base,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
