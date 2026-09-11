/**
 * Bridge permission-store / cowork approvals onto the bot-chat fold.
 *
 * The card UI is local; the decision must hit the same reply path ChatApprovalCard
 * uses (`replyPermission` → ApprovalGate POST or native permissions API).
 * Never invent grant keys.
 *
 * @module bot-approval-bridge
 */

import type { PendingPermissionRequest } from "@/lib/agents/permission-store";
import { usePermissionStore } from "@/lib/agents/permission-store";
import {
  approvalRequestToEvent,
  approvalAnswerToEvent,
  type CoworkApprovalRequestPayload,
} from "@/components/bot-chat/chat-stream-adapter";
import type { TranscriptEvent } from "@/components/bot-chat/transcript";

export type PermissionReply = "once" | "always" | "reject";

/** Map a capsule option id onto the permission-store reply. */
export function optionIdToReply(optionId: string, grant = false): PermissionReply {
  if (grant) return "always";
  if (/deny|reject|no/i.test(optionId)) return "reject";
  return "once";
}

export function pendingPermissionToRequest(
  request: PendingPermissionRequest,
  bot: { id: string; name: string },
): CoworkApprovalRequestPayload {
  const summary =
    (typeof request.metadata.summary === "string" && request.metadata.summary) ||
    request.permission;
  const payload: CoworkApprovalRequestPayload = {
    actionId: request.requestId,
    summary,
    details: {
      actionType: request.permission,
      consequence:
        request.patterns.length > 0 ? request.patterns.join(", ") : undefined,
    },
    botId: bot.id,
    botName: bot.name,
  };
  // Always-allow is a client reply ("always"), not a server grantKey. Do not invent keys.
  return payload;
}

export function pendingToFoldEvent(
  request: PendingPermissionRequest,
  bot: { id: string; name: string },
): TranscriptEvent {
  return approvalRequestToEvent(pendingPermissionToRequest(request, bot));
}

/**
 * Send the decision to the server (permission-store + cowork fallback), then
 * return the fold event. If the id is not in the store, still POST cowork so a
 * gate-originated card can resolve, and still fold locally.
 */
export function replyBotApproval(
  approvalId: string,
  optionId: string,
  opts?: { grant?: boolean },
): TranscriptEvent {
  const reply = optionIdToReply(optionId, opts?.grant === true);
  const store = usePermissionStore.getState();
  const pending = store.pendingPermissions[approvalId];

  if (pending) {
    store.replyPermission(approvalId, reply);
  } else {
    const decision = reply === "reject" ? "rejected" : "approved";
    void fetch("/api/v1/cowork/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: approvalId, decision }),
    }).catch(() => {});
  }

  return approvalAnswerToEvent(approvalId, reply === "reject" ? "deny" : "approve");
}
