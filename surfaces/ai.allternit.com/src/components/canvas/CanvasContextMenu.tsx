"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import {
  ChatTeardropText,
  Browser,
  GitDiff,
  Target,
  SquaresFour,
  GridFour,
  Terminal as TerminalIcon,
  NotePencil,
  BookBookmark,
} from '@phosphor-icons/react';
import type { CodeCanvasTile } from '@/views/code/CodeModeStore';

interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}

interface ContextMenuSection {
  title?: string;
  items: ContextMenuItem[];
}

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onSpawnTile: (type: CodeCanvasTile['type']) => void;
  onArrange: () => void;
  onResetZoom: () => void;
  existingSessions?: Array<{ id: string; name: string }>;
  onSpawnExistingSession?: (sessionId: string) => void;
}

export function CanvasContextMenu({
  x,
  y,
  onClose,
  onSpawnTile,
  onArrange,
  onResetZoom,
  existingSessions,
  onSpawnExistingSession,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const sections: ContextMenuSection[] = [
    {
      title: 'Spawn Tile',
      items: [
        {
          id: 'new-session',
          label: 'New Session',
          icon: <ChatTeardropText size={14} />,
          onClick: () => {
            onSpawnTile('session');
            onClose();
          },
        },
        ...(existingSessions?.length
          ? existingSessions.map((s) => ({
              id: `existing-${s.id}`,
              label: s.name,
              icon: <ChatTeardropText size={14} />,
              onClick: () => {
                onSpawnExistingSession?.(s.id);
                onClose();
              },
            }))
          : []),
        {
          id: 'preview',
          label: 'Preview',
          icon: <Browser size={14} />,
          onClick: () => {
            onSpawnTile('preview');
            onClose();
          },
        },
        {
          id: 'diff',
          label: 'Diff',
          icon: <GitDiff size={14} />,
          onClick: () => {
            onSpawnTile('diff');
            onClose();
          },
        },
        {
          id: 'terminal',
          label: 'Terminal',
          icon: <TerminalIcon size={14} />,
          onClick: () => {
            onSpawnTile('terminal');
            onClose();
          },
        },
        {
          id: 'notes',
          label: 'Notes',
          icon: <NotePencil size={14} />,
          onClick: () => {
            onSpawnTile('notes');
            onClose();
          },
        },
        {
          id: 'knowledge',
          label: 'Knowledge',
          icon: <BookBookmark size={14} />,
          onClick: () => {
            onSpawnTile('knowledge');
            onClose();
          },
        },
      ],
    },
    {
      title: 'View',
      items: [
        {
          id: 'arrange',
          label: 'Arrange All',
          icon: <SquaresFour size={14} />,
          onClick: () => {
            onArrange();
            onClose();
          },
        },
        {
          id: 'reset-zoom',
          label: 'Reset Zoom',
          icon: <Target size={14} />,
          onClick: () => {
            onResetZoom();
            onClose();
          },
        },
      ],
    },
  ];

  // Clamp position to viewport
  const menuWidth = 220;
  const menuHeight = 300;
  const posX = Math.min(x, window.innerWidth - menuWidth - 16);
  const posY = Math.min(y, window.innerHeight - menuHeight - 16);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: posX,
        top: posY,
        zIndex: 165,
        width: menuWidth,
        padding: '6px',
        borderRadius: 12,
        border: '1px solid var(--glass-border)',
        background: 'var(--surface-floating)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: 'var(--shadow-xl)',
        fontSize: 13,
      }}
    >
      {sections.map((section, si) => (
        <React.Fragment key={section.title || si}>
          {si > 0 && (
            <div
              style={{
                height: 1,
                background: 'var(--border-subtle)',
                margin: '4px 0',
              }}
            />
          )}
          {section.title && (
            <div
              style={{
                padding: '4px 8px 2px',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {section.title}
            </div>
          )}
          {section.items.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              disabled={item.disabled}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: item.disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                fontSize: 13,
                textAlign: 'left',
                cursor: item.disabled ? 'default' : 'pointer',
                opacity: item.disabled ? 0.5 : 1,
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) e.currentTarget.style.background = 'var(--surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {item.icon && <span style={{ opacity: 0.7 }}>{item.icon}</span>}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.shortcut && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {item.shortcut}
                </span>
              )}
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}
