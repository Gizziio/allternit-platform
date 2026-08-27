import type { Message } from "@/hooks/types";
import { authFetch } from "@/lib/auth/client";
import { getEmailDisplayName } from "@/lib/email/address";
import dayjs from "dayjs";
import type { MailboxOption } from "@/components/mailbox-provider";
import type { EmailPageTitleInput } from "./types";
import type { MessageFolderConfig } from "./types";
import type { PageRange } from "./types";

export function getMessageParty(message: Message, folder: MessageFolderConfig["folder"]) {
	if (folder === "drafts") return "Draft";
	if (folder === "sent") return message.toContactName ?? (message.toAddr ? getEmailDisplayName(message.toAddr) : "No recipient");
	return message.fromContactName ?? (message.fromAddr ? getEmailDisplayName(message.fromAddr) : "Unknown sender");
}

export function getMessagePartyClassName(message: Message, folder: MessageFolderConfig["folder"]) {
	if (folder === "drafts") return "truncate font-semibold text-red-600";

	const unread = message.direction === "inbound" && !message.read;
	return `truncate ${unread ? "font-bold text-neutral-900" : "text-neutral-800"}`;
}

export function getMessagePreview(message: Message, folder: MessageFolderConfig["folder"]) {
	if (folder === "drafts") return message.snippet || message.toAddr || "No content";
	return message.snippet || "No preview";
}

export function getMessageBadge(message: Message, folder: MessageFolderConfig["folder"]) {
	if (folder === "drafts") return "draft";
	if (folder === "archived" || folder === "trash" || folder === "spam") return message.status;
	return message.direction;
}

export function formatMessageListTimestamp(createdAt: string): string {
	const date = dayjs(createdAt);
	if (date.isSame(dayjs(), "day")) return date.format("h:mm A");
	if (date.isSame(dayjs(), "year")) return date.format("MMM D");
	return date.format("M/D/YY");
}

export function getPageRange(offset: number, count: number, total: number): PageRange {
	if (total === 0 || count === 0) return { start: 0, end: 0, total };

	return {
		start: offset + 1,
		end: Math.min(offset + count, total),
		total,
	};
}

export function getMailboxAddress(mailbox: Pick<MailboxOption, "localPart" | "hostname"> | null | undefined): string | null {
	if (!mailbox) return null;
	return `${mailbox.localPart}@${mailbox.hostname}`;
}

export function getEmailPageTitleCount(total: number, unread: number): number {
	return unread > 0 ? unread : total;
}

export function formatEmailPageTitle({ location, total, unread, emailAddress }: EmailPageTitleInput): string {
	const count = getEmailPageTitleCount(total, unread);
	const suffix = emailAddress ? ` - ${emailAddress}` : "";
	return `${location} (${count})${suffix}`;
}

export async function runBulkMessageAction(messageIds: string[], action: string) {
	const response = await authFetch("/api/messages/bulk", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ messageIds, action }),
	});

	if (!response.ok) throw new Error("Unable to update selected messages");
	window.dispatchEvent(new Event("mailflare:messages-changed"));
}
