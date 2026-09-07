"use client";

import React, { useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { MagnifyingGlass, Plus, PushPin, PushPinSlash, Users, X, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { Agent, Bot } from "@/lib/agents/agent.types";
import { getBots, getBotDisplayName, getBotTagline } from "@/lib/bots/bot-profile";
import { useBotRosterStore } from "@/lib/bots/bot-roster.store";
import { useGroupChatStore } from "@/lib/bots/group-chat.store";
import { useStartBotSession } from "@/lib/bots/useStartBotSession";
import { openBotChatView } from "@/lib/bots/bot-canonical-chat.service";
import { startBotGroupChat } from "@/lib/bots/startBotGroupChat";
import { BotAvatar } from "@/views/bots/BotAvatar";
import { CreateBotForm } from "@/views/agent-view/components/CreateBotForm";
import { BotGroupChatModal } from "@/views/agent-hub/main/BotGroupChatModal";

interface BotPickerSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Bot-mode bottom drawer, opened from the composer's "+" button when
 * `agentModeSurface === 'bot'`. Modeled on ComposerPlusSheet (same grabber
 * header, glass styling, and open/close animation) but anchored to the bottom
 * of the screen. Selecting a bot starts (or reopens) its canonical session and
 * lands in the bot-chat-session view — no overlays stack on top.
 */
export function BotPickerSheet({ open, onClose }: BotPickerSheetProps) {
  const { agents } = useAgentStore();
  const pinnedBotIds = useBotRosterStore((s) => s.pinnedBotIds);
  const togglePin = useBotRosterStore((s) => s.togglePin);
  const groups = useGroupChatStore((s) => s.groups);
  const { startSession, isStarting } = useStartBotSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [groupChatOpen, setGroupChatOpen] = useState(false);
  // External open request (e.g. the bot launchpad composer submitted with no
  // bot selected). The sheet is always mounted in bot mode; this event opens
  // it even when the composer's own plus-menu state is closed.
  const [eventOpen, setEventOpen] = useState(false);

  React.useEffect(() => {
    const handleOpenRequest = () => setEventOpen(true);
    window.addEventListener("allternit:open-bot-picker", handleOpenRequest);
    return () => window.removeEventListener("allternit:open-bot-picker", handleOpenRequest);
  }, []);

  const effectiveOpen = open || eventOpen;
  const handleClose = React.useCallback(() => {
    setEventOpen(false);
    setSearchQuery("");
    onClose();
  }, [onClose]);

  const bots = useMemo(() => getBots(agents), [agents]);

  const pinnedBots = useMemo(
    () =>
      pinnedBotIds
        .map((id) => bots.find((b) => b.id === id))
        .filter((b): b is Bot => Boolean(b)),
    [bots, pinnedBotIds]
  );

  const q = searchQuery.trim().toLowerCase();
  const allBots = useMemo(() => {
    const base = bots.filter((b) => !pinnedBotIds.includes(b.id));
    if (!q) return base;
    return base.filter(
      (b) =>
        getBotDisplayName(b).toLowerCase().includes(q) ||
        (getBotTagline(b) ?? "").toLowerCase().includes(q)
    );
  }, [bots, pinnedBotIds, q]);

  const groupList = useMemo(() => Object.values(groups), [groups]);

  const handleSelectBot = async (bot: Agent) => {
    handleClose();
    const sessionId = await startSession(bot);
    if (sessionId) {
      openBotChatView(sessionId, bot.id, "bot-launchpad");
    }
  };

  const handleOpenGroup = (groupId: string) => {
    handleClose();
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", {
        detail: { viewType: "group-chat", context: { groupId } },
      })
    );
  };

  const handleStartGroupChat = async (selectedBots: Agent[], name: string) => {
    const result = await startBotGroupChat({ bots: selectedBots, name });
    if (result?.groupId) {
      handleOpenGroup(result.groupId);
    }
  };

  return (
    <>
      <DialogPrimitive.Root open={effectiveOpen} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-[180] bg-[var(--shell-overlay-backdrop)] backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            onClick={handleClose}
          />
          <DialogPrimitive.Content
            className={cn(
              "fixed z-[190] left-1/2 bottom-4 -translate-x-1/2",
              "w-[min(440px,calc(100vw-32px))] max-h-[min(640px,calc(100vh-64px))]",
              "rounded-2xl border border-[var(--border-subtle)]",
              "bg-[var(--glass-bg-thick)]/90 backdrop-blur-xl backdrop-saturate-150",
              "shadow-[0_24px_80px_var(--shell-overlay-backdrop)]",
              "flex flex-col overflow-hidden",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4"
            )}
            onPointerDownOutside={handleClose}
          >
            {/* Grabber header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 rounded-full bg-[var(--text-secondary)]/30" />
              </div>
              <DialogPrimitive.Close
                onClick={handleClose}
                className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                aria-label="Close"
              >
                <X size={14} weight="bold" />
              </DialogPrimitive.Close>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 pb-5 space-y-4">
              {/* Search */}
              <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3">
                <MagnifyingGlass size={14} className="text-[var(--text-tertiary)] shrink-0" />
                <input
                  aria-label="Search bots"
                  type="text"
                  placeholder="Search bots…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 border-none bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                />
              </div>

              {/* Pinned bots */}
              {pinnedBots.length > 0 && (
                <section>
                  <SheetSectionTitle>Pinned bots</SheetSectionTitle>
                  <div className="flex flex-col gap-1 mt-2">
                    {pinnedBots.map((bot) => (
                      <BotRow
                        key={bot.id}
                        bot={bot}
                        pinned
                        onSelect={() => void handleSelectBot(bot)}
                        onTogglePin={() => togglePin(bot.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* All bots */}
              <section>
                <SheetSectionTitle>All bots</SheetSectionTitle>
                <div className="flex flex-col gap-1 mt-2">
                  {allBots.length === 0 ? (
                    <p className="px-1 py-2 text-[13px] text-[var(--text-tertiary)]">
                      {q ? "No bots match your search." : "No bots yet — create your first one below."}
                    </p>
                  ) : (
                    allBots.map((bot) => (
                      <BotRow
                        key={bot.id}
                        bot={bot}
                        pinned={false}
                        onSelect={() => void handleSelectBot(bot)}
                        onTogglePin={() => togglePin(bot.id)}
                      />
                    ))
                  )}
                </div>
              </section>

              {/* Group chats */}
              {groupList.length > 0 && (
                <section>
                  <SheetSectionTitle>Group chats</SheetSectionTitle>
                  <div className="flex flex-col gap-1 mt-2">
                    {groupList.map((group) => (
                      <button
                        type="button"
                        key={group.id}
                        onClick={() => handleOpenGroup(group.id)}
                        className="flex items-center gap-3 w-full p-2.5 rounded-xl text-left hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <span className="flex items-center justify-center size-8 rounded-lg bg-[var(--bg-tertiary)]/60 text-[var(--accent-bot)] shrink-0">
                          <Users size={16} weight="duotone" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                            {group.name}
                          </span>
                          <span className="block text-[11px] text-[var(--text-secondary)]">
                            {group.members.length} members
                          </span>
                        </span>
                        <CaretRight size={12} className="text-[var(--text-tertiary)] shrink-0" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Actions */}
              <section>
                <SheetSectionTitle>Actions</SheetSectionTitle>
                <div className="flex flex-col gap-1 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      setCreateOpen(true);
                    }}
                    className="flex items-center gap-3 w-full p-2.5 rounded-xl text-left hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <span className="flex items-center justify-center size-8 rounded-lg bg-[var(--bg-tertiary)]/60 text-[var(--accent-bot)] shrink-0">
                      <Plus size={16} weight="bold" />
                    </span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">New bot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      setGroupChatOpen(true);
                    }}
                    className="flex items-center gap-3 w-full p-2.5 rounded-xl text-left hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <span className="flex items-center justify-center size-8 rounded-lg bg-[var(--bg-tertiary)]/60 text-[var(--accent-bot)] shrink-0">
                      <Users size={16} weight="duotone" />
                    </span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">New group chat</span>
                  </button>
                </div>
              </section>

              {isStarting && (
                <p className="text-[11px] text-[var(--text-secondary)] text-center">Starting bot…</p>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <CreateBotForm isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <BotGroupChatModal
        isOpen={groupChatOpen}
        bots={bots}
        onClose={() => setGroupChatOpen(false)}
        onStart={handleStartGroupChat}
      />
    </>
  );
}

function SheetSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
      {children}
    </h3>
  );
}

function BotRow({
  bot,
  pinned,
  onSelect,
  onTogglePin,
}: {
  bot: Agent;
  pinned: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 w-full rounded-xl hover:bg-[var(--surface-hover)] transition-colors">
      <button
        type="button"
        onClick={onSelect}
        className="flex items-center gap-3 flex-1 min-w-0 p-2.5 text-left border-none bg-transparent cursor-pointer"
      >
        <BotAvatar bot={bot} size={32} />
        <span className="flex-1 min-w-0">
          <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
            {getBotDisplayName(bot)}
          </span>
          {getBotTagline(bot) && (
            <span className="block truncate text-[11px] text-[var(--text-secondary)]">
              {getBotTagline(bot)}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        aria-label={pinned ? `Unpin ${getBotDisplayName(bot)}` : `Pin ${getBotDisplayName(bot)}`}
        title={pinned ? "Unpin" : "Pin"}
        className="mr-2 p-1.5 rounded-lg border-none bg-transparent text-[var(--text-tertiary)] hover:text-[var(--accent-bot)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        {pinned ? <PushPinSlash size={14} /> : <PushPin size={14} />}
      </button>
    </div>
  );
}
