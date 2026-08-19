import { authFetch } from "@/lib/auth/client";
import { getEmailAddress } from "@/lib/email/address";
import { getDisplayNameForAddress } from "@/lib/contacts/utils";
import { htmlToReadableText, splitRepliedEmailContent } from "@/lib/email/reply-content-utils";
import type { Message } from "@/hooks/types";
import type { MessageAttachment, MessageBodyDisplay, MessageDetailResponse } from "./types";

export async function fetchMessageDetail(messageId: string): Promise<MessageDetailResponse> {
	const response = await authFetch(`/api/messages/${messageId}`);
	return (await response.json()) as MessageDetailResponse;
}

export function getMessageHeaderParties(message: Message) {
	return {
		fromName: getDisplayNameForAddress(message.fromAddr, message.fromContactName),
		fromAddress: getEmailAddress(message.fromAddr),
		toName: getDisplayNameForAddress(message.toAddr, message.toContactName),
	};
}

export function getMessageBodyDisplay(
	textBody: string | null | undefined,
	htmlBody: string | null | undefined,
	fallback: string | null | undefined,
	ownAddress?: string,
): MessageBodyDisplay {
	const textSource = textBody ?? (htmlToReadableText(htmlBody) || fallback || "");
	const parts = splitRepliedEmailContent(textSource, { ownAddress });

	return {
		...parts,
		htmlBody: parts.quotedContent.length > 0 ? null : htmlBody ?? null,
		hasQuotedContent: parts.quotedContent.length > 0,
	};
}

export function getAttachmentUrl(messageId: string, attachmentId: string): string {
	return `/api/messages/${messageId}/attachments/${attachmentId}?preview=1`;
}

export function resolveInlineAttachmentUrls(
	htmlBody: string | null,
	messageId: string,
	attachments: MessageAttachment[],
): string | null {
	if (!htmlBody) return null;

	return attachments.reduce((html, attachment) => {
		if (!attachment.contentId) return html;
		const contentId = attachment.contentId.replace(/^<|>$/g, "");
		return html.replaceAll(
			`cid:${contentId}`,
			getAttachmentUrl(messageId, attachment.id),
		);
	}, htmlBody);
}

export function formatAttachmentSize(size: number): string {
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
