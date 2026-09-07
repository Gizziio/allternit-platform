"use client";

import React, { useMemo, useState } from "react";
import { X, Users, Check, CircleNotch } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import type { Agent } from "@/lib/agents/agent.types";
import { getBotDisplayName, getBotTagline, isGroupChatEnabled } from "@/lib/bots/bot-profile";
import { BotAvatar } from "@/views/bots/BotAvatar";
import { cn } from "@/lib/utils";

interface BotGroupChatModalProps {
  isOpen: boolean;
  bots: Agent[];
  onClose: () => void;
  onStart: (selectedBots: Agent[], name: string) => void | Promise<void>;
}

export function BotGroupChatModal({ isOpen, bots, onClose, onStart }: BotGroupChatModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const eligibleBots = useMemo(() => bots.filter((bot) => isGroupChatEnabled(bot)), [bots]);

  const toggleBot = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 6) {
        next.add(id);
      }
      return next;
    });
  };

  const handleStart = async () => {
    if (selectedIds.size < 2) return;
    const selectedBots = eligibleBots.filter((bot) => selectedIds.has(bot.id));
    if (selectedBots.length < 2) return;
    setIsStarting(true);
    try {
      await onStart(
        selectedBots,
        groupName.trim() ||
          `${selectedBots.map((b) => getBotDisplayName(b)).join(", ").slice(0, 60)}`
      );
      setSelectedIds(new Set());
      setGroupName("");
    } finally {
      setIsStarting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-[var(--accent-primary)]" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Start group chat</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4">
              <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-secondary)]">
                Group name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Research Squad"
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-3.5 py-2.5 text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="max-h-[360px] overflow-y-auto px-5 pb-4">
              <p className="mb-2 text-[12px] font-medium text-[var(--text-secondary)]">
                Choose 2–6 bots to include ({selectedIds.size} selected)
              </p>
              {eligibleBots.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[var(--text-tertiary)]">
                  No bots are enabled for group chat yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {eligibleBots.map((bot) => {
                    const selected = selectedIds.has(bot.id);
                    return (
                      <button
                        key={bot.id}
                        type="button"
                        data-group-bot-id={bot.id}
                        onClick={() => toggleBot(bot.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                          selected
                            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                            : "border-[var(--border-default)] bg-[var(--bg-primary)] hover:border-[var(--border-hover)]"
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                            selected
                              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--bg-elevated)]"
                              : "border-[var(--border-default)] bg-transparent"
                          )}
                        >
                          {selected && <Check size={12} weight="bold" />}
                        </div>
                        <BotAvatar bot={bot} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                            {getBotDisplayName(bot)}
                          </p>
                          {getBotTagline(bot) && (
                            <p className="truncate text-[12px] text-[var(--text-tertiary)]">
                              {getBotTagline(bot)}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-lg border border-[var(--border-default)] bg-transparent px-4 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={selectedIds.size < 2 || selectedIds.size > 6 || isStarting}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-[13px] font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isStarting && <CircleNotch size={14} className="animate-spin" />}
                Start chat
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
