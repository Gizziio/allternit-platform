"use client";

/**
 * Groups List View
 *
 * Top-level surface for bot group chats. Lists existing channels, shows unread
 * counts, and lets the user create a new group channel.
 *
 * @module GroupsListView
 */

import React, { useCallback, useMemo, useState } from "react";
import { Plus, Users } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useGroupChatStore } from "@/lib/bots/group-chat.store";
import { useUnifiedRoster } from "@/lib/bots/use-unified-roster";
import { GroupChatAvatar } from "./GroupChatAvatar";
import { GroupChatRosterItem } from "./GroupChatRosterItem";
import {
  GroupChatChannelDialog,
  type GroupChatChannelFormData,
} from "./GroupChatChannelDialog";

export interface GroupsListViewProps {
  onOpenGroup?: (groupId: string) => void;
}

export function GroupsListView({ onOpenGroup }: GroupsListViewProps) {
  const groups = useGroupChatStore((s) => s.groups);
  const activeGroupId = useGroupChatStore((s) => s.activeGroupId);
  const getUnreadCount = useGroupChatStore((s) => s.getUnreadCount);
  const createGroup = useGroupChatStore((s) => s.createGroup);
  const setActiveGroup = useGroupChatStore((s) => s.setActiveGroup);
  const roster = useUnifiedRoster();

  const [showDialog, setShowDialog] = useState(false);

  const sortedGroups = useMemo(() => {
    return Object.values(groups).sort(
      (a, b) =>
        new Date(b.updatedAt ?? 0).getTime() -
        new Date(a.updatedAt ?? 0).getTime()
    );
  }, [groups]);

  const totalUnread = useMemo(
    () => sortedGroups.reduce((sum, g) => sum + getUnreadCount(g.id), 0),
    [sortedGroups, getUnreadCount]
  );

  const handleSelectGroup = useCallback(
    (groupId: string) => {
      setActiveGroup(groupId);
      onOpenGroup?.(groupId);
    },
    [onOpenGroup, setActiveGroup]
  );

  const handleCreateGroup = useCallback(
    (data: GroupChatChannelFormData) => {
      const groupId = createGroup(data.name, data.members, data.metadata);
      setActiveGroup(groupId);
      onOpenGroup?.(groupId);
    },
    [createGroup, onOpenGroup, setActiveGroup]
  );

  return (
    <div className="flex h-full flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] pt-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
            <Users size={22} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold">Groups</h2>
              {totalUnread > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--accent-primary)] px-1.5 text-[11px] font-semibold text-[var(--ui-text-inverse)]">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-[var(--text-secondary)]">
              {sortedGroups.length} channel{sortedGroups.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => setShowDialog(true)}
          disabled={roster.length < 2}
          className="gap-1.5 rounded-lg"
          style={{
            background: "var(--accent-primary)",
            color: "#fff",
          }}
        >
          <Plus size={16} weight="bold" />
          New group
        </Button>
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {sortedGroups.length === 0 ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center px-4">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              <Users size={28} weight="duotone" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              No group chats yet
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Create a group to chat with multiple bots at once. They can
              @mention each other and respond in turns.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDialog(true)}
              disabled={roster.length < 2}
              className="mt-5 gap-1.5 rounded-lg"
            >
              <Plus size={16} weight="bold" />
              Create first group
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sortedGroups.map((group) => (
              <GroupChatRosterItem
                key={group.id}
                group={group}
                unreadCount={getUnreadCount(group.id)}
                isSelected={activeGroupId === group.id}
                onSelect={handleSelectGroup}
              />
            ))}
          </div>
        )}
      </div>

      <GroupChatChannelDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSave={handleCreateGroup}
      />
    </div>
  );
}

export default GroupsListView;
