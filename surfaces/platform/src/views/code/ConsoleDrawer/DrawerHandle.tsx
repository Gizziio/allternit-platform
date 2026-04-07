import React from 'react';
import { GlassSurface } from '../../../design/GlassSurface';
import { CaretDoubleUp, CaretDoubleDown } from '@phosphor-icons/react';

interface DrawerHandleProps {
  isOpen: boolean;
  onToggle: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
}

export function DrawerHandle({ isOpen, onToggle, onMouseDown, onTouchStart }: DrawerHandleProps) {
  return (
    <div 
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'flex-end',
        paddingRight: 'max(16px, calc(env(safe-area-inset-right, 0px) + 16px))',
        pointerEvents: 'auto',
        cursor: isOpen ? 'row-resize' : 'pointer',
        paddingBottom: isOpen ? 0 : 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }}
      onMouseDown={isOpen ? onMouseDown : undefined}
      onTouchStart={isOpen && onTouchStart ? onTouchStart : undefined}
      onClick={!isOpen ? onToggle : undefined}
    >
      <GlassSurface
        intensity="thick"
        style={{
          height: 24,
          width: 60,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: isOpen ? 0 : 999,
          borderBottomRightRadius: isOpen ? 0 : 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-subtle)',
          borderBottom: isOpen ? 'none' : '1px solid var(--border-subtle)',
          background: 'var(--glass-bg-thick)',
          boxShadow: isOpen ? '0 -4px 20px rgba(0,0,0,0.1)' : '0 10px 24px rgba(0,0,0,0.22)',
          transition: 'transform 0.2s',
          transform: isOpen ? 'translateY(1px)' : 'translateY(0)',
        }}
      >
        {isOpen ? <CaretDoubleDown size={14} color="var(--text-tertiary)" /> : <CaretDoubleUp size={14} color="var(--text-tertiary)" />}
      </GlassSurface>
    </div>
  );
}
