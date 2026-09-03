"use client";

/**
 * Bot Roster Panel
 *
 * 280px-wide persistent sidebar that lists all available bots.
 * Provides:
 *   - Search bar filtering by name / description / tags
 *   - Bot cards with custom icons, display names, taglines, status dots
 *   - Active / selected bot highlighted with accent-colour border
 *   - Right-click context menu (Start Session, Edit, Duplicate, Delete)
 *   - "+ New Bot" button at the bottom
 *   - Empty state with illustration
 *
 * Composes BotRosterItem and BotRosterContextMenu.
 *
 * @module BotRoster
 */

import React, { useMemo, useCallback, useState } from 'react';
import {
  MagnifyingGlass,
  Plus,
  SortAscending,
  Robot,
  X,
  SidebarSimple,
  PushPin,
  Users,
  CaretDown,
  CaretRight,
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

import { createModuleLogger } from '@/lib/logger';
import { useAgentStore } from '@/lib/agents/agent.store';
import { agentToCreateAgentInput } from '@/lib/bots/bot-profile';
import { openBotCanonicalChat } from '@/lib/bots/bot-canonical-chat.service';
import { resolveBotAvatar } from '@/lib/bots/bot-avatar.service';
import { useBotOperationalStateStore } from '@/lib/bots/bot-operational-state.store';
import { useUnifiedRoster, type UnifiedRosterBot } from '@/lib/bots/use-unified-roster';
import {
  useBotRosterStore,
  type BotRosterSortBy,
} from '@/lib/bots/bot-roster.store';
import { useGroupChatStore } from '@/lib/bots/group-chat.store';
import {
  TEXT,
  BORDER,
  TYPOGRAPHY,
  RADIUS,
  ANIMATION,
  SAND,
} from '@/design/allternit.tokens';

import { BotRosterItem, type BotRosterItemData, type BotItemStatus } from './BotRosterItem';
import { BotRosterContextMenu } from './BotRosterContextMenu';
import { GroupChatRosterItem } from './GroupChatRosterItem';
import { GroupChatChannelDialog, type GroupChatChannelFormData } from './GroupChatChannelDialog';

const logger = createModuleLogger('BotRoster');

// ============================================================================
// Constants
// ============================================================================

const PANEL_WIDTH = 280;
const COMPACT_PANEL_WIDTH = 72;

const SORT_OPTIONS: { value: BotRosterSortBy; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'lastActive', label: 'Last Active' },
  { value: 'status', label: 'Status' },
];

// ============================================================================
// Helpers
// ============================================================================

/** Build a BotRosterItemData record from a unified roster bot. */
function botToItem(bot: UnifiedRosterBot): BotRosterItemData {
  return {
    id: bot.id,
    displayName: bot.displayName,
    slug: bot.handle,
    tagline: bot.tagline,
    accentColor: bot.accentColor ?? '#6b7280',
    avatar: resolveBotAvatar(bot.id, bot.agent.botProfile?.avatar),
    status: mapAgentStatus(bot.status),
    lastMessage: undefined, // Will be populated by commrails data in future
    lastActiveAt: bot.updatedAt,
  };
}

function mapAgentStatus(status?: string): BotItemStatus {
  switch (status) {
    case 'running':
    case 'working':
    case 'responding':
      return 'busy';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.1 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      {/* Illustration — stylised robot silhouette */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: RADIUS.lg,
          background: `${SAND[500]}10`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Robot size={36} style={{ color: SAND[500], opacity: 0.5 }} weight="duotone" />
      </div>

      <div
        style={{
          fontSize: TYPOGRAPHY.size.sm,
          fontWeight: TYPOGRAPHY.weight.medium,
          color: TEXT.secondary,
          marginBottom: 4,
        }}
      >
        {searchQuery ? 'No bots match your search' : 'No bots available'}
      </div>

      <div
        style={{
          fontSize: TYPOGRAPHY.size.xs,
          color: TEXT.tertiary,
          lineHeight: TYPOGRAPHY.lineHeight.relaxed,
          maxWidth: 200,
        }}
      >
        {searchQuery
          ? `Try adjusting or clearing your search for "${searchQuery}".`
          : 'Create your first bot to get started with AI-powered automation.'}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Sort Dropdown
// ============================================================================

function SortDropdown({
  value,
  onChange,
}: {
  value: BotRosterSortBy;
  onChange: (v: BotRosterSortBy) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((p) => !p)}
        title="Sort bots"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          border: 'none',
          borderRadius: RADIUS.xs,
          background: open ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: open ? TEXT.primary : TEXT.tertiary,
          cursor: 'pointer',
          transition: `all ${ANIMATION.fast}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = TEXT.secondary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = open ? TEXT.primary : TEXT.tertiary;
        }}
      >
        <SortAscending size={15} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 9990 }}
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                zIndex: 9991,
                background: 'var(--bg-elevated, #2A211A)',
                border: `1px solid ${BORDER.default}`,
                borderRadius: RADIUS.sm,
                padding: '4px 0',
                minWidth: 130,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 12px',
                    border: 'none',
                    background:
                      value === opt.value ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: value === opt.value ? TEXT.primary : TEXT.secondary,
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: `background ${ANIMATION.fast}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      value === opt.value ? 'rgba(255,255,255,0.06)' : 'transparent';
                  }}
                >
                  {value === opt.value && (
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: SAND[500],
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span>{opt.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Compact icon button (used in the nested shell-rail variant)
// ============================================================================

function IconButton({
  icon: Icon,
  title,
  isActive,
  onClick,
  children,
}: {
  icon: React.ElementType;
  title: string;
  isActive?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        border: 'none',
        borderRadius: RADIUS.xs,
        background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
        color: isActive ? 'var(--shell-item-fg, #E8E3DD)' : 'var(--shell-item-muted, #9C958C)',
        cursor: 'pointer',
        transition: `all ${ANIMATION.fast}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.color = 'var(--shell-item-fg, #E8E3DD)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.10)' : 'transparent';
        e.currentTarget.style.color = isActive ? 'var(--shell-item-fg, #E8E3DD)' : 'var(--shell-item-muted, #9C958C)';
      }}
    >
      {children ?? <Icon size={11} />}
    </button>
  );
}

// ============================================================================
// Nested icon toolbar (shell-rail variant)
// ============================================================================

function NestedToolbar({
  onNewBot,
  onNewChannel,
}: {
  onNewBot: () => void;
  onNewChannel: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 1,
      }}
    >
      <IconButton icon={Plus} title="New bot" onClick={onNewBot} />
      <IconButton icon={Users} title="New channel" onClick={onNewChannel} />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface BotRosterProps {
  /** When true, renders as a nested panel inside the shell rail instead of a standalone sidebar. */
  nested?: boolean;
  /** When provided alongside `nested`, controls whether the nested roster section is expanded. */
  expanded?: boolean;
  /** Callback when the nested roster section expand/collapse header is toggled. */
  onToggleExpanded?: () => void;
  /** Callback when user clicks "+ New Bot" */
  onNewBot?: () => void;
  /** Callback when user starts a session with a bot */
  onStartSession?: (botId: string, sessionId?: string) => void;
  /** Callback when user wants to edit a bot profile */
  onEditProfile?: (botId: string) => void;
  /** Callback when user wants to navigate (e.g. open agent hub) */
  onNavigate?: (view: string, params?: Record<string, string>) => void;
  /** Callback when a bot is duplicated (after the creation draft is staged). */
  onDuplicate?: (sourceBotId: string) => void;
  /** Callback when a bot is archived. */
  onArchive?: (botId: string) => void;
  /** Callback when a bot is deleted. */
  onDelete?: (botId: string) => void;
  /** Callback when user selects a group channel. */
  onSelectGroup?: (groupId: string) => void;
  /** Callback when user creates a new group channel. */
  onNewGroup?: (groupId: string) => void;
}

export function BotRoster({
  nested = false,
  expanded,
  onToggleExpanded,
  onNewBot,
  onStartSession,
  onEditProfile,
  onNavigate,
  onDuplicate,
  onArchive,
  onDelete,
  onSelectGroup,
  onNewGroup,
}: BotRosterProps) {
  // ── Agent store CRUD ──────────────────────────────────────────────────────
  const deleteAgent = useAgentStore((s) => s.deleteAgent);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const setDraftAgent = useAgentStore((s) => s.setDraftAgent);
  const setIsCreating = useAgentStore((s) => s.setIsCreating);
  const setIsEditing = useAgentStore((s) => s.setIsEditing);

  // ── Store state ───────────────────────────────────────────────────────────
  const selectedBotId = useBotRosterStore((s) => s.selectedBotId);
  const searchQuery = useBotRosterStore((s) => s.searchQuery);
  const sortBy = useBotRosterStore((s) => s.sortBy);
  const contextMenuTarget = useBotRosterStore((s) => s.contextMenuTarget);
  const pinnedBotIds = useBotRosterStore((s) => s.pinnedBotIds);
  const hiddenBotIds = useBotRosterStore((s) => s.hiddenBotIds);
  const isCompact = useBotRosterStore((s) => s.isCompact);

  const selectBot = useBotRosterStore((s) => s.selectBot);
  const setSearch = useBotRosterStore((s) => s.setSearch);
  const setSort = useBotRosterStore((s) => s.setSort);
  const showContextMenu = useBotRosterStore((s) => s.showContextMenu);
  const hideContextMenu = useBotRosterStore((s) => s.hideContextMenu);
  const togglePin = useBotRosterStore((s) => s.togglePin);
  const toggleHide = useBotRosterStore((s) => s.toggleHide);
  const toggleCompact = useBotRosterStore((s) => s.toggleCompact);
  const markBotRead = useBotOperationalStateStore((s) => s.markRead);

  // ── Group chat channels ───────────────────────────────────────────────────
  const groupChats = useGroupChatStore((s) => s.groups);
  const activeGroupId = useGroupChatStore((s) => s.activeGroupId);
  const getUnreadCount = useGroupChatStore((s) => s.getUnreadCount);
  const createGroup = useGroupChatStore((s) => s.createGroup);
  const [showGroupDialog, setShowGroupDialog] = useState(false);

  // ── Unified roster (native + stacked) ─────────────────────────────────────
  const roster = useUnifiedRoster();
  const allItems = useMemo(() => roster.map(botToItem), [roster]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let items = allItems;

    // Hidden bots are removed from the active roster unless the user is
    // searching for them explicitly.
    if (!searchQuery.trim()) {
      items = items.filter((item) => !hiddenBotIds.includes(item.id));
    }

    if (!searchQuery.trim()) return items;

    const q = searchQuery.toLowerCase();
    return items.filter((item) => {
      const bot = roster.find((b) => b.id === item.id);
      const agent = bot?.agent;

      return (
        item.displayName.toLowerCase().includes(q) ||
        item.tagline.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        (agent?.tags ?? []).some((tag: string) => tag.toLowerCase().includes(q)) ||
        (agent?.description ?? '').toLowerCase().includes(q) ||
        (bot?.providerId ?? '').toLowerCase().includes(q)
      );
    });
  }, [allItems, roster, searchQuery, hiddenBotIds]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sortedItems = useMemo(() => {
    const items = [...filteredItems];

    switch (sortBy) {
      case 'name':
        items.sort((a, b) => a.displayName.localeCompare(b.displayName));
        break;
      case 'lastActive':
        items.sort((a, b) => {
          const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
          const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
          return tb - ta; // Most recent first
        });
        break;
      case 'status': {
        const order: Record<BotItemStatus, number> = { busy: 0, error: 1, idle: 2 };
        items.sort((a, b) => order[a.status] - order[b.status]);
        break;
      }
    }

    // Pinned bots always float to the top, preserving the chosen sort within
    // each section.
    items.sort((a, b) => {
      const aPinned = pinnedBotIds.includes(a.id) ? 1 : 0;
      const bPinned = pinnedBotIds.includes(b.id) ? 1 : 0;
      return bPinned - aPinned;
    });

    return items;
  }, [filteredItems, sortBy, pinnedBotIds]);

  // ── Context menu handlers ─────────────────────────────────────────────────
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, botId: string) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu({ botId, x: e.clientX, y: e.clientY });
    },
    [showContextMenu],
  );

  const handleStartSession = useCallback(
    async (botId: string) => {
      logger.info(`Start session for bot: ${botId}`);
      selectBot(botId);

      const item = sortedItems.find((i) => i.id === botId);
      let sessionId: string | undefined;
      try {
        sessionId = await openBotCanonicalChat({
          botId,
          botName: item?.displayName ?? botId,
          setActive: true,
        });
      } catch (err) {
        logger.error({ err, botId }, 'Failed to open canonical bot chat');
      }

      onStartSession?.(botId, sessionId);
    },
    [selectBot, onStartSession, sortedItems],
  );

  const handleEditProfile = useCallback(
    (botId: string) => {
      logger.info(`Edit profile for bot: ${botId}`);
      const bot = roster.find((b) => b.id === botId);
      if (!bot) return;

      setIsEditing(bot.agent.id);
      onEditProfile?.(botId);
      window.dispatchEvent(
        new CustomEvent('allternit:open-view', { detail: { viewType: 'agent-hub' } }),
      );
    },
    [onEditProfile, roster, setIsEditing],
  );

  const handleDuplicate = useCallback(
    (botId: string) => {
      logger.info(`Duplicate bot: ${botId}`);
      const bot = roster.find((b) => b.id === botId);
      if (!bot) {
        logger.warn(`No roster bot found for: ${botId}`);
        return;
      }

      try {
        const draft = agentToCreateAgentInput(bot.agent);
        draft.name = `${draft.name ?? bot.displayName} (Copy)`;
        draft.botProfile = {
          ...(draft.botProfile ?? bot.agent.botProfile ?? {}),
          displayName: `${bot.displayName} (Copy)`,
          handle: undefined,
          lifecycle: 'draft',
        };

        setDraftAgent(draft);
        setIsCreating(true);
        onDuplicate?.(botId);
        window.dispatchEvent(
          new CustomEvent('allternit:open-view', { detail: { viewType: 'agent-hub' } }),
        );
      } catch (err) {
        logger.error(
          { botId, error: err instanceof Error ? err.message : String(err) },
          'Failed to duplicate bot',
        );
      } finally {
        hideContextMenu();
      }
    },
    [onDuplicate, hideContextMenu, roster, setDraftAgent, setIsCreating],
  );

  const handleAddToGroup = useCallback(
    (botId: string) => {
      logger.info(`Add to group for bot: ${botId}`);
      onNavigate?.('group-picker', { botId });
    },
    [onNavigate],
  );

  const handleArchive = useCallback(
    async (botId: string) => {
      const bot = roster.find((b) => b.id === botId);
      if (!bot) return;

      if (bot.source !== 'native') {
        window.alert('External stacked bots cannot be archived from Allternit.');
        return;
      }

      const confirmed = window.confirm(
        `Archive this bot? It will be hidden from the roster but can be restored later.`,
      );
      if (!confirmed) return;

      try {
        await updateAgent(bot.agent.id, {
          botProfile: {
            displayName: bot.agent.botProfile?.displayName ?? bot.displayName,
            ...bot.agent.botProfile,
            lifecycle: 'archived',
          },
        });
        logger.info(`Archived bot: ${botId}`);
        onArchive?.(botId);
      } catch (err) {
        logger.error(
          { botId, error: err instanceof Error ? err.message : String(err) },
          'Failed to archive bot',
        );
      } finally {
        hideContextMenu();
      }
    },
    [onArchive, hideContextMenu, roster, updateAgent],
  );

  const handleDelete = useCallback(
    async (botId: string) => {
      const bot = roster.find((b) => b.id === botId);
      if (!bot) return;

      if (bot.source !== 'native') {
        window.alert('External stacked bots cannot be deleted from Allternit.');
        return;
      }

      const confirmed = window.confirm(
        `Permanently delete this bot? This action cannot be undone.`,
      );
      if (!confirmed) return;

      try {
        await deleteAgent(bot.agent.id);
        logger.info(`Deleted bot: ${botId}`);
        if (selectedBotId === botId) selectBot(null);
        onDelete?.(botId);
      } catch (err) {
        logger.error(
          { botId, error: err instanceof Error ? err.message : String(err) },
          'Failed to delete bot',
        );
      } finally {
        hideContextMenu();
      }
    },
    [onDelete, deleteAgent, hideContextMenu, roster, selectedBotId, selectBot],
  );

  const handleSelect = useCallback(
    (botId: string) => {
      selectBot(botId);
      onStartSession?.(botId);
    },
    [selectBot, onStartSession],
  );

  const handleTogglePin = useCallback(
    (botId: string) => {
      togglePin(botId);
      logger.info(`Toggled pin for bot: ${botId}`);
    },
    [togglePin],
  );

  const handleToggleHide = useCallback(
    (botId: string) => {
      toggleHide(botId);
      logger.info(`Toggled hide for bot: ${botId}`);
      if (selectedBotId === botId) {
        selectBot(null);
      }
    },
    [toggleHide, selectedBotId, selectBot],
  );

  const handleMarkRead = useCallback(
    (botId: string) => {
      markBotRead(botId);
      logger.info(`Marked bot read: ${botId}`);
    },
    [markBotRead],
  );

  const handleSelectGroup = useCallback(
    (groupId: string) => {
      logger.info(`Selected group channel: ${groupId}`);
      onSelectGroup?.(groupId);
    },
    [onSelectGroup],
  );

  const handleCreateGroup = useCallback(
    (data: GroupChatChannelFormData) => {
      const groupId = createGroup(data.name, data.members, data.metadata);
      logger.info(`Created group channel: ${groupId}`);
      onNewGroup?.(groupId);
      handleSelectGroup(groupId);
    },
    [createGroup, onNewGroup, handleSelectGroup],
  );

  const handleCreateDemoGroup = useCallback(() => {
    const members = roster.slice(0, 3).map((bot) => ({
      botId: bot.id,
      displayName: bot.displayName,
      handle: bot.handle,
      source: bot.source,
      providerId: bot.providerId,
    }));
    if (members.length < 2) {
      logger.warn('Not enough bots to create a demo group');
      return;
    }
    const groupId = createGroup('OpenMausBot Squad', members, {
      bulletin: 'Demo group chat for the OpenMausBot squad.',
    });
    logger.info(`Created demo group: ${groupId}`);
    onSelectGroup?.(groupId);
    if (!onSelectGroup) {
      window.dispatchEvent(
        new CustomEvent('allternit:open-view', {
          detail: { viewType: 'group-chat', context: { groupId } },
        }),
      );
    }
  }, [roster, createGroup, onSelectGroup]);

  const contextMenuBotId = contextMenuTarget?.botId;
  const contextMenuIsPinned = contextMenuBotId ? pinnedBotIds.includes(contextMenuBotId) : false;
  const contextMenuIsHidden = contextMenuBotId ? hiddenBotIds.includes(contextMenuBotId) : false;
  const contextMenuUnreadCount = useBotOperationalStateStore((s) =>
    contextMenuBotId
      ? (s.projections[contextMenuBotId]?.state.unreadMessagesCount ?? 0)
      : 0,
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: nested ? undefined : (isCompact ? COMPACT_PANEL_WIDTH : PANEL_WIDTH),
        height: nested ? undefined : '100%',
        display: 'flex',
        flexDirection: 'column',
        background: nested ? 'transparent' : 'var(--shell-rail-bg, #1A1612)',
        borderRight: nested ? 'none' : `1px solid ${BORDER.subtle}`,
        overflow: 'hidden',
        flexShrink: 0,
        flex: nested ? 1 : undefined,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: nested ? '4px 8px' : '14px 14px 10px',
          borderBottom: nested ? 'none' : `1px solid ${BORDER.subtle}`,
        }}
      >
        {nested ? (
          <NestedToolbar
            onNewBot={() => {
              logger.info('New Bot clicked');
              setDraftAgent({
                isBot: true,
                botProfile: {
                  displayName: '',
                  tagline: '',
                  welcomeMessage: '',
                  starterPrompts: [],
                  accentColor: '#6366f1',
                  groupChatEnabled: true,
                  botCategory: 'custom',
                  lifecycle: 'draft',
                },
              });
              setIsCreating(true);
              onNewBot?.();
              window.dispatchEvent(
                new CustomEvent('allternit:open-view', { detail: { viewType: 'agent-hub' } }),
              );
            }}
            onNewChannel={() => setShowGroupDialog(true)}
          />
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: TYPOGRAPHY.size.sm,
                  fontWeight: TYPOGRAPHY.weight.semibold,
                  color: TEXT.primary,
                  letterSpacing: '0.01em',
                }}
              >
                Bots
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: TEXT.tertiary,
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    padding: '1px 7px',
                  }}
                >
                  {sortedItems.length}
                </span>

                <SortDropdown value={sortBy} onChange={setSort} />

                <button
                  onClick={toggleCompact}
                  title={isCompact ? 'Expand roster' : 'Collapse roster'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    border: 'none',
                    borderRadius: RADIUS.xs,
                    background: isCompact ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: isCompact ? TEXT.primary : TEXT.tertiary,
                    cursor: 'pointer',
                    transition: `all ${ANIMATION.fast}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = TEXT.secondary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = isCompact ? TEXT.primary : TEXT.tertiary;
                  }}
                >
                  <SidebarSimple size={15} />
                </button>
              </div>
            </div>

            {/* ── Search bar ─────────────────────────────────────────────────── */}
            {!isCompact && (
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <MagnifyingGlass
                  size={14}
                  style={{
                    position: 'absolute',
                    left: 10,
                    color: TEXT.tertiary,
                    pointerEvents: 'none',
                  }}
                />

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bots…"
                  style={{
                    width: '100%',
                    padding: '7px 30px 7px 30px',
                    border: `1px solid ${BORDER.subtle}`,
                    borderRadius: RADIUS.sm,
                    background: 'rgba(0,0,0,0.2)',
                    color: TEXT.primary,
                    fontSize: TYPOGRAPHY.size.xs,
                    fontFamily: TYPOGRAPHY.fontFamily.sans,
                    outline: 'none',
                    transition: `border-color ${ANIMATION.fast}`,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = BORDER.focus;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = BORDER.subtle;
                  }}
                />

                {/* Clear button */}
                <AnimatePresence>
                  {searchQuery && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.1 }}
                      onClick={() => setSearch('')}
                      style={{
                        position: 'absolute',
                        right: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 20,
                        height: 20,
                        border: 'none',
                        borderRadius: RADIUS.xs,
                        background: 'rgba(255,255,255,0.08)',
                        color: TEXT.tertiary,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = TEXT.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = TEXT.tertiary;
                      }}
                    >
                      <X size={11} weight="bold" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Channels ────────────────────────────────────────────────────────── */}
      {Object.keys(groupChats).length > 0 ? (
        <div
          style={{
            padding: '8px 8px 6px',
            borderBottom: `1px solid ${BORDER.subtle}`,
          }}
        >
          {!nested && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 6px 6px',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: TYPOGRAPHY.weight.semibold,
                  color: TEXT.tertiary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Channels
              </span>
              <button
                type="button"
                title="New channel"
                onClick={() => setShowGroupDialog(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  border: 'none',
                  borderRadius: RADIUS.xs,
                  background: 'transparent',
                  color: TEXT.tertiary,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = TEXT.secondary;
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = TEXT.tertiary;
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Users size={14} />
              </button>
            </div>
          )}

          <motion.div layout style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <AnimatePresence mode="popLayout">
              {Object.values(groupChats).map((group) => (
                <GroupChatRosterItem
                  key={group.id}
                  group={group}
                  unreadCount={getUnreadCount(group.id)}
                  isSelected={activeGroupId === group.id}
                  onSelect={handleSelectGroup}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      ) : !nested ? (
        <div
          style={{
            padding: '8px 12px 6px',
            borderBottom: `1px solid ${BORDER.subtle}`,
          }}
        >
          <button
            type="button"
            onClick={() => setShowGroupDialog(true)}
            disabled={roster.length < 2}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 12px',
              border: `1px dashed ${BORDER.default}`,
              borderRadius: RADIUS.sm,
              background: 'transparent',
              color: roster.length < 2 ? TEXT.tertiary : TEXT.secondary,
              fontSize: TYPOGRAPHY.size.xs,
              fontWeight: TYPOGRAPHY.weight.medium,
              cursor: roster.length < 2 ? 'not-allowed' : 'pointer',
              transition: `all ${ANIMATION.base}`,
            }}
            onMouseEnter={(e) => {
              if (roster.length < 2) return;
              e.currentTarget.style.borderColor = SAND[500];
              e.currentTarget.style.color = SAND[500];
              e.currentTarget.style.background = `${SAND[500]}08`;
            }}
            onMouseLeave={(e) => {
              if (roster.length < 2) return;
              e.currentTarget.style.borderColor = BORDER.default;
              e.currentTarget.style.color = TEXT.secondary;
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Users size={14} />
            {isCompact ? 'Group' : 'New group'}
          </button>
        </div>
      ) : null}

      {/* ── Bot List ───────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '8px 8px',
        }}
      >
        {sortedItems.length === 0 ? (
          <EmptyState searchQuery={searchQuery} />
        ) : (
          <motion.div
            layout
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <AnimatePresence mode="popLayout">
              {sortedItems.map((item) => (
                <BotRosterItem
                  key={item.id}
                  bot={item}
                  isSelected={selectedBotId === item.id}
                  isCompact={isCompact}
                  isPinned={pinnedBotIds.includes(item.id)}
                  onSelect={handleSelect}
                  onContextMenu={handleContextMenu}
                  onStartSession={handleStartSession}
                  onOpenSettings={handleEditProfile}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ── Footer: New Bot + New Channel buttons (standalone only) ────────── */}
      {!nested && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '8px 12px 12px',
            borderTop: `1px solid ${BORDER.subtle}`,
          }}
        >
          <button
            onClick={() => {
              logger.info('New Bot clicked');
              setDraftAgent({
                isBot: true,
                botProfile: {
                  displayName: '',
                  tagline: '',
                  welcomeMessage: '',
                  starterPrompts: [],
                  accentColor: '#6366f1',
                  groupChatEnabled: true,
                  botCategory: 'custom',
                  lifecycle: 'draft',
                },
              });
              setIsCreating(true);
              onNewBot?.();
              window.dispatchEvent(
                new CustomEvent('allternit:open-view', { detail: { viewType: 'agent-hub' } }),
              );
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isCompact ? 0 : 8,
              width: '100%',
              padding: '8px 12px',
              border: `1px dashed ${BORDER.default}`,
              borderRadius: RADIUS.sm,
              background: 'transparent',
              color: TEXT.secondary,
              fontSize: TYPOGRAPHY.size.xs,
              fontWeight: TYPOGRAPHY.weight.medium,
              cursor: 'pointer',
              transition: `all ${ANIMATION.base}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = SAND[500];
              e.currentTarget.style.color = SAND[500];
              e.currentTarget.style.background = `${SAND[500]}08`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = BORDER.default;
              e.currentTarget.style.color = TEXT.secondary;
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Plus size={14} />
            {!isCompact && 'New Bot'}
          </button>

          <button
            onClick={() => setShowGroupDialog(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isCompact ? 0 : 8,
              width: '100%',
              padding: '8px 12px',
              border: `1px dashed ${BORDER.default}`,
              borderRadius: RADIUS.sm,
              background: 'transparent',
              color: TEXT.secondary,
              fontSize: TYPOGRAPHY.size.xs,
              fontWeight: TYPOGRAPHY.weight.medium,
              cursor: 'pointer',
              transition: `all ${ANIMATION.base}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = SAND[500];
              e.currentTarget.style.color = SAND[500];
              e.currentTarget.style.background = `${SAND[500]}08`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = BORDER.default;
              e.currentTarget.style.color = TEXT.secondary;
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Users size={14} />
            {!isCompact && 'New Channel'}
          </button>
        </div>
      )}

      <GroupChatChannelDialog
        open={showGroupDialog}
        onOpenChange={setShowGroupDialog}
        onSave={handleCreateGroup}
      />

      {/* ── Context menu portal ────────────────────────────────────────────── */}
      {contextMenuTarget && (
        <BotRosterContextMenu
          target={contextMenuTarget}
          isPinned={contextMenuIsPinned}
          isHidden={contextMenuIsHidden}
          unreadCount={contextMenuUnreadCount}
          onStartSession={handleStartSession}
          onEditProfile={handleEditProfile}
          onDuplicate={handleDuplicate}
          onAddToGroup={handleAddToGroup}
          onTogglePin={handleTogglePin}
          onToggleHide={handleToggleHide}
          onMarkRead={handleMarkRead}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onClose={hideContextMenu}
        />
      )}
    </div>
  );
}

export default BotRoster;
