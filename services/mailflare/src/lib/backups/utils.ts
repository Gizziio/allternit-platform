import type { BackupScheduleType, D1ExportResponse } from "./types";

export const BACKUP_SETTINGS_ID = "default";
export const BACKUP_PREFIX = "backups/database";

export function isBackupDue(
	scheduleType: BackupScheduleType,
	scheduleValue: number | null,
	now: Date,
): boolean {
	if (scheduleType === "daily") return true;
	if (scheduleType === "weekly") return now.getUTCDay() === scheduleValue;
	return now.getUTCDate() === scheduleValue;
}

export function getUtcDayBounds(now: Date): { start: number; end: number } {
	const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	return { start, end: start + 86_400_000 };
}

export function getExportError(response: D1ExportResponse): string {
	return response.errors?.map((error) => error.message).filter(Boolean).join(", ")
		|| "Cloudflare D1 export failed";
}

export function createBackupFilename(now: Date): string {
	return `mailflare-${now.toISOString().replace(/[:.]/g, "-")}.sql`;
}
