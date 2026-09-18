"use client";

/**
 * OpenMaus `BotProjectDialog` — folders only organize threads.
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Folder, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { BotFolder } from "@/lib/bots/bot-folders.store";
import { useBotFoldersStore } from "@/lib/bots/bot-folders.store";
import { listBotThreads, moveBotThread } from "@/lib/bots/bot-threads";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { useBotRosterStore } from "@/lib/bots/bot-roster.store";

const FOLDER_EMOJI = ["📁", "💼", "🏠", "📬", "💡", "🚀", "🎨", "🧪", "📚", "🌱", "⭐", "🛠️"];

export function FolderIcon({ emoji, size = 13 }: { emoji?: string; size?: number }) {
  if (emoji) {
    return (
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center leading-none"
        style={{ width: size, fontSize: size }}
      >
        {emoji}
      </span>
    );
  }
  return <Folder size={size} className="shrink-0" aria-hidden />;
}

export function BotFolderDialog({
  botId,
  botName,
  folder,
  onClose,
}: {
  botId: string;
  botName: string;
  folder?: BotFolder;
  onClose: () => void;
}) {
  const createFolder = useBotFoldersStore((s) => s.createFolder);
  const updateFolder = useBotFoldersStore((s) => s.updateFolder);
  const deleteFolder = useBotFoldersStore((s) => s.deleteFolder);
  const sessions = useChatSessionStore((s) => s.sessions);
  const canonicalId = useBotRosterStore((s) => s.canonicalChatIds[botId]);
  const [name, setName] = useState(folder?.name ?? "");
  const [emoji, setEmoji] = useState(folder?.emoji ?? "");
  const [choosingIcon, setChoosingIcon] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={folder ? "Folder settings" : "New folder"}
        className="max-h-[85dvh] w-full max-w-[420px] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
            {folder ? "Folder settings" : "New folder"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            <X size={16} />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            if (folder) updateFolder(botId, folder.id, { name: name.trim(), emoji: emoji.trim() || null });
            else createFolder(botId, name.trim(), emoji.trim() || undefined);
            onClose();
          }}
        >
          <label className="block text-[12px] text-[var(--text-secondary)]">
            Name
            <input
              ref={nameRef}
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]/60"
            />
          </label>
          <button
            type="button"
            aria-expanded={choosingIcon}
            onClick={() => setChoosingIcon((open) => !open)}
            className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-2.5 py-2 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            <FolderIcon emoji={emoji} size={18} />
            Icon
          </button>
          {choosingIcon && (
            <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-3">
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  aria-pressed={!emoji}
                  onClick={() => setEmoji("")}
                  className={cn(
                    "flex size-8 items-center justify-center rounded hover:bg-[var(--surface-hover)]",
                    !emoji && "bg-[var(--surface-hover)]",
                  )}
                >
                  <FolderIcon size={18} />
                </button>
                {FOLDER_EMOJI.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    aria-pressed={emoji === icon}
                    onClick={() => setEmoji(icon)}
                    className={cn(
                      "size-8 rounded text-lg hover:bg-[var(--surface-hover)]",
                      emoji === icon && "bg-[var(--surface-hover)]",
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            Folders only organize {botName}’s threads. They do not change the model or computer.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-[13px] font-medium text-[var(--ui-text-inverse,#fff)] disabled:opacity-40"
            >
              {folder ? "Save" : "Create"}
            </button>
          </div>
        </form>
        {folder && (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
            {deleting ? (
              <>
                <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  Threads stay. They just leave this folder.
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const threads = listBotThreads(botId, sessions ?? [], canonicalId).filter(
                        (thread) => thread.folderId === folder.id,
                      );
                      void Promise.all(threads.map((thread) => moveBotThread(thread.sessionId, null)));
                      deleteFolder(botId, folder.id);
                      onClose();
                    }}
                    className="text-[12px] text-[var(--status-error)] hover:underline"
                  >
                    Delete folder
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(false)}
                    className="text-[12px] text-[var(--text-secondary)] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setDeleting(true)}
                className="text-[12px] text-[var(--status-error)] hover:underline"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
