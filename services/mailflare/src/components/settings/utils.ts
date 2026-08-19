import type { MailboxOption } from "@/components/mailbox-provider";
import { authFetch } from "@/lib/auth/client";
import type { CurrentMailboxFormResponse } from "./types";

export function getMailboxAddress(mailbox: Pick<MailboxOption, "localPart" | "hostname">): string {
	return `${mailbox.localPart}@${mailbox.hostname}`;
}

export async function updateCurrentMailboxName(id: string, displayName: string): Promise<MailboxOption> {
	const res = await authFetch(`/api/mailboxes/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ displayName }),
	});
	const data = (await res.json()) as CurrentMailboxFormResponse;

	if (!res.ok || !data.mailbox) {
		throw new Error(typeof data.error === "string" ? data.error : "Failed to update mailbox");
	}

	return {
		id: data.mailbox.id,
		localPart: data.mailbox.localPart,
		hostname: data.mailbox.hostname,
		displayName: data.mailbox.displayName,
		isPrimary: data.mailbox.isPrimary,
	};
}
