import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { apiKeys, mailboxes } from "@/db/schema";
import { requireUser } from "@/lib/auth/cookies";
import { authenticateSessionOrApiKey } from "@/lib/api/auth";
import { generateApiKey, mailboxIdsToJson, scopesToJson } from "@/lib/api-keys";
import { newId } from "@/lib/ids";

const createKeySchema = z.object({
	name: z.string().min(1),
	scopes: z.array(z.enum(["send", "read", "admin"])).min(1),
	mailboxIds: z.array(z.string().min(1)).max(100).optional(),
});

export async function GET(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const db = getDb(env);
	const rows = await db
		.select({
			id: apiKeys.id,
			name: apiKeys.name,
			prefix: apiKeys.prefix,
			scopes: apiKeys.scopes,
			mailboxIds: apiKeys.mailboxIds,
			revokedAt: apiKeys.revokedAt,
			createdAt: apiKeys.createdAt,
			lastUsedAt: apiKeys.lastUsedAt,
		})
		.from(apiKeys)
		.where(eq(apiKeys.userId, user.id));
	return NextResponse.json({ apiKeys: rows });
}

export async function POST(request: Request) {
	const env = getEnv();
	// Session auth (dashboard) or an admin-scope API key acting as its owning user —
	// the platform backend (allternit-api) uses the latter to mint per-agent
	// mailbox-scoped send/read keys without a dashboard session.
	const auth = await authenticateSessionOrApiKey(env, request, { scope: "admin" });
	if (!auth) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const user = auth.user;
	const parsed = createKeySchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	const db = getDb(env);
	const requestedMailboxIds = parsed.data.mailboxIds ?? null;
	if (requestedMailboxIds && requestedMailboxIds.length > 0) {
		const owned = await db
			.select({ id: mailboxes.id })
			.from(mailboxes)
			.where(and(eq(mailboxes.userId, user.id), inArray(mailboxes.id, requestedMailboxIds)));
		if (owned.length !== new Set(requestedMailboxIds).size) {
			return NextResponse.json({ error: "One or more mailboxes not found" }, { status: 400 });
		}
	}

	const { fullKey, prefix, hash } = generateApiKey();
	const id = newId("key");
	await db.insert(apiKeys).values({
		id,
		userId: user.id,
		name: parsed.data.name,
		prefix,
		keyHash: hash,
		scopes: scopesToJson(parsed.data.scopes),
		mailboxIds: mailboxIdsToJson(requestedMailboxIds),
	});

	return NextResponse.json({
		id,
		name: parsed.data.name,
		prefix,
		mailboxIds: requestedMailboxIds,
		key: fullKey,
	});
}
