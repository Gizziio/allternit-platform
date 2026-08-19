import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { apiKeyAllowsMailbox, authenticateSessionOrApiKey } from "@/lib/api/auth";
import { getOutboundJobForReview, type OutboundJobReview } from "@/lib/email/send";

export type OutboundRouteParams = {
	params: Promise<{ id: string }>;
};

type AuthorizedReview =
	| { ok: true; env: CloudflareEnv; review: OutboundJobReview }
	| { ok: false; response: NextResponse };

/**
 * Shared authorization for the outbound approve/reject routes: session auth or an API
 * key with the send scope; the caller must own the job, and mailbox-scoped keys may
 * only act on jobs whose message belongs to one of their mailboxes.
 */
export async function authorizeJobReview(
	request: Request,
	params: OutboundRouteParams["params"],
): Promise<AuthorizedReview> {
	const env = getEnv();
	const auth = await authenticateSessionOrApiKey(env, request, { scope: "send" });
	if (!auth) {
		return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
	}

	const { id } = await params;
	const review = await getOutboundJobForReview(env, id);
	if (!review || review.job.userId !== auth.user.id) {
		return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
	}

	if (
		auth.apiKey &&
		review.message.mailboxId &&
		!apiKeyAllowsMailbox(auth.apiKey, review.message.mailboxId)
	) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "API key is not authorized for this mailbox" },
				{ status: 403 },
			),
		};
	}

	if (review.job.status !== "pending_approval") {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: `Job is not pending approval (status: ${review.job.status})` },
				{ status: 409 },
			),
		};
	}

	return { ok: true, env, review };
}
