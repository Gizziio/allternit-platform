import React from 'react';
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
      data-testid="console-drawer-handle"
      role="button"
      tabIndex={0}
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        pointerEvents: 'auto',
        cursor: isOpen ? 'row-resize' : 'pointer',
        paddingBottom: isOpen ? 0 : 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }}
      onMouseDown={isOpen ? onMouseDown : undefined}
      onTouchStart={isOpen && onTouchStart ? onTouchStart : undefined}
      onClick={!isOpen ? onToggle : undefined}
    >
      <div
        style={{
          height: isOpen ? 22 : 32,
          padding: isOpen ? '0 14px' : '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          border: '1px solid var(--border-subtle)',
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          borderBottomLeftRadius: isOpen ? 0 : 999,
          borderBottomRightRadius: isOpen ? 0 : 999,
          background: 'var(--surface-floating)',
          backdropFilter: 'blur(18px) saturate(180%)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
          boxShadow: isOpen ? 'var(--shadow-sm)' : 'var(--shadow-lg)',
          transition: 'all 0.2s ease',
          transform: isOpen ? 'translateY(1px)' : 'translateY(0)',
        }}
      >
        {!isOpen && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              letterSpacing: '0.04em',
            }}
          >
            Mission Control
          </span>
        )}
        <CaretDoubleUp
          size={isOpen ? 12 : 14}
          weight="bold"
          color="var(--accent-mission, #ffb800)"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
        />
      </div>
    </div>
  );
}
