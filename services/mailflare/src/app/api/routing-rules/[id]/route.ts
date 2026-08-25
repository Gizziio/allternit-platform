import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { routingRules } from "@/db/schema";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { getMailboxAccessLevel } from "@/lib/mailboxes/access";
import type { RoutingRuleRouteParams } from "./types";

export async function DELETE(request: Request, { params }: RoutingRuleRouteParams) {
	const { id } = await params;
	const env = getEnv();
	const user = await requireUser(env, request);
	const db = getDb(env);
	const [rule] = await db.select().from(routingRules).where(eq(routingRules.id, id)).limit(1);
	if (!rule?.mailboxId) {
		return NextResponse.json({ error: "Rule not found" }, { status: 404 });
	}
	const access = await getMailboxAccessLevel(db, user, rule.mailboxId);
	if (!access?.canManage) {
		return NextResponse.json({ error: "Rule not found" }, { status: 404 });
	}

	await db.delete(routingRules).where(eq(routingRules.id, id));

	return NextResponse.json({ ok: true });
}
