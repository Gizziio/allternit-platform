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
        width: 'fit-content',
        marginLeft: 'auto',
        display: 'flex',
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
          height: 18,
          width: 40,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderBottomLeftRadius: isOpen ? 0 : 999,
          borderBottomRightRadius: isOpen ? 0 : 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-subtle)',
          borderBottom: isOpen ? 'none' : '1px solid var(--border-subtle)',
          background: 'var(--glass-bg-thick)',
          boxShadow: isOpen ? '0 -2px 12px rgba(0,0,0,0.08)' : '0 4px 12px rgba(0,0,0,0.14)',
          transition: 'transform 0.2s',
          transform: isOpen ? 'translateY(1px)' : 'translateY(0)',
        }}
      >
        {isOpen ? <CaretDoubleDown size={10} color="var(--text-tertiary)" /> : <CaretDoubleUp size={10} color="var(--text-tertiary)" />}
      </GlassSurface>
    </div>
  );
}
