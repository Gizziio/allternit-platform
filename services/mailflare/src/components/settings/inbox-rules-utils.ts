import { authFetch } from "@/lib/auth/client";
import type { InboxRulesResponse, RuleFoldersResponse } from "./inbox-rules-types";

export async function fetchInboxRules(mailboxId: string): Promise<InboxRulesResponse> {
	const params = new URLSearchParams({ mailboxId });
	const response = await authFetch(`/api/routing-rules?${params.toString()}`);
	return (await response.json()) as InboxRulesResponse;
}

export async function fetchRuleFolders(mailboxId: string): Promise<RuleFoldersResponse> {
	const params = new URLSearchParams({ mailboxId });
	const response = await authFetch(`/api/folders?${params.toString()}`);
	return (await response.json()) as RuleFoldersResponse;
}

export async function createInboxRule(input: {
	mailboxId: string;
	matchField: "email" | "content" | "title";
	matchOperator: "contains" | "exact";
	matchValue: string;
	destination: string;
	priority: number;
}) {
	const response = await authFetch("/api/routing-rules", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const data = (await response.json()) as { error?: string };
	if (!response.ok) throw new Error(data.error ?? "Failed to create rule");
	return data;
}

export async function deleteInboxRule(ruleId: string) {
	const response = await authFetch(`/api/routing-rules/${ruleId}`, {
		method: "DELETE",
	});
	if (!response.ok) throw new Error("Failed to delete rule");
}

export function getRuleFieldLabel(field: string): string {
	if (field === "content") return "Content";
	if (field === "title") return "Title";
	return "Email address";
}

export function getRuleOperatorLabel(operator: string): string {
	return operator === "exact" ? "exact match" : "contains";
}
