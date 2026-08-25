import { authFetch } from "@/lib/auth/client";
import type { ImportMessagesResult } from "./import-messages-types";

export async function importMessageFiles(
	mailboxId: string,
	files: File[],
	destination: string,
): Promise<ImportMessagesResult> {
	const form = new FormData();
	form.set("mailboxId", mailboxId);
	form.set("destination", destination);
	for (const file of files) {
		form.append("files", file);
	}

	const response = await authFetch("/api/import/messages", {
		method: "POST",
		body: form,
	});
	const data = (await response.json()) as ImportMessagesResult;
	if (!response.ok) throw new Error(data.error ?? "Import failed");
	return data;
}

export function getImportSummary(result: ImportMessagesResult | null): string {
	if (!result) return "";
	return `${result.imported ?? 0} imported, ${result.skipped ?? 0} skipped`;
}
