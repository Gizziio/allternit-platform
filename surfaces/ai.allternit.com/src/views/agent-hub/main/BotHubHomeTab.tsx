"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CaretDown,
  CaretRight,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  Plus,
  Robot,
  Users,
  X,
} from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { getBots, BOT_CATEGORIES } from "@/lib/bots/bot-profile";
import type { BotCategory, Agent } from "@/lib/agents/agent.types";
import {
  ALL_BOTS_SECTION_ID,
  createCustomSection,
  deleteBotHubSection,
  groupBotsBySection,
  loadBotHubSections,
  resolveBotSectionId,
  saveBotHubSections,
  updateBotHubSection,
  type BotHubSection,
} from "@/lib/bots/bot-hub-sections";
import { BotHubCard } from "./BotHubCard";
import { BotGroupChatModal } from "./BotGroupChatModal";
import { startBotGroupChat } from "@/lib/bots/startBotGroupChat";
import { cn } from "@/lib/utils";

interface BotHubHomeTabProps {
  onCreate?: () => void;
}

export function BotHubHomeTab({ onCreate }: BotHubHomeTabProps) {
  const { agents, isLoadingAgents, updateAgent } = useAgentStore();
  const chatSessions = useChatSessionStore((s) => s.sessions ?? []);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<BotCategory | "all">("all");
  const [groupChatOpen, setGroupChatOpen] = useState(false);
  const [sections, setSections] = useState<BotHubSection[]>(() => loadBotHubSections());
  const [newSectionName, setNewSectionName] = useState("");
  const [addingSection, setAddingSection] = useState(false);

  // HTML5 drag state: which card is in flight and which heading is a live
  // drop target. Esc cancels (drop targets stop accepting until dragend).
  const [draggingBotId, setDraggingBotId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const dragCancelledRef = useRef(false);

  useEffect(() => {
    if (!draggingBotId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dragCancelledRef.current = true;
        setDropTargetId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draggingBotId]);

  const patchSections = useCallback((next: BotHubSection[]) => {
    setSections(next);
    saveBotHubSections(next);
  }, []);

  const bots = useMemo(() => getBots(agents), [agents]);

  const sessionCountByBotId = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of chatSessions) {
      if (session.metadata?.sessionMode !== "agent") continue;
      if (session.metadata?.isGroupChat === true) continue;
      const id = (session.metadata?.agentId as string | undefined) ?? (session.metadata?.agentName as string | undefined) ?? "unknown";
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [chatSessions]);

  const filteredBots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bots.filter((bot) => {
      if (categoryFilter !== "all" && bot.botProfile.botCategory !== categoryFilter) return false;
      if (!q) return true;
      const displayName = bot.botProfile.displayName.toLowerCase();
      const name = bot.name.toLowerCase();
      const tagline = (bot.botProfile.tagline || "").toLowerCase();
      const description = bot.description.toLowerCase();
      return (
        displayName.includes(q) ||
        name.includes(q) ||
        tagline.includes(q) ||
        description.includes(q)
      );
    });
  }, [bots, categoryFilter, searchQuery]);

  // Sectioned view only when neither search nor a category chip narrows the
  // roster — narrowing falls back to the flat grid so hidden bots stay
  // findable via search.
  const isFiltering = searchQuery.trim() !== "" || categoryFilter !== "all";

  const layout = useMemo(
    () => groupBotsBySection(filteredBots, sections),
    [filteredBots, sections]
  );

  const handleOpenBot = (botId: string) => {
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", {
        detail: { viewType: "bot-home", context: { botId } },
      })
    );
  };

  const handleStartGroupChat = async (selectedBots: Agent[], name: string) => {
    const result = await startBotGroupChat({ bots: selectedBots, name });
    if (result?.groupId) {
      window.dispatchEvent(
        new CustomEvent("allternit:open-view", {
          detail: {
            viewType: "group-chat",
            context: { groupId: result.groupId },
          },
        })
      );
    }
  };

  const handleDragStart = (e: React.DragEvent, botId: string) => {
    dragCancelledRef.current = false;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", botId);
    setDraggingBotId(botId);
  };

  const handleDragEnd = () => {
    setDraggingBotId(null);
    setDropTargetId(null);
    dragCancelledRef.current = false;
  };

  const handleSectionDragOver = (e: React.DragEvent, sectionId: string) => {
    if (!draggingBotId || dragCancelledRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTargetId !== sectionId) setDropTargetId(sectionId);
  };

  const handleSectionDrop = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    const botId = e.dataTransfer.getData("text/plain") || draggingBotId;
    const cancelled = dragCancelledRef.current;
    handleDragEnd();
    if (!botId || cancelled) return;
    const bot = bots.find((b) => b.id === botId);
    if (!bot) return;
    const target =
      sectionId === ALL_BOTS_SECTION_ID
        ? // "All bots" clears the user-managed membership; resolution falls
          // back to the bot's category bucket.
          resolveBotSectionId(
            { ...bot, botProfile: { ...bot.botProfile, sectionId: undefined } },
            sections
          )
        : sectionId;
    const current = resolveBotSectionId(bot, sections);
    if (target === current) return;
    // Membership lives ON the bot — the section list is never mutated by a
    // move, so a section deletion can never orphan a bot.
    const nextProfile = { ...bot.botProfile, sectionId: target };
    void updateAgent(bot.id, { botProfile: nextProfile }).catch((err) => {
      console.error("[BotHub] failed to move bot to section", err);
    });
  };

  const renderCard = (bot: Agent, index: number) => (
    <div
      key={bot.id}
      draggable
      onDragStart={(e) => handleDragStart(e, bot.id)}
      onDragEnd={handleDragEnd}
      className={cn(draggingBotId === bot.id && "opacity-40")}
    >
      <BotHubCard
        bot={bot}
        sessionCount={sessionCountByBotId.get(bot.id) ?? 0}
        onClick={() => handleOpenBot(bot.id)}
        index={index}
      />
    </div>
  );

  const renderBotGrid = (list: Agent[]) => (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {list.map((bot, index) => renderCard(bot, index))}
    </div>
  );

  return (
    <div className="h-full w-full overflow-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-8 pb-12 pt-6">
        <div className="mb-8 flex flex-col gap-5">
          <div>
            <h2 className="text-xl font-medium text-[var(--text-primary)]">Your bots</h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Discover, launch, and manage your packaged bots.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex h-11 flex-1 items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 transition-colors focus-within:border-[var(--accent-primary)]">
              <MagnifyingGlass size={16} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                aria-label="Search bots"
                type="text"
                placeholder="Search bots…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border-none bg-transparent text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setGroupChatOpen(true)}
              className="hidden h-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-transparent px-4 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] sm:inline-flex"
            >
              <Users size={16} />
              New group chat
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-[13px] font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
            >
              <Plus size={16} />
              Create bot
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              label="All"
              active={categoryFilter === "all"}
              onClick={() => setCategoryFilter("all")}
            />
            {(Object.keys(BOT_CATEGORIES) as BotCategory[]).map((category) => (
              <FilterChip
                key={category}
                label={BOT_CATEGORIES[category].label}
                active={categoryFilter === category}
                onClick={() => setCategoryFilter(category)}
              />
            ))}
          </div>
        </div>

        {isLoadingAgents ? (
          <div className="flex h-64 items-center justify-center">
            <div className="size-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
          </div>
        ) : bots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Robot size={48} className="text-[var(--text-tertiary)] opacity-40" />
            <h3 className="text-sm font-normal text-[var(--text-secondary)]">No bots yet.</h3>
            <p className="max-w-xs text-[13px] text-[var(--text-tertiary)]">
              Pick a template, give it a name, and you're live — everything else is pre-configured.
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-[13px] font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
            >
              <Plus size={16} />
              Create bot
            </button>
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Robot size={48} className="text-[var(--text-tertiary)] opacity-40" />
            <h3 className="text-sm font-normal text-[var(--text-secondary)]">No bots match.</h3>
            <p className="max-w-xs text-[13px] text-[var(--text-tertiary)]">
              Try a different search or category filter.
            </p>
          </div>
        ) : isFiltering ? (
          renderBotGrid(filteredBots)
        ) : (
          <div className="flex flex-col gap-8">
            {layout.sections.map(({ section, bots: sectionBots }) => {
              // Sleek rail: empty sections stay out of the way unless a drag
              // is in flight (they make valid drop targets then).
              if (sectionBots.length === 0 && !(draggingBotId && !section.hidden)) return null;
              const isDropTarget = dropTargetId === section.id && !dragCancelledRef.current;
              return (
                <section key={section.id} className="flex flex-col gap-3">
                  <SectionHeading
                    section={section}
                    count={sectionBots.length}
                    isDropTarget={isDropTarget}
                    isCustom={section.id.startsWith("custom:")}
                    onToggleCollapse={() =>
                      patchSections(
                        updateBotHubSection(sections, section.id, { collapsed: !section.collapsed })
                      )
                    }
                    onToggleHidden={() =>
                      patchSections(
                        updateBotHubSection(sections, section.id, { hidden: !section.hidden })
                      )
                    }
                    onDelete={() => patchSections(deleteBotHubSection(sections, section.id))}
                    onDragOver={(e) => handleSectionDragOver(e, section.id)}
                    onDrop={(e) => handleSectionDrop(e, section.id)}
                  />
                  {!section.hidden && !section.collapsed &&
                    (sectionBots.length > 0 ? (
                      renderBotGrid(sectionBots)
                    ) : (
                      <p className="px-1 text-xs text-[var(--text-tertiary)]">
                        Drag a bot onto this heading.
                      </p>
                    ))}
                  {section.hidden && (
                    <p className="px-1 text-xs text-[var(--text-tertiary)]">
                      {sectionBots.length} bot{sectionBots.length === 1 ? "" : "s"} hidden — search
                      still finds them.
                    </p>
                  )}
                </section>
              );
            })}

            {/* Uncategorized bucket — always exists, never deletable. */}
            {(layout.allBots.length > 0 || draggingBotId) && (
              <section className="flex flex-col gap-3">
                <SectionHeading
                  section={{
                    id: ALL_BOTS_SECTION_ID,
                    label: "All bots",
                    collapsed: false,
                    hidden: false,
                  }}
                  count={layout.allBots.length}
                  isDropTarget={dropTargetId === ALL_BOTS_SECTION_ID && !dragCancelledRef.current}
                  isCustom={false}
                  onToggleCollapse={undefined}
                  onToggleHidden={undefined}
                  onDelete={undefined}
                  onDragOver={(e) => handleSectionDragOver(e, ALL_BOTS_SECTION_ID)}
                  onDrop={(e) => handleSectionDrop(e, ALL_BOTS_SECTION_ID)}
                />
                {layout.allBots.length > 0 && renderBotGrid(layout.allBots)}
              </section>
            )}

            <div className="flex items-center gap-2">
              {addingSection ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = newSectionName.trim();
                    if (!name) {
                      setAddingSection(false);
                      return;
                    }
                    patchSections(createCustomSection(sections, name));
                    setNewSectionName("");
                    setAddingSection(false);
                  }}
                >
                  <input
                    autoFocus
                    aria-label="New section name"
                    type="text"
                    placeholder="Section name…"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setAddingSection(false);
                        setNewSectionName("");
                      }
                    }}
                    className="h-9 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                  />
                  <button
                    type="submit"
                    className="h-9 rounded-lg bg-[var(--text-primary)] px-3 text-[13px] font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
                  >
                    Add
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingSection(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-default)] px-3 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                >
                  <Plus size={14} />
                  New section
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <BotGroupChatModal
        isOpen={groupChatOpen}
        bots={bots}
        onClose={() => setGroupChatOpen(false)}
        onStart={handleStartGroupChat}
      />
    </div>
  );
}

function SectionHeading({
  section,
  count,
  isDropTarget,
  isCustom,
  onToggleCollapse,
  onToggleHidden,
  onDelete,
  onDragOver,
  onDrop,
}: {
  section: BotHubSection;
  count: number;
  isDropTarget: boolean;
  isCustom: boolean;
  onToggleCollapse?: () => void;
  onToggleHidden?: () => void;
  onDelete?: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const collapsible = Boolean(onToggleCollapse);
  return (
    <div
      role="button"
      tabIndex={collapsible ? 0 : undefined}
      onClick={collapsible ? onToggleCollapse : undefined}
      onKeyDown={
        collapsible
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onToggleCollapse?.();
            }
          : undefined
      }
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
        isDropTarget
          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
          : "border-transparent hover:bg-[var(--surface-hover)]",
        collapsible && "cursor-pointer"
      )}
    >
      {collapsible ? (
        section.collapsed ? (
          <CaretRight size={14} className="text-[var(--text-tertiary)]" />
        ) : (
          <CaretDown size={14} className="text-[var(--text-tertiary)]" />
        )
      ) : (
        <span className="w-3.5" />
      )}
      <h3 className="text-sm font-medium text-[var(--text-primary)]">{section.label}</h3>
      <span className="text-xs text-[var(--text-tertiary)]">{count}</span>
      {section.hidden && <EyeSlash size={13} className="text-[var(--text-tertiary)]" />}
      <span className="flex-1" />
      <span
        className={cn(
          "flex items-center gap-1",
          "opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        )}
      >
        {onToggleHidden && (
          <button
            type="button"
            aria-label={section.hidden ? `Show ${section.label}` : `Hide ${section.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHidden();
            }}
            className="rounded p-1 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
          >
            {section.hidden ? <Eye size={14} /> : <EyeSlash size={14} />}
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            aria-label={`Delete ${section.label}`}
            title="Delete section (bots are kept)"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded p-1 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <X size={14} />
          </button>
        )}
      </span>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-lg px-3 text-xs font-medium capitalize transition-colors",
        active
          ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      )}
    >
      {label}
    </button>
  );
}
