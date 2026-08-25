import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema";
import { requireUser } from "@/lib/auth/cookies";
import { createAuditLog } from "@/lib/mailboxes/audit";

type ApiKeyRouteParams = {
	params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, { params }: ApiKeyRouteParams) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const { id } = await params;

	const db = getDb(env);
	// Soft revoke: keep the row (and its prefix/hash history) but refuse further auth.
	const revoked = await db
		.update(apiKeys)
		.set({ revokedAt: new Date() })
		.where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)))
		.returning({ id: apiKeys.id });

	if (revoked.length === 0) {
		return NextResponse.json({ error: "API key not found" }, { status: 404 });
	}

	await createAuditLog(env, {
		actorUserId: user.id,
		action: "api_key.revoke",
		metadata: { apiKeyId: id },
	});

	return NextResponse.json({ id, revoked: true });
}
