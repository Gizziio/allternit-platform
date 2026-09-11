/**
 * Keep the transcript fold in sync with permission-store pending requests
 * and answer them through replyBotApproval.
 *
 * @module use-bot-approval-bridge
 */

import { useEffect, useRef } from "react";
import { usePendingPermissions } from "@/lib/agents/permission-store";
import type { TranscriptEvent } from "@/components/bot-chat/transcript";
import { pendingToFoldEvent, replyBotApproval } from "./bot-approval-bridge";

export function useBotApprovalBridge(
  sessionId: string | null,
  botId: string,
  botName: string,
  apply: (event: TranscriptEvent) => void,
): {
  onApprovalAnswer: (approvalId: string, optionId: string) => void;
  onApprovalGrant: (approvalId: string, grantKey: string) => void;
} {
  const pending = usePendingPermissions(sessionId ?? undefined);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    seen.current.clear();
  }, [sessionId]);

  useEffect(() => {
    for (const request of pending) {
      if (seen.current.has(request.requestId)) continue;
      seen.current.add(request.requestId);
      apply(pendingToFoldEvent(request, { id: botId, name: botName }));
    }
  }, [apply, botId, botName, pending]);

  return {
    onApprovalAnswer: (approvalId, optionId) => {
      apply(replyBotApproval(approvalId, optionId));
    },
    onApprovalGrant: (approvalId) => {
      apply(replyBotApproval(approvalId, "approve", { grant: true }));
    },
  };
}
