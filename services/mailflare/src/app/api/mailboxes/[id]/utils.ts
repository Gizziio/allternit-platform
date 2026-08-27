import { eq } from "drizzle-orm";
import { domains, mailboxes } from "@/db/schema";
import type { getDb } from "@/db";
import type { MailboxUpdateValues } from "./types";

type Db = ReturnType<typeof getDb>;

export function selectMailboxForUser(db: Db, userId: string, mailboxId: string) {
	return db
		.select({
			id: mailboxes.id,
			userId: mailboxes.userId,
			domainId: mailboxes.domainId,
			localPart: mailboxes.localPart,
			displayName: mailboxes.displayName,
			type: mailboxes.type,
			disabled: mailboxes.disabled,
			createdAt: mailboxes.createdAt,
			hostname: domains.hostname,
		})
		.from(mailboxes)
		.innerJoin(domains, eq(mailboxes.domainId, domains.id))
		.where(eq(mailboxes.id, mailboxId))
		.limit(1);
}

export function getMailboxUpdateValues(input: MailboxUpdateValues): MailboxUpdateValues {
	if (!("displayName" in input)) return {};

	const displayName = input.displayName?.trim() || null;
	return { displayName };
}
