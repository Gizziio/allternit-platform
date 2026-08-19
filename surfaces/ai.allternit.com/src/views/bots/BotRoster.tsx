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
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

import { createModuleLogger } from '@/lib/logger';
import { useAgentStore } from '@/lib/agents/agent.store';
import { agentToCreateAgentInput } from '@/lib/bots/bot-profile';
import { openBotCanonicalChat } from '@/lib/bots/bot-canonical-chat.service';
import { resolveBotAvatar } from '@/lib/bots/bot-avatar.service';
import { useUnifiedRoster, type UnifiedRosterBot } from '@/lib/bots/use-unified-roster';
import {
  useBotRosterStore,
  type BotRosterSortBy,
} from '@/lib/bots/bot-roster.store';
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

const logger = createModuleLogger('BotRoster');

// ============================================================================
// Constants
// ============================================================================

const PANEL_WIDTH = 280;

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
// Main Component
// ============================================================================

export interface BotRosterProps {
  /** Callback when user clicks "+ New Bot" */
  onNewBot?: () => void;
  /** Callback when user starts a session with a bot */
  onStartSession?: (botId: string) => void;
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
}

export function BotRoster({
  onNewBot,
  onStartSession,
  onEditProfile,
  onNavigate,
  onDuplicate,
  onArchive,
  onDelete,
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

  const selectBot = useBotRosterStore((s) => s.selectBot);
  const setSearch = useBotRosterStore((s) => s.setSearch);
  const setSort = useBotRosterStore((s) => s.setSort);
  const showContextMenu = useBotRosterStore((s) => s.showContextMenu);
  const hideContextMenu = useBotRosterStore((s) => s.hideContextMenu);

  // ── Unified roster (native + stacked) ─────────────────────────────────────
  const roster = useUnifiedRoster();
  const allItems = useMemo(() => roster.map(botToItem), [roster]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;

    const q = searchQuery.toLowerCase();
    return allItems.filter((item) => {
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
  }, [allItems, roster, searchQuery]);

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

    return items;
  }, [filteredItems, sortBy]);

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
      try {
        await openBotCanonicalChat({
          botId,
          botName: item?.displayName ?? botId,
          setActive: true,
        });
      } catch (err) {
        logger.error({ err, botId }, 'Failed to open canonical bot chat');
      }

      onStartSession?.(botId);
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: PANEL_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--shell-rail-bg, #1A1612)',
        borderRight: `1px solid ${BORDER.subtle}`,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '14px 14px 10px',
          borderBottom: `1px solid ${BORDER.subtle}`,
        }}
      >
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
          </div>
        </div>

        {/* ── Search bar ─────────────────────────────────────────────────── */}
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
      </div>

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

      {/* ── Footer: New Bot button ────────────────────────────────────────── */}
      <div
        style={{
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
            gap: 8,
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
          New Bot
        </button>
      </div>

      {/* ── Context menu portal ────────────────────────────────────────────── */}
      {contextMenuTarget && (
        <BotRosterContextMenu
          target={contextMenuTarget}
          onStartSession={handleStartSession}
          onEditProfile={handleEditProfile}
          onDuplicate={handleDuplicate}
          onAddToGroup={handleAddToGroup}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onClose={hideContextMenu}
        />
      )}
    </div>
  );
}

export default BotRoster;
