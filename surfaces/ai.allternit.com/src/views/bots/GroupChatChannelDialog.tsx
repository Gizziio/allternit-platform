"use client";

/**
 * Group Chat Channel Dialog
 *
 * Create or edit a group channel: name, members, default responder, bulletin,
 * and working folder. Members are selected from the unified bot roster.
 *
 * @module GroupChatChannelDialog
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUnifiedRoster } from "@/lib/bots/use-unified-roster";
import type {
  GroupChat,
  GroupChatMember,
  GroupChatMetadata,
} from "@/lib/bots/group-chat.types";

export interface GroupChatChannelFormData {
  name: string;
  members: GroupChatMember[];
  metadata?: GroupChatMetadata;
}

export interface GroupChatChannelDialogProps {
  group?: GroupChat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: GroupChatChannelFormData) => void;
}

export function GroupChatChannelDialog({
  group,
  open,
  onOpenChange,
  onSave,
}: GroupChatChannelDialogProps) {
  const isEditing = Boolean(group);
  const roster = useUnifiedRoster();

  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [defaultResponderId, setDefaultResponderId] = useState<string>("");
  const [bulletin, setBulletin] = useState("");
  const [workingFolder, setWorkingFolder] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (group) {
      setName(group.name);
      setSelectedIds(new Set(group.members.map((m) => m.botId)));
      setDefaultResponderId(group.metadata?.defaultResponderId ?? "");
      setBulletin(group.metadata?.bulletin ?? "");
      setWorkingFolder(group.metadata?.workingFolder ?? "");
    } else {
      setName("");
      setSelectedIds(new Set());
      setDefaultResponderId("");
      setBulletin("");
      setWorkingFolder("");
    }
    setError(null);
  }, [group, open]);

  const selectedMembers = useMemo(() => {
    return roster.filter((bot) => selectedIds.has(bot.id));
  }, [roster, selectedIds]);

  const toggleBot = useCallback((botId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(botId)) {
        next.delete(botId);
      } else {
        next.add(botId);
      }
      return next;
    });
  }, []);

  const handleResponderChange = useCallback(
    (botId: string) => {
      setDefaultResponderId(botId);
      if (botId) setSelectedIds((prev) => new Set(prev).add(botId));
    },
    []
  );

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Channel name is required.");
      return;
    }
    if (selectedIds.size < 2) {
      setError("Add at least two bots to start a group chat.");
      return;
    }

    const members: GroupChatMember[] = selectedMembers.map((bot) => ({
      botId: bot.id,
      displayName: bot.displayName,
      handle: bot.handle,
      source: bot.source,
      providerId: bot.providerId,
    }));

    const metadata: GroupChatMetadata = {
      bulletin: bulletin.trim() || undefined,
      workingFolder: workingFolder.trim() || undefined,
      defaultResponderId: defaultResponderId || undefined,
    };

    onSave({ name: trimmedName, members, metadata });
    onOpenChange(false);
  }, [
    name,
    selectedIds,
    selectedMembers,
    defaultResponderId,
    bulletin,
    workingFolder,
    onSave,
    onOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit channel" : "New group channel"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the channel name, members, and shared settings."
              : "Create a channel where bots can collaborate in bounded rounds."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Channel name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering standup"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Members ({selectedIds.size})
            </label>
            <div className="max-h-40 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-1">
              {roster.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">
                  No bots available. Create a bot first.
                </div>
              ) : (
                roster.map((bot) => {
                  const selected = selectedIds.has(bot.id);
                  return (
                    <button
                      key={bot.id}
                      type="button"
                      onClick={() => toggleBot(bot.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                        selected
                          ? "bg-[var(--accent-primary)]/10 text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          selected
                            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                            : "border-[var(--border-subtle)]"
                        )}
                      >
                        {selected && "✓"}
                      </span>
                      <span
                        className="h-5 w-5 rounded-full"
                        style={{
                          background:
                            `${bot.accentColor ?? "var(--accent-primary)"}20`,
                        }}
                      />
                      <span className="flex-1 truncate">{bot.displayName}</span>
                      <span className="text-[10px] text-[var(--text-tertiary)]">
                        @{bot.handle}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Default responder
            </label>
            <select
              value={defaultResponderId}
              onChange={(e) => handleResponderChange(e.target.value)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="">First available</option>
              {selectedMembers.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Bulletin / topic
            </label>
            <input
              type="text"
              value={bulletin}
              onChange={(e) => setBulletin(e.target.value)}
              placeholder="What is this channel for?"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Working folder
            </label>
            <input
              type="text"
              value={workingFolder}
              onChange={(e) => setWorkingFolder(e.target.value)}
              placeholder="/path/to/shared/folder"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          {error && (
            <div className="rounded-md bg-[var(--status-error)]/10 px-3 py-2 text-xs text-[var(--status-error)]">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            {isEditing ? "Save changes" : "Create channel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GroupChatChannelDialog;
