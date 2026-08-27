import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { webhookDeliveries, webhooks } from "@/db/schema";
import { requireUser } from "@/lib/auth/cookies";

type WebhookDeliveriesRouteParams = {
	params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: WebhookDeliveriesRouteParams) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const { id } = await params;

	const db = getDb(env);
	const [hook] = await db
		.select()
		.from(webhooks)
		.where(and(eq(webhooks.id, id), eq(webhooks.userId, user.id)))
		.limit(1);
	if (!hook) {
		return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
	}

	const url = new URL(request.url);
	const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
	const rows = await db
		.select()
		.from(webhookDeliveries)
		.where(eq(webhookDeliveries.webhookId, id))
		.orderBy(desc(webhookDeliveries.createdAt))
		.limit(limit);

	return NextResponse.json({ deliveries: rows });
}
