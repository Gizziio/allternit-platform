import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { backups } from "@/db/schema";
import { assertAdmin } from "@/lib/auth/admin";
import { requireUser } from "@/lib/auth/cookies";
import {
	createBackupRecord,
	getBackupSettings,
	listBackups,
	updateBackupSettings,
} from "@/lib/backups/service";
import { getEnv } from "@/lib/cloudflare";
import { parseBackupSettingsInput } from "./utils";

async function requireAdmin(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	assertAdmin(user);
	return { env, user };
}

export async function GET(request: Request) {
	try {
		const { env } = await requireAdmin(request);
		const [settings, backupList] = await Promise.all([
			getBackupSettings(env),
			listBackups(env),
		]);
		return NextResponse.json({ settings, backups: backupList });
	} catch {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
}

export async function PUT(request: Request) {
	try {
		const { env } = await requireAdmin(request);
		const input = parseBackupSettingsInput(await request.json());
		if (!input) return NextResponse.json({ error: "Invalid backup settings" }, { status: 400 });
		await updateBackupSettings(env, input);
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
}

export async function POST(request: Request) {
	try {
		const { env, user } = await requireAdmin(request);
		const backupId = await createBackupRecord(env, "manual", user.id);
		try {
			await env.DATABASE_BACKUP_WORKFLOW.create({
				id: `database-backup-${backupId}`,
				params: { backupId, force: true },
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to start backup";
			await getDb(env)
				.update(backups)
				.set({ status: "failed", error: message, completedAt: new Date() })
				.where(eq(backups.id, backupId));
			throw error;
		}
		return NextResponse.json({ backupId }, { status: 202 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to start backup";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
