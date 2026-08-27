import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getEnv } from "@/lib/cloudflare";
import { getDb } from "@/db";
import { messageAttachments, messages } from "@/db/schema";
import { apiKeyAllowsMailbox, authenticateApiKey, requireScope } from "@/lib/api/auth";
import { verifyAttachmentDownloadToken } from "@/lib/api/tokens";

type V1AttachmentRouteParams = {
	params: Promise<{ id: string; attachmentId: string }>;
};

export async function GET(request: Request, { params }: V1AttachmentRouteParams) {
	const env = getEnv();
	const auth = await authenticateApiKey(env, request.headers.get("authorization"));
	if (!auth || !requireScope(auth.scopes, "read")) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id, attachmentId } = await params;
	const db = getDb(env);
	const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
	if (!message || message.userId !== auth.userId) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (message.mailboxId && !apiKeyAllowsMailbox(auth, message.mailboxId)) {
		return NextResponse.json(
			{ error: "API key is not authorized for this mailbox" },
			{ status: 403 },
		);
	}

	const url = new URL(request.url);
	const token = url.searchParams.get("token") ?? "";
	const expiresAt = Number(url.searchParams.get("expires") ?? "");
	const tokenValid = await verifyAttachmentDownloadToken(
		auth.keyHash,
		id,
		attachmentId,
		expiresAt,
		token,
	);
	if (!tokenValid) {
		return NextResponse.json({ error: "Invalid or expired download token" }, { status: 403 });
	}

	const [attachment] = await db
		.select()
		.from(messageAttachments)
		.where(and(eq(messageAttachments.id, attachmentId), eq(messageAttachments.messageId, id)))
		.limit(1);
	if (!attachment) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const object = await env.BUCKET.get(attachment.r2Key);
	if (!object) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("Content-Type", attachment.contentType);
	headers.set("Content-Length", String(attachment.size));
	headers.set(
		"Content-Disposition",
		`attachment; filename="${attachment.filename.replace(/"/g, "_")}"`,
	);
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Cache-Control", "private, max-age=900");

	return new Response(object.body, { headers });
}
