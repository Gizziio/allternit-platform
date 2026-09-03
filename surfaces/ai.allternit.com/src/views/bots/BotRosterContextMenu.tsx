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
  PushPin,
  PushPinSlash,
  EyeSlash,
  Eye,
  Bell,
  BellSlash,
  Archive,
  Trash,
} from '@phosphor-icons/react';

import {
  TEXT,
  BORDER,
  TYPOGRAPHY,
  RADIUS,
  SAND,
  STATUS,
} from '@/design/allternit.tokens';
import type { BotRosterContextMenuTarget } from '@/lib/bots/bot-roster.store';

export interface BotRosterContextMenuProps {
  target: BotRosterContextMenuTarget;
  isPinned?: boolean;
  isHidden?: boolean;
  unreadCount?: number;
  onStartSession?: (botId: string) => void;
  onEditProfile?: (botId: string) => void;
  onDuplicate?: (botId: string) => void;
  onAddToGroup?: (botId: string) => void;
  onTogglePin?: (botId: string) => void;
  onToggleHide?: (botId: string) => void;
  onMarkRead?: (botId: string) => void;
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
  disabled?: boolean;
  suffix?: React.ReactNode;
}

export function BotRosterContextMenu({
  target,
  isPinned = false,
  isHidden = false,
  unreadCount = 0,
  onStartSession,
  onEditProfile,
  onDuplicate,
  onAddToGroup,
  onTogglePin,
  onToggleHide,
  onMarkRead,
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
      id: 'pin',
      label: isPinned ? 'Unpin' : 'Pin',
      icon: isPinned ? <PushPinSlash size={14} /> : <PushPin size={14} weight="fill" />,
      onClick: () => {
        onTogglePin?.(target.botId);
        onClose?.();
      },
    },
    {
      id: 'hide',
      label: isHidden ? 'Show in roster' : 'Hide',
      icon: isHidden ? <Eye size={14} /> : <EyeSlash size={14} />,
      onClick: () => {
        onToggleHide?.(target.botId);
        onClose?.();
      },
    },
    {
      id: 'mark-read',
      label: 'Mark as read',
      icon: <Bell size={14} />,
      disabled: unreadCount === 0,
      suffix:
        unreadCount > 0 ? (
          <span
            style={{
              marginLeft: 'auto',
              padding: '1px 6px',
              borderRadius: RADIUS.full,
              background: STATUS.warning,
              color: '#1a1612',
              fontSize: 10,
              fontWeight: TYPOGRAPHY.weight.semibold,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null,
      onClick: () => {
        onMarkRead?.(target.botId);
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
          disabled={item.disabled}
          onClick={item.onClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: RADIUS.xs,
            border: 'none',
            background: 'transparent',
            color: item.danger ? '#EF4444' : item.disabled ? TEXT.tertiary : TEXT.secondary,
            fontSize: TYPOGRAPHY.size.xs,
            fontWeight: TYPOGRAPHY.weight.medium,
            textAlign: 'left',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            opacity: item.disabled ? 0.6 : 1,
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => {
            if (item.disabled) return;
            e.currentTarget.style.background = item.danger
              ? 'rgba(239,68,68,0.1)'
              : 'rgba(255,255,255,0.06)';
            e.currentTarget.style.color = item.danger ? '#F87171' : TEXT.primary;
          }}
          onMouseLeave={(e) => {
            if (item.disabled) return;
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = item.danger ? '#EF4444' : TEXT.secondary;
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', opacity: 0.8 }}>
            {item.icon}
          </span>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.suffix}
        </button>
      ))}
    </div>
  );
}

export default BotRosterContextMenu;
