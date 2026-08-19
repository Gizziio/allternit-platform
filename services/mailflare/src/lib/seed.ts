import {
	demoCredentials,
	ensureDemoDomain,
	ensureDemoMailboxes,
	ensureDemoUser,
	ensureSeedApiKey,
	insertDemoMessages,
	type SeedApiKeyResult,
} from "@/lib/seed-utils";

export type SeedResult = {
	messageCount: number;
	agentMailboxId: string;
	agentApiKey: SeedApiKeyResult;
	adminApiKey: SeedApiKeyResult;
};

/** Dev-only seed without Cloudflare API (domain must be onboarded separately). */
export async function seedDemoData(env: CloudflareEnv): Promise<SeedResult> {
	const user = await ensureDemoUser(env);
	const domain = await ensureDemoDomain(env, user.id);
	const mailboxMap = await ensureDemoMailboxes(env, user.id, domain.id);
	const messageCount = await insertDemoMessages(env, user.id, mailboxMap);

	// Demo "agent" mailbox plus the two key shapes external systems use: a key scoped
	// to just that mailbox (send+read) and an admin key (mailbox/domain management).
	const agentMailboxId = mailboxMap.agent.id;
	const agentApiKey = await ensureSeedApiKey(
		env,
		user.id,
		"seed-agent-key",
		["send", "read"],
		[agentMailboxId],
	);
	const adminApiKey = await ensureSeedApiKey(env, user.id, "seed-admin-key", ["admin"], null);

	console.info("Seeded demo user:", demoCredentials);
	if (agentApiKey.key) console.info("Seeded agent API key (send+read, agent mailbox):", agentApiKey.key);
	if (adminApiKey.key) console.info("Seeded admin API key:", adminApiKey.key);

	return { messageCount, agentMailboxId, agentApiKey, adminApiKey };
}
