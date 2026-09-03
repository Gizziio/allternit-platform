"use client";

/**
 * ChatApprovalCard — inline permission request rendered inside a chat thread
 *
 * A chat-native alternative to the floating PermissionModal. The card is
 * anchored to the thread and allows Allow / Deny / Always responses without
 * leaving the conversation.
 *
 * @module ChatApprovalCard
 */

import React, { memo, useMemo, useState } from "react";
import { LockSimple, Prohibit, CheckCircle, Warning } from "@phosphor-icons/react";
import { GlassSurface } from "@/design/glass/GlassSurface";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  usePermissionActions,
  type PendingPermissionRequest,
} from "@/lib/agents/permission-store";

// Human-readable labels and descriptions for known permission types
const PERMISSION_LABELS: Record<string, string> = {
  bash: "Run shell command",
  bash_tool: "Run shell command",
  tool_use: "Use a tool",
  read_file: "Read file",
  write_file: "Write or edit file",
  computer_use: "Control the computer",
  web_search: "Search the web",
  network: "Make a network request",
  execute: "Execute code",
};

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  bash: "The agent wants to run a terminal command on your machine.",
  bash_tool: "The agent wants to run a terminal command on your machine.",
  computer_use: "The agent wants to control mouse, keyboard, or screen.",
  write_file: "The agent wants to create or modify a file.",
  web_search: "The agent wants to search the web for information.",
};

interface ChatApprovalCardProps {
  request: PendingPermissionRequest;
  className?: string;
}

export const ChatApprovalCard = memo(function ChatApprovalCard({
  request,
  className,
}: ChatApprovalCardProps) {
  const { replyPermission } = usePermissionActions();
  const [busy, setBusy] = useState(false);

  const label = useMemo(
    () => PERMISSION_LABELS[request.permission] ?? `Allow: ${request.permission}`,
    [request.permission]
  );
  const description = PERMISSION_DESCRIPTIONS[request.permission];
  const summary =
    typeof request.metadata.summary === "string"
      ? request.metadata.summary
      : undefined;

  async function handle(reply: "once" | "always" | "reject") {
    if (busy) return;
    setBusy(true);
    try {
      replyPermission(request.requestId, reply);
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassSurface
      className={cn(
        "w-full max-w-2xl mx-auto overflow-hidden",
        "border-l-4 border-l-amber-500/60",
        className
      )}
      variant="default"
      border="subtle"
      blur="md"
      opacity="medium"
      rounded="xl"
      padding="none"
    >
      <div className="px-4 py-3 border-b border-white/5 bg-amber-500/8">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
            <Warning size={16} className="text-amber-400" weight="fill" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
              <LockSimple size={13} className="text-amber-400" weight="bold" />
              <span>Permission required</span>
            </div>
            <p className="text-xs text-amber-200/60 mt-0.5 truncate">
              {label}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="text-sm font-medium text-[var(--ui-text-primary)]">
            {label}
          </p>
          {description && (
            <p className="text-xs text-[var(--ui-text-secondary)] mt-1 leading-relaxed">
              {description}
            </p>
          )}
          {summary && (
            <p className="text-xs text-[var(--ui-text-secondary)] mt-1.5 leading-relaxed">
              {summary}
            </p>
          )}
        </div>

        {request.patterns.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {request.patterns.map((pattern, idx) => (
              <code
                key={`approval-pattern-${idx}`}
                className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-amber-500/10 text-amber-200/80 border border-amber-500/20"
              >
                {pattern}
              </code>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => handle("reject")}
            disabled={busy}
          >
            <Prohibit size={14} />
            Deny
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handle("once")}
            disabled={busy}
          >
            Allow once
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => handle("always")}
            disabled={busy}
          >
            <CheckCircle size={14} weight="fill" />
            Always allow
          </Button>
        </div>
      </div>
    </GlassSurface>
  );
});

export default ChatApprovalCard;
