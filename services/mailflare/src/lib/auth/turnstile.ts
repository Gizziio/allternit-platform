import { newId } from "@/lib/ids";

type TurnstileResponse = {
	success: boolean;
	"error-codes"?: string[];
};

export async function verifyTurnstileToken(
	env: Pick<CloudflareEnv, "TURNSTILE_SECRET_KEY">,
	request: Request,
	token: unknown,
): Promise<boolean> {
	const secret = env.TURNSTILE_SECRET_KEY?.trim();
	if (!secret) return true;
	if (typeof token !== "string" || !token.trim() || token.length > 2048) return false;

	const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			secret,
			response: token,
			remoteip: request.headers.get("cf-connecting-ip") ?? undefined,
			idempotency_key: newId("ts"),
		}),
	});

	if (!response.ok) return false;
	const result = (await response.json()) as TurnstileResponse;
	return result.success;
}
