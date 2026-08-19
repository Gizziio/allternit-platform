import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { mailboxes, users, domains } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { hasAdminAccount } from "@/lib/auth/setup";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { newId } from "@/lib/ids";
import { firstRunRegisterSchema } from "@/lib/validators";
import { addDomainForUser } from "@/lib/domains/service";
import { ensureEmailRoutingRuleToWorker } from "@/lib/cloudflare-api";
import { readJsonBody } from "@/lib/http/request";
import { RequestBodyTooLargeError } from "@/lib/http/errors";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";

export async function POST(request: Request) {
	const env = getEnv();
	const db = getDb(env);
	if (await hasAdminAccount(env)) {
		return NextResponse.json({ error: "Registration is closed after the first account is created" }, { status: 403 });
	}

	let body: unknown;
	try {
		body = await readJsonBody(request, 16 * 1024);
	} catch (error) {
		const status = error instanceof RequestBodyTooLargeError ? 413 : 400;
		return NextResponse.json({ error: "Invalid registration request" }, { status });
	}
	const firstRunParsed = firstRunRegisterSchema.safeParse(body);
	if (!firstRunParsed.success) {
		return NextResponse.json({ error: firstRunParsed.error.flatten() }, { status: 400 });
	}
	if (!(await verifyTurnstileToken(env, request, (body as Record<string, unknown>).turnstileToken))) {
		return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
	}

	const domainName = firstRunParsed.data.domain.toLowerCase().trim();
	const username = firstRunParsed.data.username.toLowerCase().trim();
	const email = `${username}@${domainName}`;
	const password = firstRunParsed.data.password;
	const name = username;

	const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
	if (existing) {
		return NextResponse.json({ error: "Email already registered" }, { status: 409 });
	}

	const userId = newId("usr");
	await db.insert(users).values({
		id: userId,
		email,
		resetEmail: firstRunParsed.data.resetEmail,
		passwordHash: hashPassword(password),
		name,
		role: "admin",
	});

	try {
		const { domain } = await addDomainForUser(env, userId, domainName, {
			enableRouting: true,
			enableSending: true,
		});
		await ensureEmailRoutingRuleToWorker(env, domain.zoneId, email);
		await db.insert(mailboxes).values({
			id: newId("mbx"),
			userId,
			domainId: domain.id,
			localPart: username,
			displayName: username,
		});
	} catch (err) {
		// Roll back everything this attempt created so first-run registration is
		// safe to retry — e.g. after a Cloudflare API permission error. Without
		// this, a domain row owned by the deleted user would make the next
		// attempt fail with "Domain is already registered".
		await db.delete(mailboxes).where(eq(mailboxes.userId, userId));
		await db.delete(domains).where(eq(domains.userId, userId));
		await db.delete(users).where(eq(users.id, userId));
		const message = err instanceof Error ? err.message : "Domain setup failed";
		return NextResponse.json({ error: message }, { status: 502 });
	}

	const token = await createSession(env, userId);
	const response = NextResponse.json({ ok: true, token, redirect: "/inbox" });
	response.headers.set("Cache-Control", "no-store");
	response.cookies.set(SESSION_COOKIE, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 60 * 60 * 24 * 30,
	});
	return response;
}
