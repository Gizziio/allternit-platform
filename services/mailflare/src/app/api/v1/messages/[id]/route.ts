import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { apiKeyAllowsMailbox, authenticateApiKey, requireScope } from "@/lib/api/auth";
import { createAttachmentDownloadToken } from "@/lib/api/tokens";
import { getMessageWithBody } from "@/lib/email/inbound";

type V1MessageRouteParams = {
	params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: V1MessageRouteParams) {
	const env = getEnv();
	const auth = await authenticateApiKey(env, request.headers.get("authorization"));
	if (!auth || !requireScope(auth.scopes, "read")) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;
	const data = await getMessageWithBody(env, auth.userId, id);
	if (!data) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	if (data.message.mailboxId && !apiKeyAllowsMailbox(auth, data.message.mailboxId)) {
		return NextResponse.json(
			{ error: "API key is not authorized for this mailbox" },
			{ status: 403 },
		);
	}

	// Attachment downloads go through the v1 attachment endpoint; each URL carries a
	// short-lived signed token so it can be handed to an agent without the API key.
	const attachments = await Promise.all(
		data.attachments.map(async (attachment) => {
			const { token, expiresAt } = await createAttachmentDownloadToken(
				auth.keyHash,
				id,
				attachment.id,
			);
			return {
				...attachment,
				downloadUrl: `/api/v1/messages/${id}/attachments/${attachment.id}?token=${token}&expires=${expiresAt}`,
				downloadUrlExpiresAt: new Date(expiresAt).toISOString(),
			};
		}),
	);

	return NextResponse.json({ ...data, attachments });
}
