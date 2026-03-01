import React from 'react';
import { tokens } from '../tokens';

export function IconButton({ icon: Icon, onClick, active, title, size = 20 }: any) {
  return (
    <button 
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 10,
        border: '1px solid ' + (active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'),
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: active ? tokens.colors.textPrimary : tokens.colors.textSecondary,
        cursor: 'pointer',
        transition: 'all 0.2s ' + tokens.motion.base,
      }}
    >
      <Icon size={size} weight={active ? 'duotone' : 'regular'} />
    </button>
  );
}
