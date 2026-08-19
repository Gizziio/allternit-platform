"use client";

/**
 * Bot Roster Item
 *
 * Single bot card rendered inside BotRoster. Handles selection, hover,
 * context-menu invocation, and quick actions.
 *
 * @module BotRosterItem
 */

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Gear, Play } from '@phosphor-icons/react';
import type { BotAvatar } from '@/lib/bots/bot-avatar.service';
import { BotAvatar as BotAvatarRenderer } from './BotAvatar';

import {
  TEXT,
  BORDER,
  TYPOGRAPHY,
  RADIUS,
  ANIMATION,
  SAND,
} from '@/design/allternit.tokens';

export type BotItemStatus = 'idle' | 'busy' | 'error';

export interface BotRosterItemData {
  id: string;
  displayName: string;
  slug: string;
  tagline: string;
  status: BotItemStatus;
  accentColor?: string;
  avatar?: BotAvatar;
  lastMessage?: string;
  lastActiveAt?: string;
}

export interface BotRosterItemProps {
  bot: BotRosterItemData;
  isSelected?: boolean;
  onSelect?: (botId: string) => void;
  onContextMenu?: (e: React.MouseEvent, botId: string) => void;
  onStartSession?: (botId: string) => void;
  onOpenSettings?: (botId: string) => void;
}

export function BotRosterItem({
  bot,
  isSelected = false,
  onSelect,
  onContextMenu,
  onStartSession,
  onOpenSettings,
}: BotRosterItemProps) {
  const handleClick = useCallback(() => {
    onSelect?.(bot.id);
  }, [bot.id, onSelect]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      onContextMenu?.(e, bot.id);
    },
    [bot.id, onContextMenu],
  );

  const handleStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onStartSession?.(bot.id);
    },
    [bot.id, onStartSession],
  );

  const handleSettings = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenSettings?.(bot.id);
    },
    [bot.id, onOpenSettings],
  );

  const statusColor =
    bot.status === 'busy' ? '#F59E0B' : bot.status === 'error' ? '#EF4444' : '#22C55E';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: RADIUS.sm,
        background: isSelected ? `${bot.accentColor ?? SAND[500]}14` : 'transparent',
        border: `1px solid ${isSelected ? bot.accentColor ?? BORDER.focus : 'transparent'}`,
        cursor: 'pointer',
        transition: `background ${ANIMATION.fast}, border-color ${ANIMATION.fast}`,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {/* Status dot */}
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: statusColor,
          boxShadow: `0 0 0 2px ${isSelected ? `${bot.accentColor ?? SAND[500]}14` : 'var(--shell-rail-bg, #1A1612)'}`,
        }}
      />

      {/* Avatar */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: RADIUS.sm,
          background: `${bot.accentColor ?? SAND[500]}1A`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <BotAvatarRenderer avatar={bot.avatar} name={bot.displayName} size={34} />
      </div>

      {/* Text */}
      <div
        style={{
          minWidth: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: TYPOGRAPHY.size.xs,
            fontWeight: TYPOGRAPHY.weight.medium,
            color: isSelected ? TEXT.primary : TEXT.secondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {bot.displayName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: TEXT.tertiary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: TYPOGRAPHY.lineHeight.normal,
          }}
        >
          {bot.lastMessage ?? bot.tagline}
        </div>
      </div>

      {/* Quick actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          opacity: 0,
          transition: `opacity ${ANIMATION.fast}`,
        }}
        className="bot-roster-item-actions"
      >
        <button
          type="button"
          title="Start session"
          onClick={handleStart}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: RADIUS.xs,
            border: 'none',
            background: 'transparent',
            color: TEXT.tertiary,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.color = TEXT.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = TEXT.tertiary;
          }}
        >
          <Play size={14} weight="fill" />
        </button>
        <button
          type="button"
          title="Settings"
          onClick={handleSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: RADIUS.xs,
            border: 'none',
            background: 'transparent',
            color: TEXT.tertiary,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.color = TEXT.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = TEXT.tertiary;
          }}
        >
          <Gear size={14} />
        </button>
      </div>

      <style>{`
        .bot-roster-item-actions {
          opacity: 0;
        }
        [class*="bot-roster-item"]:hover .bot-roster-item-actions {
          opacity: 1;
        }
      `}</style>
    </motion.div>
  );
}

export default BotRosterItem;
