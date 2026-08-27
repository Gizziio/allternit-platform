const TOKEN_TTL_MS = 15 * 60 * 1000;

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function tokenPayload(messageId: string, attachmentId: string, expiresAt: number): string {
	return `${messageId}.${attachmentId}.${expiresAt}`;
}

/**
 * Short-lived signed token for attachment download URLs returned by the v1 API.
 * The API key's bcrypt hash (never exposed) serves as the HMAC secret, so tokens
 * are only verifiable for the same key and die with it on revocation/rotation.
 */
export async function createAttachmentDownloadToken(
	secret: string,
	messageId: string,
	attachmentId: string,
): Promise<{ token: string; expiresAt: number }> {
	const expiresAt = Date.now() + TOKEN_TTL_MS;
	const token = await hmacSha256Hex(secret, tokenPayload(messageId, attachmentId, expiresAt));
	return { token, expiresAt };
}

export async function verifyAttachmentDownloadToken(
	secret: string,
	messageId: string,
	attachmentId: string,
	expiresAt: number,
	token: string,
): Promise<boolean> {
	if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
	const expected = await hmacSha256Hex(secret, tokenPayload(messageId, attachmentId, expiresAt));
	return expected === token;
}
