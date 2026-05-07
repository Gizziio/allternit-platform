/**
 * ViewToggle - View mode selector dropdown
 * 
 * Based on demo-v3/v4/v5.html design
 * Dropdown positioned on the right side of header
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  SquaresFour,
  Graph,
  Columns,
  Terminal,
  ChartLine,
  CaretDown,
} from '@phosphor-icons/react';
import { SwarmViewMode } from '../types';

const ACCENT = '#c17817';
const BG_SURFACE = '#121110';
const BG_HOVER = 'var(--surface-canvas)';
const BORDER_COLOR = 'var(--ui-border-muted)';
const TEXT_MUTED = 'var(--ui-text-muted)';
const TEXT_COLOR = 'var(--ui-text-primary)';

interface ViewToggleProps {
  current: SwarmViewMode;
  onChange: (mode: SwarmViewMode) => void;
}

type ViewModeEntry = {
  id: SwarmViewMode;
  label: string;
  Icon: React.ElementType;
};

const viewModes: ViewModeEntry[] = [
  { id: 'GRID',     label: 'Grid',     Icon: SquaresFour },
  { id: 'TOPOLOGY', label: 'Topology', Icon: Graph },
  { id: 'KANBAN',   label: 'Kanban',   Icon: Columns },
  { id: 'CONSOLE',  label: 'Console',  Icon: Terminal },
  { id: 'HISTORY',  label: 'History',  Icon: ChartLine },
];

export function ViewToggle({ current, onChange }: ViewToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentMode = viewModes.find(m => m.id === current);
  const CurrentIcon = currentMode?.Icon ?? SquaresFour;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors"
        style={{
          background: BG_SURFACE,
          border: `1px solid ${BORDER_COLOR}`,
          color: TEXT_MUTED,
          minWidth: 120,
          justifyContent: 'space-between',
        }}
      >
        <span className="flex items-center gap-2">
          <CurrentIcon size={12} weight="duotone" color={ACCENT} />
          <span style={{ color: TEXT_COLOR }}>{currentMode?.label}</span>
        </span>
        <CaretDown
          size={10}
          weight="bold"
          color={TEXT_MUTED}
          style={{
            transition: 'transform 0.15s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[160px] rounded-lg overflow-hidden z-50"
          style={{
            background: BG_SURFACE,
            border: `1px solid ${BORDER_COLOR}`,
            boxShadow: '0 8px 24px var(--surface-panel)',
          }}
        >
          {viewModes.map(({ id, label, Icon }) => {
            const isActive = current === id;
            return (
              <button
                key={id}
                onClick={() => { onChange(id); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs transition-colors text-left"
                style={{
                  background: isActive ? 'rgba(193, 120, 23, 0.2)' : 'transparent',
                  color: isActive ? ACCENT : TEXT_MUTED,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = BG_HOVER;
                    e.currentTarget.style.color = TEXT_COLOR;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = TEXT_MUTED;
                  }
                }}
              >
                <Icon size={13} weight={isActive ? 'duotone' : 'regular'} />
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
