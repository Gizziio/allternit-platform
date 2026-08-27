import { authFetch } from "@/lib/auth/client";
import type {
	AccountDetail,
	AccountDetailResponse,
	AccountMailboxAccessItem,
	AccountMailboxAccessResponse,
	AccountMailboxItem,
	DomainOption,
} from "./types";

export const permissionLabels: Record<NonNullable<AccountMailboxAccessItem["permission"]>, string> = {
	read_only: "Read Only",
	send_as: "Send As",
	send_on_behalf: "Send on Behalf",
	full_access: "Full Access",
};

export async function fetchAccountMailboxAccess(accountId: string): Promise<AccountMailboxAccessResponse> {
	const res = await authFetch(`/api/accounts/${accountId}/mailbox-access`);
	const json = (await res.json()) as AccountMailboxAccessResponse;
	if (!res.ok) throw new Error(json.error ?? "Failed to load account access");
	return json;
}

export async function fetchAccount(accountId: string): Promise<AccountDetail> {
	const res = await authFetch(`/api/accounts/${accountId}`);
	const json = (await res.json()) as AccountDetailResponse;
	if (!res.ok || !json.account) throw new Error(json.error ?? "Failed to load account");
	return json.account;
}

export async function updateAccount(
	accountId: string,
	input: { email: string; name: string; password?: string; disabled: boolean },
): Promise<void> {
	const res = await authFetch(`/api/accounts/${accountId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const json = (await res.json()) as { error?: string };
	if (!res.ok) throw new Error(json.error ?? "Failed to update account");
}

export async function fetchDomains(): Promise<DomainOption[]> {
	const res = await authFetch("/api/domains");
	const json = (await res.json()) as { domains?: DomainOption[]; error?: string };
	if (!res.ok) throw new Error(json.error ?? "Failed to load domains");
	return json.domains ?? [];
}

export async function fetchAccountMailboxes(accountId: string): Promise<AccountMailboxItem[]> {
	const res = await authFetch(`/api/accounts/${accountId}/mailboxes`);
	const json = (await res.json()) as { mailboxes?: AccountMailboxItem[]; error?: string };
	if (!res.ok) throw new Error(json.error ?? "Failed to load account mailboxes");
	return json.mailboxes ?? [];
}

export async function createAccountMailbox(
	accountId: string,
	input: { domainId: string; localPart: string; displayName?: string },
): Promise<void> {
	const res = await authFetch(`/api/accounts/${accountId}/mailboxes`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const json = (await res.json()) as { error?: string };
	if (!res.ok) throw new Error(json.error ?? "Failed to create mailbox");
}

export async function grantAccountMailboxAccess(
	accountId: string,
	mailboxId: string,
	permission: NonNullable<AccountMailboxAccessItem["permission"]>,
): Promise<void> {
	const res = await authFetch(`/api/accounts/${accountId}/mailbox-access`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ mailboxId, permission }),
	});
	const json = (await res.json()) as { error?: string };
	if (!res.ok) throw new Error(json.error ?? "Failed to update access");
}

export async function revokeAccountMailboxAccess(accountId: string, mailboxId: string): Promise<void> {
	const res = await authFetch(`/api/accounts/${accountId}/mailbox-access?mailboxId=${encodeURIComponent(mailboxId)}`, {
		method: "DELETE",
	});
	const json = (await res.json()) as { error?: string };
	if (!res.ok) throw new Error(json.error ?? "Failed to remove access");
}

export function getMailboxAddress(mailbox: Pick<AccountMailboxAccessItem, "localPart" | "hostname">): string {
	return `${mailbox.localPart}@${mailbox.hostname}`;
}

export function getMailboxLabel(mailbox: Pick<AccountMailboxAccessItem, "displayName" | "localPart">): string {
	return mailbox.displayName?.trim() || mailbox.localPart;
}
