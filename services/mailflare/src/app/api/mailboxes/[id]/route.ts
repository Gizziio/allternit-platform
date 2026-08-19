import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { domains, mailboxes } from "@/db/schema";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { authenticateSessionOrApiKey } from "@/lib/api/auth";
import { getMailboxAccessLevel } from "@/lib/mailboxes/access";
import { updateMailboxSchema } from "@/lib/validators";
import { deleteEmailRoutingRule, listEmailRoutingRules } from "@/lib/cloudflare-api";
import { createAuditLog } from "@/lib/mailboxes/audit";
import type { MailboxRouteParams } from "./types";
import { getMailboxUpdateValues, selectMailboxForUser } from "./utils";

function hasCloudflareCredentials(env: CloudflareEnv): boolean {
	return Boolean(env.CF_TOKEN?.trim() || (env.CF_API_KEY?.trim() && env.CF_EMAIL?.trim()));
}

export async function GET(request: Request, { params }: MailboxRouteParams) {
	const { id } = await params;
	const env = getEnv();
	const user = await requireUser(env, request);
	const db = getDb(env);
	const access = await getMailboxAccessLevel(db, user, id);
	if (!access?.canRead) {
		return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
	}
	const [mailbox] = await selectMailboxForUser(db, user.id, id);

	if (!mailbox) {
		return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
	}

	return NextResponse.json({
		mailbox: {
			...mailbox,
			permission: access.permission,
			isPrimary: `${mailbox.localPart}@${mailbox.hostname}` === user.email,
		},
	});
}

export async function PATCH(request: Request, { params }: MailboxRouteParams) {
	const { id } = await params;
	const env = getEnv();
	const user = await requireUser(env, request);
	const parsed = updateMailboxSchema.safeParse(await request.json());

	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	const db = getDb(env);
	const access = await getMailboxAccessLevel(db, user, id);
	const [existing] = await selectMailboxForUser(db, user.id, id);

	if (!existing || !access?.canManage) {
		return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
	}

	const updateValues = getMailboxUpdateValues(parsed.data);
	if (Object.keys(updateValues).length > 0) {
		await db
			.update(mailboxes)
			.set(updateValues)
			.where(eq(mailboxes.id, id));
	}

	const [mailbox] = await selectMailboxForUser(db, user.id, id);

	return NextResponse.json({
		mailbox: {
			...mailbox,
			permission: access.permission,
			isPrimary: `${mailbox!.localPart}@${mailbox!.hostname}` === user.email,
		},
	});
}

export async function DELETE(request: Request, { params }: MailboxRouteParams) {
	const { id } = await params;
	const env = getEnv();
	const auth = await authenticateSessionOrApiKey(env, request, { scope: "admin" });
	if (!auth) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const db = getDb(env);
	const [mailbox] = await selectMailboxForUser(db, auth.user.id, id);
	if (!mailbox || mailbox.userId !== auth.user.id) {
		return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
	}
	if (mailbox.disabled) {
		return NextResponse.json({ id, disabled: true });
	}

	// Remove the Cloudflare Email Routing rule(s) for this address (mirrors how POST
	// creates them), then disable the mailbox. Messages are kept. When no Cloudflare
	// API credentials are configured (e.g. local dev), skip the remote cleanup.
	const [domain] = await db
		.select()
		.from(domains)
		.where(eq(domains.id, mailbox.domainId))
		.limit(1);
	const address = `${mailbox.localPart}@${mailbox.hostname}`.toLowerCase();
	if (domain && hasCloudflareCredentials(env)) {
		try {
			const rules = await listEmailRoutingRules(env, domain.zoneId);
			const matching = rules.filter((rule) =>
				rule.matchers?.some(
					(matcher) =>
						matcher.type === "literal" &&
						matcher.field === "to" &&
						matcher.value?.toLowerCase() === address,
				),
			);
			for (const rule of matching) {
				if (rule.id) await deleteEmailRoutingRule(env, domain.zoneId, rule.id);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to delete Cloudflare routing rule";
			return NextResponse.json({ error: message }, { status: 502 });
		}
	}

	await db.update(mailboxes).set({ disabled: true }).where(eq(mailboxes.id, id));
	await createAuditLog(env, {
		actorUserId: auth.user.id,
		mailboxId: id,
		action: "mailbox.delete",
		metadata: { address },
	});

	return NextResponse.json({ id, disabled: true });
}
