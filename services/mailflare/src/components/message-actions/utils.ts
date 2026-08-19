import type { BulkMessageAction } from "@/app/api/messages/bulk/types";
import { authFetch } from "@/lib/auth/client";
import { getEmailAddress } from "@/lib/email/address";
import type { TrashSenderRuleInput } from "./types";

export function getMessageBackHref(direction: "inbound" | "outbound", status: string) {
	if (status === "trash") return "/trash";
	if (status === "spam") return "/spam";
	if (status === "archived") return "/archived";
	if (status === "draft") return "/drafts";
	return direction === "inbound" ? "/inbox" : "/sent";
}

export async function runSingleMessageAction(messageId: string, action: BulkMessageAction) {
	const response = await authFetch("/api/messages/bulk", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ messageIds: [messageId], action }),
	});

	if (!response.ok) {
		throw new Error("Unable to update message");
	}

	window.dispatchEvent(new Event("mailflare:messages-changed"));
}

export function openUnsubscribeUrl(url: string) {
	window.open(url, "_blank", "noopener,noreferrer");
}

export function confirmTrashWithoutUnsubscribe() {
	return window.confirm(
		"This email does not provide an unsubscribe link. It will be moved to Trash, and future emails from this sender will also be moved to Trash.",
	);
}

export async function createTrashSenderRule({ mailboxId, senderAddress }: TrashSenderRuleInput) {
	const sender = getEmailAddress(senderAddress).trim().toLowerCase();
	if (!sender) throw new Error("Sender address is required");

	const response = await authFetch("/api/routing-rules", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			mailboxId,
			matchField: "email",
			matchOperator: "exact",
			matchValue: sender,
			destination: "trash",
			priority: 0,
		}),
	});
	const data = (await response.json()) as { error?: string };
	if (!response.ok) throw new Error(data.error ?? "Unable to create trash rule");
}

export function getMessageActionRedirect(action: BulkMessageAction, direction: "inbound" | "outbound") {
	if (action === "trash") return "/trash";
	if (action === "spam") return "/spam";
	if (action === "archive") return "/archived";
	if (action === "inbox") return "/inbox";
	return null;
}
