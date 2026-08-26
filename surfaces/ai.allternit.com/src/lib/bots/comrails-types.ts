/**
 * CommRails Types
 *
 * Type definitions for the CommRails integration layer.
 * CommRails unifies bot sessions, group chats, swarms, and automation
 * into a single navigable rail surface.
 *
 * @module comrails-types
 */

import type { Icon } from '@phosphor-icons/react';

// ============================================================================
// Section Types
// ============================================================================

export type CommRailSectionType = 'bots' | 'groups' | 'sessions' | 'swarms' | 'automation';

// ============================================================================
// Rail Items
// ============================================================================

export interface CommRailItem {
  id: string;
  label: string;
  icon?: Icon;
  payload: string;
  status?: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  badge?: number;
  accentColor?: string;
  metadata?: Record<string, unknown>;
}

export interface CommRailSection {
  id: string;
  title: string;
  icon?: Icon;
  type: CommRailSectionType;
  items: CommRailItem[];
  isDynamic?: boolean;
  defaultExpanded?: boolean;
  collapsible?: boolean;
}

// ============================================================================
// WIH (Work-In-Hand) Summary
// ============================================================================

export interface WIHSummary {
  taskId: string;
  title: string;
  state: string;
  assignee?: string;
  blockedBy: string[];
  artifacts: string[];
}

// ============================================================================
// Bot Rail Item
// ============================================================================

export interface BotRailItem extends CommRailItem {
  botId: string;
  wihId?: string;
  consensusPhase?: string;
  groupChatEnabled?: boolean;
}

// ============================================================================
// Group Rail Item
// ============================================================================

export interface GroupRailItem extends CommRailItem {
  groupId: string;
  memberCount: number;
  strategy: string;
  consensusThreshold: number;
}
