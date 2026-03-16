import React from 'react';
import { GlassSurface } from '../../../design/GlassSurface';
import { CaretDoubleUp, CaretDoubleDown } from '@phosphor-icons/react';

interface DrawerHandleProps {
  isOpen: boolean;
  onToggle: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function DrawerHandle({ isOpen, onToggle, onMouseDown }: DrawerHandleProps) {
  return (
    <div 
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'flex-end',
        paddingRight: 16,
        pointerEvents: 'auto',
        cursor: isOpen ? 'row-resize' : 'pointer',
        paddingBottom: isOpen ? 0 : 8,
      }}
      onMouseDown={isOpen ? onMouseDown : undefined}
      onClick={!isOpen ? onToggle : undefined}
    >
      <GlassSurface
        intensity="thick"
        style={{
          height: 24,
          width: 60,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-subtle)',
          borderBottom: 'none',
          background: 'var(--glass-bg-thick)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
          transition: 'transform 0.2s',
          transform: isOpen ? 'translateY(1px)' : 'translateY(0)',
        }}
      >
        {isOpen ? <CaretDoubleDown size={14} color="var(--text-tertiary)" /> : <CaretDoubleUp size={14} color="var(--text-tertiary)" />}
      </GlassSurface>
    </div>
  );
}
