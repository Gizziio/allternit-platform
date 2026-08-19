import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { and, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { backups } from "@/db/schema";
import { createScheduledBackupIfDue, getBackupSettings } from "./service";
import type { BackupWorkflowParams, D1ExportResponse } from "./types";
import {
	BACKUP_PREFIX,
	createBackupFilename,
	getExportError,
} from "./utils";

const EXPORT_RETRIES = 20;

export class DatabaseBackupWorkflow extends WorkflowEntrypoint<CloudflareEnv, BackupWorkflowParams> {
	async run(event: Readonly<WorkflowEvent<BackupWorkflowParams>>, step: WorkflowStep) {
		let backupId: string | null | undefined = event.payload?.backupId;
		if (!backupId) {
			backupId = await step.do("Check backup schedule", async () =>
				createScheduledBackupIfDue(this.env, event.timestamp),
			);
		}
		if (!backupId) {
			const retention = await step.do("Delete expired backups", async () => this.deleteExpiredBackups());
			return { skipped: true, ...retention };
		}

		try {
			await step.do("Mark backup running", async () => {
				await getDb(this.env)
					.update(backups)
					.set({ status: "running", startedAt: new Date() })
					.where(eq(backups.id, backupId));
			});

			const exportUrl = this.getExportUrl();
			const bookmark = await step.do("Start D1 export", async () => {
				const response = await this.callExportApi(exportUrl, { output_format: "polling" });
				if (!response.result?.at_bookmark) throw new Error(getExportError(response));
				return response.result.at_bookmark;
			});

			let signedUrl = "";
			let exportFilename = "";
			for (let attempt = 1; attempt <= EXPORT_RETRIES; attempt += 1) {
				const result = await step.do(`Poll D1 export ${attempt}`, async () =>
					this.callExportApi(exportUrl, { current_bookmark: bookmark }),
				);
				if (result.result?.signed_url) {
					signedUrl = result.result.signed_url;
					exportFilename = result.result.filename ?? "";
					break;
				}
				if (attempt < EXPORT_RETRIES) await step.sleep(`Wait for D1 export ${attempt}`, "15 seconds");
			}
			if (!signedUrl) throw new Error("D1 export did not finish before the polling limit");

			const stored = await step.do("Store backup in R2", async () => {
				const response = await fetch(signedUrl);
				if (!response.ok || !response.body) throw new Error("Failed to download the D1 export");
				const filename = exportFilename || createBackupFilename(new Date());
				const r2Key = `${BACKUP_PREFIX}/${backupId}/${filename}`;
				const object = await this.env.BUCKET.put(r2Key, response.body, {
					httpMetadata: { contentType: "application/sql" },
					customMetadata: { backupId },
				});
				return { filename, r2Key, size: object.size };
			});

			await step.do("Complete backup", async () => {
				await getDb(this.env)
					.update(backups)
					.set({
						status: "completed",
						filename: stored.filename,
						r2Key: stored.r2Key,
						size: stored.size,
						completedAt: new Date(),
						error: null,
					})
					.where(eq(backups.id, backupId));
			});

			await step.do("Delete expired backups", async () => this.deleteExpiredBackups());
			return { backupId, ...stored };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Backup failed";
			await getDb(this.env)
				.update(backups)
				.set({ status: "failed", error: message, completedAt: new Date() })
				.where(eq(backups.id, backupId));
			throw error;
		}
	}

	private getExportUrl(): string {
		if (!this.env.CF_AID || !this.env.D1_DATABASE_ID || !this.env.D1_BACKUP_TOKEN) {
			throw new Error("CF_AID, D1_DATABASE_ID, and D1_BACKUP_TOKEN must be configured");
		}
		return `https://api.cloudflare.com/client/v4/accounts/${this.env.CF_AID}/d1/database/${this.env.D1_DATABASE_ID}/export`;
	}

	private async callExportApi(url: string, payload: object): Promise<D1ExportResponse> {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.env.D1_BACKUP_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});
		const result = (await response.json()) as D1ExportResponse;
		if (!response.ok || !result.success) throw new Error(getExportError(result));
		return result;
	}

	private async deleteExpiredBackups(): Promise<{ deleted: number }> {
		const settings = await getBackupSettings(this.env);
		if (!settings?.retentionEnabled) return { deleted: 0 };
		const cutoff = new Date(Date.now() - settings.retentionDays * 86_400_000);
		const db = getDb(this.env);
		const expired = await db
			.select()
			.from(backups)
			.where(
				and(
					lt(backups.createdAt, cutoff),
					inArray(backups.status, ["completed", "failed"]),
				),
			);
		for (const backup of expired) {
			if (backup.r2Key) await this.env.BUCKET.delete(backup.r2Key);
			await db.delete(backups).where(eq(backups.id, backup.id));
		}
		return { deleted: expired.length };
	}
}
