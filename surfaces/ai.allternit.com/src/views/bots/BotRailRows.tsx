'use client';

/**
 * Bots rail rows — OpenMaus Sidebar `BotListItem` + `BotThreadList` +
 * `NewThreadButton`, Allternit tokens / Phosphor. Extra threads are Hub
 * sessions (`botThreadOf`); they do not replace the canonical pin.
 */

import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowUp,
  CaretRight,
  CircleNotch,
  Crown,
  DotsThree,
  FolderSimplePlus,
  PencilSimple,
  Plus,
  PushPin,
  PushPinSlash,
  Trash,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/agents/agent.types';
import { getBotDisplayName, getBotTagline } from '@/lib/bots/bot-profile';
import { useBotStatus } from '@/lib/bots/bot-operational-state.store';
import { useBotRosterStore } from '@/lib/bots/bot-roster.store';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import {
  botTitle,
  groupLastMessagePreview,
  isChiefOfStaff,
  botRailPreview,
} from '@/lib/bots/bot-roster-preview';
import {
  archiveBotThread,
  createBotThread,
  deleteBotThread,
  listBotThreads,
  moveBotThread,
  renameBotThread,
  threadByline,
  visibleBotThreads,
  type BotThread,
} from '@/lib/bots/bot-threads';
import { moveFolderIds, useBotFoldersStore } from '@/lib/bots/bot-folders.store';
import { BotFolderDialog, FolderIcon } from './BotFolderDialog';
import { openBotChatView } from '@/lib/bots/bot-canonical-chat.service';
import type { GroupChat } from '@/lib/bots/group-chat.types';
import { BotAvatar } from './BotAvatar';
import { GroupChatAvatar } from './GroupChatAvatar';

export function BotNeedsYouHint({ botId }: { botId: string }): React.ReactNode {
  const { needsAttention, hasPendingApprovals } = useBotStatus(botId);
  if (!needsAttention && !hasPendingApprovals) return null;
  return (
    <span className="shrink-0 text-[10px] font-medium text-[var(--accent-primary)]">
      Needs you
    </span>
  );
}

function botContactByline(status: {
  hasPendingApprovals: boolean;
  needsAttention: boolean;
  isWorking: boolean;
  status: string;
}): string | null {
  if (status.hasPendingApprovals || status.status === "waiting_approval") return "Needs you";
  if (status.needsAttention) return "Needs you";
  if (status.isWorking || status.status === "working") return "Working";
  if (status.status === "waiting_input") return "Waiting";
  if (status.status === "blocked") return "Blocked";
  if (status.status === "failed") return "Failed";
  return null;
}

function useBotLastMessage(bot: Agent): string {
  const sessions = useChatSessionStore((s) => s.sessions);
  return botRailPreview(bot.id, sessions ?? []) || getBotTagline(bot);
}

export function BotRailRow({
  bot,
  isActive,
  disabled,
  onOpen,
  onPin,
  onUnpin,
  onMore,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  bot: Agent;
  isActive?: boolean;
  disabled?: boolean;
  onOpen: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onMore?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}): React.ReactNode {
  const op = useBotStatus(bot.id);
  const statusLine = botContactByline(op);
  const lastMessage = useBotLastMessage(bot);
  const title = botTitle(bot);
  const chief = isChiefOfStaff(bot);
  const waiting = Boolean(op.hasPendingApprovals || op.needsAttention);
  const working = Boolean(op.isWorking || op.status === "working") && !waiting;
  const preview = statusLine ?? lastMessage;
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="group relative"
    >
      <div
        className={cn(
          'relative w-full flex items-center gap-2 rounded-md py-2 pr-2 pl-1 transition-all duration-200 font-medium',
          isActive
            ? 'bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)]'
            : 'bg-transparent text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]',
        )}
      >
        <button
          type="button"
          aria-label={threadsOpen ? `Collapse threads for ${getBotDisplayName(bot)}` : `Expand threads for ${getBotDisplayName(bot)}`}
          aria-expanded={threadsOpen}
          onClick={(event) => {
            event.stopPropagation();
            setThreadsOpen((open) => !open);
          }}
          className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded text-[var(--shell-item-muted)] hover:bg-[var(--shell-item-hover)] hover:text-[var(--shell-item-fg)]"
        >
          <CaretRight
            size={14}
            className={cn('transition-transform', threadsOpen && 'rotate-90')}
          />
        </button>
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          className="flex-1 min-w-0 flex items-center gap-3 bg-transparent border-none p-0 text-left cursor-pointer font-medium disabled:opacity-60"
        >
          <span className="relative flex shrink-0">
            <BotAvatar bot={bot} size={46} />
            {working && (
              <span
                data-testid="working-dot"
                className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-[var(--shell-rail-bg,var(--bg-elevated))] bg-[var(--status-success)]"
              />
            )}
            {waiting && (
              <span
                data-testid="waiting-dot"
                className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-[var(--shell-rail-bg,var(--bg-elevated))] bg-[var(--status-warning)]"
              />
            )}
          </span>
          <span className="min-w-0 flex-1 flex flex-col">
            {title ? (
              <span className="truncate text-[11px] font-medium leading-4 text-[var(--shell-item-muted)]">
                {title}
              </span>
            ) : null}
            <span className="text-[14px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap leading-tight">
              {getBotDisplayName(bot)}
            </span>
            {chief ? (
              <span className="flex min-w-0 items-center gap-1 text-[11.5px] font-medium leading-4 text-[var(--accent-bot,#7aa2ff)]">
                <Crown size={11} weight="fill" className="shrink-0" />
                Chief of Staff
              </span>
            ) : null}
            {!threadsOpen && preview ? (
              <span
                className={cn(
                  "text-[11px] overflow-hidden text-ellipsis whitespace-nowrap leading-tight font-normal",
                  waiting ? "text-[var(--accent-primary)]" : "text-[var(--shell-item-muted)]",
                )}
              >
                {preview}
              </span>
            ) : null}
          </span>
        </button>
        <span className="flex shrink-0 items-center opacity-0 max-md:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            title="New folder"
            aria-label={`New folder for ${getBotDisplayName(bot)}`}
            onClick={(e) => {
              e.stopPropagation();
              setThreadsOpen(true);
              setCreatingFolder(true);
            }}
            className="size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center"
          >
            <FolderSimplePlus size={14} />
          </button>
          {onPin && !onUnpin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPin();
              }}
              title="Pin"
              className="size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center"
            >
              <PushPin size={13} />
            </button>
          )}
          {onUnpin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUnpin();
              }}
              title="Unpin from rail"
              className="size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center"
            >
              <PushPinSlash size={13} />
            </button>
          )}
          {onMore && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMore();
              }}
              title="More"
              className="size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center"
            >
              <DotsThree size={15} weight="bold" />
            </button>
          )}
        </span>
      </div>
      {threadsOpen && <BotThreadList bot={bot} selected={Boolean(isActive)} />}
      {creatingFolder && (
        <BotFolderDialog
          botId={bot.id}
          botName={getBotDisplayName(bot)}
          onClose={() => setCreatingFolder(false)}
        />
      )}
    </div>
  );
}

function BotThreadRow({
  botId,
  thread,
  current,
  folders,
}: {
  botId: string;
  thread: BotThread;
  current: boolean;
  folders: { id: string; name: string; emoji?: string }[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(thread.title);
  const [deleting, setDeleting] = useState(false);
  const byline = threadByline(thread);

  const finishRename = async (save: boolean) => {
    setRenaming(false);
    if (!save) {
      setDraft(thread.title);
      return;
    }
    const next = draft.trim();
    if (next && next !== thread.title) await renameBotThread(thread.sessionId, next);
  };

  return (
    <div className="group/thread relative flex min-w-0 items-center rounded-md">
      {renaming ? (
        <input
          autoFocus
          value={draft}
          maxLength={80}
          aria-label="Rename thread"
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void finishRename(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void finishRename(true);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              void finishRename(false);
            }
          }}
          className="m-1 min-w-0 flex-1 rounded border border-[var(--accent-primary)]/50 bg-[var(--bg-elevated)] px-2 py-1 text-[12.5px] text-[var(--shell-item-fg)] outline-none"
        />
      ) : (
        <button
          type="button"
          data-sidebar-thread-row={thread.sessionId}
          aria-current={current ? 'page' : undefined}
          title={thread.title}
          onClick={() => openBotChatView(thread.sessionId, botId, 'bot-launchpad')}
          onDoubleClick={() => {
            setDraft(thread.title);
            setRenaming(true);
          }}
          className={cn(
            'flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pl-3 pr-1 text-left text-[13px] font-medium',
            current
              ? 'bg-[var(--shell-item-active-bg)] font-semibold text-[var(--shell-item-active-fg)]'
              : 'text-[var(--shell-item-muted)] hover:bg-[var(--shell-item-hover)] hover:text-[var(--shell-item-fg)]',
            thread.archived && !current && 'opacity-70',
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="min-w-0 truncate">{thread.title}</span>
            {byline ? (
              <span className="min-w-0 truncate text-[10.5px] leading-tight text-[var(--shell-item-muted)]">
                {byline}
              </span>
            ) : null}
          </span>
          {thread.busy ? (
            <CircleNotch size={11} className="shrink-0 animate-spin text-[var(--status-success)]" />
          ) : null}
          {thread.unread > 0 && (
            <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent-primary)]" />
          )}
        </button>
      )}
      <button
        type="button"
        aria-label={`Actions for ${thread.title}`}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className="mr-0.5 flex size-6 shrink-0 items-center justify-center rounded text-[var(--shell-item-muted)] opacity-0 hover:bg-[var(--shell-item-hover)] hover:text-[var(--shell-item-fg)] group-hover/thread:opacity-100 max-md:opacity-70"
      >
        <DotsThree size={13} weight="bold" />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 w-[200px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setDraft(thread.title);
              setRenaming(true);
            }}
            className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[12px] text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]"
          >
            <PencilSimple size={12} /> Rename
          </button>
          {folders.length > 0 && (
            <label className="block rounded px-2.5 py-2 text-[12px] text-[var(--shell-item-fg)]">
              <span className="mb-1 block text-[var(--shell-item-muted)]">Move to folder</span>
              <select
                aria-label={`Move ${thread.title}`}
                value={thread.folderId ?? ''}
                onChange={(event) => {
                  void moveBotThread(thread.sessionId, event.target.value || null);
                  setMenuOpen(false);
                }}
                className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1 py-1 text-[var(--shell-item-fg)] outline-none"
              >
                <option value="">No folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.emoji ? `${folder.emoji} ` : ''}
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            role="menuitem"
            disabled={thread.busy}
            onClick={() => {
              setMenuOpen(false);
              void archiveBotThread(thread.sessionId, !thread.archived);
            }}
            className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[12px] text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] disabled:opacity-40"
          >
            {thread.archived ? <ArrowCounterClockwise size={12} /> : <Archive size={12} />}
            {thread.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={thread.busy}
            onClick={() => {
              setMenuOpen(false);
              setDeleting(true);
            }}
            className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[12px] text-[var(--status-error)] hover:bg-[var(--shell-item-hover)] disabled:opacity-40"
          >
            <Trash size={12} /> Delete
          </button>
        </div>
      )}
      {deleting && (
        <div className="absolute inset-x-1 top-full z-50 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-[12px] shadow-xl">
          <p className="px-1 text-[var(--shell-item-fg)]">Delete “{thread.title}”?</p>
          <div className="mt-2 flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setDeleting(false)}
              className="rounded px-2 py-1 text-[var(--shell-item-muted)] hover:bg-[var(--shell-item-hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleting(false);
                if (!thread.busy) void deleteBotThread(thread.sessionId, botId);
              }}
              className="rounded px-2 py-1 text-[var(--status-error)] hover:bg-[var(--shell-item-hover)]"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BotThreadList({ bot, selected }: { bot: Agent; selected: boolean }) {
  const canonicalId = useBotRosterStore((s) => s.canonicalChatIds[bot.id]);
  const sessions = useChatSessionStore((s) => s.sessions);
  const unreadCounts = useChatSessionStore((s) => s.unreadCounts);
  const streamingBySession = useChatSessionStore((s) => s.streamingBySession);
  const activeSessionId = useChatSessionStore((s) => s.activeSessionId);
  const folders = useBotFoldersStore((s) => s.foldersByBot[bot.id] ?? []);
  const reorderFolders = useBotFoldersStore((s) => s.reorderFolders);
  const [showAll, setShowAll] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  const all = useMemo(
    () => listBotThreads(bot.id, sessions ?? [], canonicalId, unreadCounts, streamingBySession),
    [bot.id, sessions, canonicalId, unreadCounts, streamingBySession],
  );
  const visible = visibleBotThreads(all, activeSessionId ?? '', showAll);
  const archivedHidden = all.filter(
    (thread) => thread.archived && !visible.some((row) => row.sessionId === thread.sessionId),
  );
  const folderIds = folders.map((folder) => folder.id);
  const currentFolderId = visible.find((thread) => thread.sessionId === activeSessionId)?.folderId;
  const ungrouped = visible.filter(
    (thread) => !thread.folderId || !folders.some((folder) => folder.id === thread.folderId),
  );
  const editingFolder = folders.find((folder) => folder.id === editingFolderId);

  const renderThread = (thread: BotThread) => (
    <BotThreadRow
      key={thread.sessionId}
      botId={bot.id}
      thread={thread}
      current={selected && thread.sessionId === activeSessionId}
      folders={folders}
    />
  );

  return (
    <div
      className="mb-2 ml-5 space-y-0.5 border-l border-[var(--border-subtle)] pl-2"
      role="group"
      aria-label={`Threads for ${getBotDisplayName(bot)}`}
    >
      {folders.map((folder, index) => {
        const inFolder = visible.filter((thread) => thread.folderId === folder.id);
        const allInFolder = all.filter((thread) => thread.folderId === folder.id);
        const open = !collapsed.has(folder.id);
        const waiting = allInFolder.some((thread) => thread.unread > 0);
        const working = allInFolder.some((thread) => thread.busy);
        return (
          <div key={folder.id} data-sidebar-project={folder.id}>
            <div className="group/folder flex items-center gap-0.5 rounded-md text-[var(--shell-item-muted)] hover:bg-[var(--shell-item-hover)]/40">
              <button
                type="button"
                aria-expanded={open}
                aria-label={open ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(folder.id)) next.delete(folder.id);
                    else next.add(folder.id);
                    return next;
                  })
                }
                className="flex size-6 shrink-0 items-center justify-center rounded"
              >
                <CaretRight size={11} className={cn('transition-transform', open && 'rotate-90')} />
              </button>
              <button
                type="button"
                title="Folder icon"
                onClick={() => setEditingFolderId(folder.id)}
                className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-[var(--shell-item-hover)]"
              >
                <FolderIcon emoji={folder.emoji} size={14} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(folder.id)) next.delete(folder.id);
                    else next.add(folder.id);
                    return next;
                  })
                }
                className="flex min-h-8 min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-[13px] font-semibold"
              >
                <span className="truncate">{folder.name}</span>
                <span className="shrink-0 text-[10px] font-normal opacity-50">{allInFolder.length}</span>
                {!open && waiting ? (
                  <span className="text-[10px] text-[var(--status-warning)]">Needs you</span>
                ) : !open && working ? (
                  <CircleNotch size={10} className="animate-spin" />
                ) : null}
              </button>
              <button
                type="button"
                title={`New thread in ${folder.name}`}
                aria-label={`New thread in ${folder.name}`}
                onClick={() => void createBotThread(bot.id, getBotDisplayName(bot), folder.id)}
                className="flex size-6 items-center justify-center rounded opacity-0 hover:bg-[var(--shell-item-hover)] group-hover/folder:opacity-100 max-md:opacity-70"
              >
                <Plus size={12} />
              </button>
              <button
                type="button"
                title="Move folder up"
                disabled={index === 0}
                onClick={() => reorderFolders(bot.id, moveFolderIds(folderIds, folder.id, -1))}
                className="flex size-6 items-center justify-center rounded opacity-0 hover:bg-[var(--shell-item-hover)] group-hover/folder:opacity-100 disabled:opacity-30"
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                title="Move folder down"
                disabled={index === folders.length - 1}
                onClick={() => reorderFolders(bot.id, moveFolderIds(folderIds, folder.id, 1))}
                className="flex size-6 items-center justify-center rounded opacity-0 hover:bg-[var(--shell-item-hover)] group-hover/folder:opacity-100 disabled:opacity-30"
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                title="Folder settings"
                onClick={() => setEditingFolderId(folder.id)}
                className="flex size-6 items-center justify-center rounded opacity-0 hover:bg-[var(--shell-item-hover)] group-hover/folder:opacity-100 max-md:opacity-70"
              >
                <PencilSimple size={12} />
              </button>
            </div>
            {open && (
              <div className="ml-3 border-l border-[var(--border-subtle)] pl-2">
                {inFolder.map(renderThread)}
                {allInFolder.length === 0 && (
                  <p className="px-2.5 py-1 text-[11px] text-[var(--shell-item-muted)]">No threads</p>
                )}
              </div>
            )}
          </div>
        );
      })}
      {folders.length > 0 && ungrouped.length > 0 && (
        <div className="px-3 pb-1 pt-2 text-[10.5px] text-[var(--shell-item-muted)]">Threads</div>
      )}
      {ungrouped.map(renderThread)}
      {!showAll && all.length > visible.length && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="px-3 py-1.5 text-[11px] text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)]"
        >
          Show all {all.length} threads
        </button>
      )}
      {archivedHidden.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((open) => !open)}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)]"
          >
            <CaretRight
              size={11}
              className={cn('shrink-0 transition-transform', showArchived && 'rotate-90')}
            />
            Archived ({archivedHidden.length})
          </button>
          {showArchived &&
            archivedHidden.map(renderThread)}
        </>
      )}
      <button
        type="button"
        disabled={creating}
        aria-label="New thread"
        title={
          currentFolderId
            ? `New thread in ${folders.find((folder) => folder.id === currentFolderId)?.name ?? 'folder'}`
            : 'New thread'
        }
        onClick={async () => {
          setCreating(true);
          try {
            await createBotThread(bot.id, getBotDisplayName(bot), currentFolderId ?? undefined);
          } finally {
            setCreating(false);
          }
        }}
        className="mt-1 flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] text-[var(--shell-item-muted)] hover:bg-[var(--shell-item-hover)] hover:text-[var(--shell-item-fg)] disabled:opacity-50"
      >
        <Plus size={12} />
        <span className="truncate">New thread</span>
      </button>
      {editingFolder && (
        <BotFolderDialog
          botId={bot.id}
          botName={getBotDisplayName(bot)}
          folder={editingFolder}
          onClose={() => setEditingFolderId(null)}
        />
      )}
    </div>
  );
}

export function BotGroupRailRow({
  group,
  unread,
  isActive,
  onOpen,
}: {
  group: GroupChat;
  unread: number;
  isActive?: boolean;
  onOpen: () => void;
}): React.ReactNode {
  return (
    <div
      data-rail-item={`group-${group.id}`}
      className={cn(
        'group relative w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl cursor-pointer transition-all duration-200 font-medium',
        isActive
          ? 'bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold'
          : 'bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-none p-0 text-left cursor-pointer font-medium"
      >
        <GroupChatAvatar name={group.name} members={group.members} size={22} />
        <span className="min-w-0 flex-1 flex flex-col">
          <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap leading-tight">
            {group.name}
          </span>
          <span className="text-[11px] overflow-hidden text-ellipsis whitespace-nowrap leading-tight font-normal text-[var(--shell-item-muted)]">
            {groupLastMessagePreview(group)}
          </span>
        </span>
        {unread > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--accent-primary)] px-1.5 text-[11px] font-semibold text-[var(--ui-text-inverse)]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
