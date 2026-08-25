import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { webhooks } from "@/db/schema";
import { requireUser } from "@/lib/auth/cookies";
import { newId } from "@/lib/ids";
import { webhookSchema } from "@/lib/validators";
import { readJsonBody } from "@/lib/http/request";
import { RequestBodyTooLargeError } from "@/lib/http/errors";

export async function GET(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const db = getDb(env);
	const rows = await db.select().from(webhooks).where(eq(webhooks.userId, user.id));
	return NextResponse.json({
		webhooks: rows.map((w) => ({ id: w.id, url: w.url, events: w.events, enabled: w.enabled })),
	});
}

export async function POST(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	let body: unknown;
	try {
		body = await readJsonBody(request, 16 * 1024);
	} catch (error) {
		const status = error instanceof RequestBodyTooLargeError ? 413 : 400;
		return NextResponse.json({ error: "Invalid webhook request" }, { status });
	}
	const parsed = webhookSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	const secret = newId("whsec");
	const db = getDb(env);
	const id = newId("wh");
	await db.insert(webhooks).values({
		id,
		userId: user.id,
		url: parsed.data.url,
		secret,
		events: JSON.stringify(parsed.data.events),
		enabled: true,
	});

	return NextResponse.json({ id, url: parsed.data.url, secret, events: parsed.data.events });
}
