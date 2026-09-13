import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUp01Icon,
  ArrowDown01Icon,
  Delete01Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { SETTINGS_SELECT_CLASS } from "@/components/console-ui";

export interface EditableMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessagesEditorProps {
  messages: EditableMessage[];
  onChange: (messages: EditableMessage[]) => void;
}

const TEXTAREA_CLASS =
  "w-full resize-y rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 font-mono text-[12px] leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-default)]";

const ICON_BUTTON_CLASS =
  "inline-flex size-7 items-center justify-center rounded-md border border-solid border-[var(--border-subtle)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * Ordered chat message list with role editing, reorder, and add/remove —
 * the console's "Build your request" messages block.
 */
export function MessagesEditor({
  messages,
  onChange,
}: MessagesEditorProps): React.ReactNode {
  const update = (id: string, patch: Partial<EditableMessage>) =>
    onChange(
      messages.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= messages.length) return;
    const next = messages.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  const remove = (id: string) => onChange(messages.filter((m) => m.id !== id));

  const add = (role: "user" | "assistant") =>
    onChange([
      ...messages,
      {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role,
        content: "",
      },
    ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
          Messages
        </span>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => add("user")} className={ICON_BUTTON_CLASS} title="Add user message">
            <HugeiconsIcon icon={PlusSignIcon} size={13} />
          </button>
          <button
            type="button"
            onClick={() => add("assistant")}
            className={cn(ICON_BUTTON_CLASS, "w-auto px-2 text-[11px] font-semibold")}
            title="Add assistant message"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={13} /> assistant
          </button>
        </div>
      </div>

      {messages.length === 0 && (
        <p className="m-0 text-[12px] text-[var(--text-tertiary)]">
          No messages yet — add a user message to get started.
        </p>
      )}

      {messages.map((message, index) => (
        <div
          key={message.id}
          className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <select
              value={message.role}
              onChange={(e) =>
                update(message.id, {
                  role: e.target.value as "user" | "assistant",
                })
              }
              className={SETTINGS_SELECT_CLASS}
              aria-label={`Message ${index + 1} role`}
            >
              <option value="user">user</option>
              <option value="assistant">assistant</option>
            </select>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className={ICON_BUTTON_CLASS}
                aria-label="Move message up"
              >
                <HugeiconsIcon icon={ArrowUp01Icon} size={13} />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === messages.length - 1}
                className={ICON_BUTTON_CLASS}
                aria-label="Move message down"
              >
                <HugeiconsIcon icon={ArrowDown01Icon} size={13} />
              </button>
              <button
                type="button"
                onClick={() => remove(message.id)}
                className={ICON_BUTTON_CLASS}
                aria-label="Remove message"
              >
                <HugeiconsIcon icon={Delete01Icon} size={13} />
              </button>
            </div>
          </div>
          <textarea
            value={message.content}
            onChange={(e) => update(message.id, { content: e.target.value })}
            placeholder={`${message.role} message content…`}
            rows={Math.min(10, Math.max(3, message.content.split("\n").length))}
            className={TEXTAREA_CLASS}
          />
        </div>
      ))}
    </div>
  );
}
