"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CaretDown,
  ChatTeardropText,
  Plus,
  PencilSimple,
  Archive,
  Trash,
  Check,
  X,
} from "@phosphor-icons/react";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { useAgentStore } from "@/lib/agents/agent.store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { getBotDisplayName } from "@/lib/bots/bot-profile";

interface BotTaskPickerProps {
  botId: string;
  accentColor?: string;
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return mo === 1 ? "1 month ago" : `${mo} months ago`;
  const yr = Math.floor(mo / 12);
  return yr === 1 ? "1 year ago" : `${yr} years ago`;
}

/**
 * Per-bot task picker for bot chat sessions.
 *
 * A "task" is an isolated chat session scoped to the bot. This component
 * derives the task list from chat sessions where `metadata.isBot === true` and
 * `metadata.agentId === botId`, and lets the user create, rename, switch,
 * archive, and delete tasks.
 */
export function BotTaskPicker({ botId, accentColor }: BotTaskPickerProps) {
  const activeSessionId = useChatSessionStore((state) => state.activeSessionId);
  const sessions = useChatSessionStore((state) => state.sessions);
  const createSession = useChatSessionStore((state) => state.createSession);
  const updateSession = useChatSessionStore((state) => state.updateSession);
  const deleteSession = useChatSessionStore((state) => state.deleteSession);
  const setActiveSession = useChatSessionStore((state) => state.setActiveSession);
  const agent = useAgentStore((state) => state.agents.find((a) => a.id === botId));

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const tasks = useMemo(() => {
    return sessions
      .filter(
        (s) =>
          s.metadata?.isBot === true &&
          s.metadata?.agentId === botId &&
          s.metadata?.isArchived !== true
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [sessions, botId]);

  const currentTask = useMemo(() => {
    if (!activeSessionId) return tasks[0] ?? null;
    return tasks.find((t) => t.id === activeSessionId) || tasks[0] || null;
  }, [tasks, activeSessionId]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleCreateTask = useCallback(async () => {
    if (!agent) return;
    const displayName = getBotDisplayName(agent);
    const now = new Date().toISOString();
    const baseName = `${displayName} Task ${tasks.length + 1}`;

    const sessionId = await createSession({
      name: baseName,
      sessionMode: "agent",
      agentId: agent.id,
      agentName: agent.name,
      systemPrompt: agent.systemPrompt,
      metadata: {
        isBot: true,
        agentId: agent.id,
        originSurface: "chat",
        botProfile: agent.botProfile,
      },
    });

    if (sessionId) {
      // Persist explicit task metadata (id, title, createdAt) in session metadata.
      await updateSession(sessionId, {
        metadata: {
          originSurface: "chat",
          taskId: sessionId,
          taskTitle: baseName,
          taskCreatedAt: now,
        },
      });
      setActiveSession(sessionId);
      setOpen(false);
    }
  }, [agent, createSession, setActiveSession, tasks.length, updateSession]);

  const handleSwitchTask = useCallback(
    (sessionId: string) => {
      setActiveSession(sessionId);
      setOpen(false);
    },
    [setActiveSession]
  );

  const startRename = useCallback(
    (task: (typeof tasks)[number], e?: React.MouseEvent) => {
      e?.stopPropagation();
      setEditingId(task.id);
      setEditValue(task.name || "");
    },
    []
  );

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditValue("");
  }, []);

  const commitRename = useCallback(async () => {
    if (!editingId || !editValue.trim()) {
      cancelRename();
      return;
    }
    await updateSession(editingId, {
      name: editValue.trim(),
      metadata: { originSurface: "chat", taskTitle: editValue.trim() },
    });
    cancelRename();
  }, [editingId, editValue, updateSession, cancelRename]);

  const handleArchive = useCallback(
    async (sessionId: string) => {
      await updateSession(sessionId, {
        metadata: {
          originSurface: "chat",
          isArchived: true,
          archivedAt: new Date().toISOString(),
        },
      });
    },
    [updateSession]
  );

  const handleDelete = useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId);
    },
    [deleteSession]
  );

  if (!agent) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-state={open ? "open" : "closed"}
          className="group inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-2.5 py-1 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-active)]"
        >
          <ChatTeardropText
            size={14}
            style={{ color: accentColor || "var(--accent-primary)" }}
          />
          <span className="max-w-[200px] truncate">
            {currentTask?.name || "Tasks"}
          </span>
          <CaretDown
            size={12}
            className="text-[var(--text-tertiary)] transition-transform group-data-[state=open]:rotate-180"
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-80 overflow-hidden rounded-xl border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2.5">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Tasks
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleCreateTask()}
            className="h-7 gap-1 px-2 text-[12px]"
          >
            <Plus size={12} />
            New
          </Button>
        </div>

        <div className="max-h-[360px] overflow-y-auto py-1">
          {tasks.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <ChatTeardropText
                size={24}
                className="mx-auto mb-2 text-[var(--text-tertiary)]"
              />
              <p className="text-[13px] text-[var(--text-secondary)]">
                No tasks yet
              </p>
              <Button
                size="sm"
                onClick={() => void handleCreateTask()}
                className="mt-3 gap-1"
              >
                <Plus size={12} />
                Create task
              </Button>
            </div>
          ) : (
            tasks.map((task) => {
              const isEditing = editingId === task.id;
              const isActive = currentTask?.id === task.id;

              return (
                <div
                  key={task.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 transition-colors",
                    isActive
                      ? "bg-[var(--accent-primary)]/5"
                      : "hover:bg-[var(--surface-hover)]"
                  )}
                >
                  {isEditing ? (
                    <>
                      <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void commitRename();
                          if (e.key === "Escape") cancelRename();
                        }}
                        className="flex h-7 flex-1 rounded-lg border border-[var(--ui-border-default)] bg-[var(--surface-hover)] px-2 py-1 text-[13px] text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => void commitRename()}
                        className="shrink-0 inline-flex size-7 items-center justify-center rounded-md text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10"
                      >
                        <Check size={12} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="shrink-0 inline-flex size-7 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]"
                      >
                        <X size={12} weight="bold" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSwitchTask(task.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div
                          className={cn(
                            "truncate text-[13px]",
                            isActive
                              ? "font-medium text-[var(--accent-primary)]"
                              : "text-[var(--text-primary)]"
                          )}
                        >
                          {task.name || "Untitled"}
                        </div>
                        <div className="text-[11px] text-[var(--text-tertiary)]">
                          {task.messageCount} message
                          {task.messageCount === 1 ? "" : "s"} •{" "}
                          {relativeTime(task.updatedAt)}
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => startRename(task, e)}
                          className="inline-flex size-7 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                          aria-label="Rename task"
                        >
                          <PencilSimple size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleArchive(task.id)}
                          className="inline-flex size-7 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                          aria-label="Archive task"
                        >
                          <Archive size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(task.id)}
                          className="inline-flex size-7 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--status-error)]/10 hover:text-[var(--status-error)]"
                          aria-label="Delete task"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
