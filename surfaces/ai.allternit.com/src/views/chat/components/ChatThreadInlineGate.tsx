"use client";

/**
 * ChatThreadInlineGate — renders pending approvals and questions inline in a
 * chat thread.
 *
 * Polls the Rails ApprovalGate for chat-mode sessions and surfaces any pending
 * permission/question requests as cards inside the conversation. The component
 * reuses the global permission/question stores so decisions are synchronized
 * with the composer bars and modal variants.
 *
 * @module ChatThreadInlineGate
 */

import React, { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";
import {
  usePendingPermissions,
  usePendingQuestions,
} from "@/lib/agents/permission-store";
import { useApprovalGatePoller } from "@/lib/cowork/useApprovalGatePoller";
import { ChatApprovalCard } from "./ChatApprovalCard";
import { ChatQuestionCard } from "./ChatQuestionCard";

interface ChatThreadInlineGateProps {
  sessionId: string | null | undefined;
  surface?: AgentModeSurface;
  className?: string;
}

export const ChatThreadInlineGate = memo(function ChatThreadInlineGate({
  sessionId,
  surface = "chat",
  className,
}: ChatThreadInlineGateProps) {
  const active = Boolean(sessionId && sessionId !== "__inactive__");
  useApprovalGatePoller(active, surface);

  const pendingPermissions = usePendingPermissions(
    sessionId && sessionId !== "__inactive__" ? sessionId : undefined
  );
  const pendingQuestions = usePendingQuestions(
    sessionId && sessionId !== "__inactive__" ? sessionId : undefined
  );

  if (!active) return null;
  if (pendingPermissions.length === 0 && pendingQuestions.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <AnimatePresence mode="popLayout">
        {pendingPermissions.map((request) => (
          <motion.div
            key={`approval-${request.requestId}`}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18 }}
            className="py-2"
          >
            <ChatApprovalCard request={request} />
          </motion.div>
        ))}
        {pendingQuestions.map((request) => (
          <motion.div
            key={`question-${request.requestId}`}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18 }}
            className="py-2"
          >
            <ChatQuestionCard request={request} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

export default ChatThreadInlineGate;
