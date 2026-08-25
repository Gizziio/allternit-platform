import { NextResponse } from "next/server";
import { hasAdminAccount } from "@/lib/auth/setup";
import { getEnv } from "@/lib/cloudflare";
import { getPrimaryDomain } from "@/lib/user";

export async function GET() {
	const env = getEnv();
	const [adminAccountExists, domain] = await Promise.all([
		hasAdminAccount(env),
		getPrimaryDomain(env),
	]);
	return NextResponse.json({
		hasAdminAccount: adminAccountExists,
		hasPrimaryDomain: !!domain,
		primaryDomain: domain ? { hostname: domain.hostname } : null,
	}, {
		headers: { "Cache-Control": "no-store" },
	});
}
