import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys, users } from "@/db/schema";
import { API_KEY_PREFIX, parseMailboxIds, parseScopes, verifyApiKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth/cookies";
import type { SessionUser } from "@/lib/auth/types";

export type ApiAuthResult = {
	userId: string;
	email: string;
	scopes: string[];
	/** Mailbox ids this key is restricted to; null = all of the user's mailboxes. */
	mailboxIds: string[] | null;
	keyId: string;
	/** bcrypt hash of the key, reused server-side as the HMAC secret for signed download URLs. */
	keyHash: string;
	prefix: string;
	user: SessionUser;
};

export async function authenticateApiKey(
	env: CloudflareEnv,
	authorization: string | null,
): Promise<ApiAuthResult | null> {
	if (!authorization?.startsWith("Bearer ")) return null;
	const key = authorization.slice(7).trim();
	if (!key) return null;

	const prefix = key.slice(0, 12);
	const db = getDb(env);
	const candidates = await db.select().from(apiKeys).where(eq(apiKeys.prefix, prefix));

	for (const candidate of candidates) {
		if (candidate.revokedAt) continue;
		if (!verifyApiKey(key, candidate.keyHash)) continue;
		const [user] = await db.select().from(users).where(eq(users.id, candidate.userId)).limit(1);
		if (!user || user.disabled) continue;

		await db
			.update(apiKeys)
			.set({ lastUsedAt: new Date() })
			.where(eq(apiKeys.id, candidate.id));

		return {
			userId: user.id,
			email: user.email,
			scopes: parseScopes(candidate.scopes),
			mailboxIds: parseMailboxIds(candidate.mailboxIds),
			keyId: candidate.id,
			keyHash: candidate.keyHash,
			prefix: candidate.prefix,
			user,
		};
	}
	return null;
}

export function requireScope(scopes: string[], required: string): boolean {
	return scopes.includes(required) || scopes.includes("*");
}

/** True when the API key may access the given mailbox (unscoped keys may access all). */
export function apiKeyAllowsMailbox(auth: Pick<ApiAuthResult, "mailboxIds">, mailboxId: string): boolean {
	return !auth.mailboxIds || auth.mailboxIds.includes(mailboxId);
}

export type SessionOrApiKeyAuth = {
	user: SessionUser;
	/** Present when the caller authenticated with an API key, null for session auth. */
	apiKey: ApiAuthResult | null;
};

/**
 * Authenticate either a dashboard session (cookie or session bearer token) or an API key
 * (Bearer ep_...). When `scope` is given, API-key callers must hold that scope; session
 * callers are always allowed. Admin API keys act as their owning user.
 */
export async function authenticateSessionOrApiKey(
	env: CloudflareEnv,
	request: Request,
	options?: { scope?: string },
): Promise<SessionOrApiKeyAuth | null> {
	const authorization = request.headers.get("authorization");
	if (authorization?.startsWith(`Bearer ${API_KEY_PREFIX}`)) {
		const apiKey = await authenticateApiKey(env, authorization);
		if (!apiKey) return null;
		if (options?.scope && !requireScope(apiKey.scopes, options.scope)) return null;
		return { user: apiKey.user, apiKey };
	}

	const user = await getCurrentUser(env, request);
	if (!user) return null;
	return { user, apiKey: null };
}
