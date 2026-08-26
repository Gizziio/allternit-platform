"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChatTeardropText, DotsThree, PencilSimple, Copy, Trash } from "@phosphor-icons/react";
import type { Agent } from "@/lib/agents/agent.types";
import { useAgentStore } from "@/lib/agents/agent.store";
import { getBotAccentColor, getBotDisplayName, getBotTagline, BOT_CATEGORIES } from "@/lib/bots/bot-profile";
import { BotAvatar } from "@/views/bots/BotAvatar";
import { ConfirmModal } from "@/components/ConfirmModal";
import { cn } from "@/lib/utils";

interface BotHubCardProps {
  bot: Agent;
  sessionCount?: number;
  onClick: () => void;
  index?: number;
}

export function BotHubCard({ bot, sessionCount = 0, onClick, index = 0 }: BotHubCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { deleteAgent, setDraftAgent, setIsCreating } = useAgentStore();

  const displayName = getBotDisplayName(bot);
  const tagline = getBotTagline(bot);
  const accentColor = getBotAccentColor(bot) ?? "var(--accent-primary)";
  const category = bot.botProfile?.botCategory;
  const categoryLabel = category ? BOT_CATEGORIES[category]?.label : undefined;

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setDraftAgent({
      name: `${bot.name} (Copy)`,
      description: bot.description,
      type: bot.type,
      model: bot.model,
      provider: bot.provider,
      capabilities: bot.capabilities,
      systemPrompt: bot.systemPrompt,
      tools: bot.tools,
      maxIterations: bot.maxIterations,
      temperature: bot.temperature,
      source: "personal",
      isBot: true,
      botProfile: bot.botProfile
        ? { ...bot.botProfile, displayName: `${bot.botProfile.displayName} (Copy)` }
        : undefined,
    });
    setIsCreating(true);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    onClick();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setConfirmDelete(true);
  };

  return (
    <>
      <motion.div
        data-bot-id={bot.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.3 }}
        onClick={() => !menuOpen && onClick()}
        onMouseLeave={() => setMenuOpen(false)}
        className={cn(
          "group relative flex cursor-pointer flex-col rounded-xl border border-solid bg-[var(--bg-elevated)] p-5 transition-all duration-200",
          "border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-md"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <BotAvatar bot={bot} size={44} />
          <div className="flex flex-1 flex-col min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-[var(--text-primary)] leading-snug">
              {displayName}
            </h3>
            {tagline && (
              <p className="mt-0.5 truncate text-[13px] text-[var(--text-tertiary)]">
                {tagline}
              </p>
            )}
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="flex size-8 items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              <DotsThree size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--surface-panel)] p-1 shadow-2xl">
                <MenuItem icon={<ChatTeardropText size={14} />} label="Open" onClick={handleEdit} />
                <MenuItem icon={<PencilSimple size={14} />} label="Edit" onClick={handleEdit} />
                <MenuItem icon={<Copy size={14} />} label="Duplicate" onClick={handleDuplicate} />
                <div className="my-1 h-px bg-[var(--border-subtle)]" />
                <MenuItem icon={<Trash size={14} />} label="Delete" danger onClick={handleDelete} />
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {categoryLabel && (
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-medium capitalize"
              style={{ background: "var(--surface-hover)", color: "var(--text-secondary)" }}
            >
              {categoryLabel}
            </span>
          )}
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {sessionCount === 0 ? "No sessions" : `${sessionCount} session${sessionCount === 1 ? "" : "s"}`}
          </span>
        </div>

        <div
          className="mt-4 h-1 w-full rounded-full opacity-40"
          style={{ background: accentColor }}
        />
      </motion.div>

      <ConfirmModal
        isOpen={confirmDelete}
        title="Delete Bot"
        message={`Delete bot "${displayName}"?`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => { setConfirmDelete(false); deleteAgent(bot.id); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-[12px] transition-colors",
        danger
          ? "text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
