import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { userHasMailboxes } from "@/lib/user";

export async function GET(request: Request) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const hasMailboxes = await userHasMailboxes(env, user.id);
	return NextResponse.json({
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			resetEmail: user.resetEmail,
			role: user.role,
		},
		hasMailboxes,
	});
}
