"use client";

import { useEffect } from "react";

import {
  X,
} from '@phosphor-icons/react';
import { ConversationMonitorPanel } from "@/views/mail-monitor/ConversationMonitorPanel";
import { useMonitorData } from "@/views/mail-monitor/monitor.helpers";
import { useUnifiedStore } from "@/lib/agents/unified.store";

export function ConversationMonitorOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const threadId = useUnifiedStore((state) => state.selectedThreadId);
  const selectThread = useUnifiedStore((state) => state.selectThread);
  const mailThreads = useUnifiedStore((state) => state.mailThreads);
  const monitor = useMonitorData(threadId);

  useEffect(() => {
    if (open && !threadId && mailThreads.length > 0) {
      selectThread(mailThreads[0].thread_id);
    }
  }, [open, threadId, mailThreads, selectThread]);

  if (!open || !threadId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: 'var(--shell-overlay-backdrop)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-[420px] max-w-[90vw] rounded-3xl border border-border bg-background/90 p-4 backdrop-blur-2xl"
        style={{ boxShadow: 'var(--shadow-xl)' }}
      >
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Conversation Monitor</p>
            <p className="text-sm font-semibold text-foreground">Thread: {threadId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close monitor overlay"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-3">
          <ConversationMonitorPanel
            messages={monitor.messages}
            telemetry={monitor.telemetry}
          />
        </div>
        <div className="mt-2 text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          Shortcut: Ctrl+Shift+M / ⌘+Shift+M
        </div>
      </div>
    </div>
  );
}
