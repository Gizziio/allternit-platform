"use client";

/**
 * Bot Roster Context Menu
 *
 * Right-click menu for a bot roster item. Anchored to the cursor position.
 *
 * @module BotRosterContextMenu
 */

import React, { useEffect, useRef } from 'react';
import {
  Play,
  PencilSimple,
  Copy,
  Users,
  Archive,
  Trash,
} from '@phosphor-icons/react';

import {
  TEXT,
  BORDER,
  TYPOGRAPHY,
  RADIUS,
  SAND,
} from '@/design/allternit.tokens';
import type { BotRosterContextMenuTarget } from '@/lib/bots/bot-roster.store';

export interface BotRosterContextMenuProps {
  target: BotRosterContextMenuTarget;
  onStartSession?: (botId: string) => void;
  onEditProfile?: (botId: string) => void;
  onDuplicate?: (botId: string) => void;
  onAddToGroup?: (botId: string) => void;
  onArchive?: (botId: string) => void;
  onDelete?: (botId: string) => void;
  onClose?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

export function BotRosterContextMenu({
  target,
  onStartSession,
  onEditProfile,
  onDuplicate,
  onAddToGroup,
  onArchive,
  onDelete,
  onClose,
}: BotRosterContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose?.();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose?.();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const items: MenuItem[] = [
    {
      id: 'start',
      label: 'Start session',
      icon: <Play size={14} weight="fill" />,
      onClick: () => {
        onStartSession?.(target.botId);
        onClose?.();
      },
    },
    {
      id: 'edit',
      label: 'Edit profile',
      icon: <PencilSimple size={14} />,
      onClick: () => {
        onEditProfile?.(target.botId);
        onClose?.();
      },
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: <Copy size={14} />,
      onClick: () => {
        onDuplicate?.(target.botId);
        onClose?.();
      },
    },
    {
      id: 'group',
      label: 'Add to group',
      icon: <Users size={14} />,
      onClick: () => {
        onAddToGroup?.(target.botId);
        onClose?.();
      },
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: <Archive size={14} />,
      onClick: () => {
        onArchive?.(target.botId);
        onClose?.();
      },
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash size={14} />,
      danger: true,
      onClick: () => {
        onDelete?.(target.botId);
        onClose?.();
      },
    },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: target.x,
        top: target.y,
        zIndex: 1000,
        minWidth: 160,
        background: 'var(--shell-surface-bg, #252019)',
        border: `1px solid ${BORDER.default}`,
        borderRadius: RADIUS.sm,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        padding: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: RADIUS.xs,
            border: 'none',
            background: 'transparent',
            color: item.danger ? '#EF4444' : TEXT.secondary,
            fontSize: TYPOGRAPHY.size.xs,
            fontWeight: TYPOGRAPHY.weight.medium,
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = item.danger
              ? 'rgba(239,68,68,0.1)'
              : 'rgba(255,255,255,0.06)';
            e.currentTarget.style.color = item.danger ? '#F87171' : TEXT.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = item.danger ? '#EF4444' : TEXT.secondary;
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', opacity: 0.8 }}>
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default BotRosterContextMenu;
