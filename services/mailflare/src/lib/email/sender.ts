import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { domains, mailboxes, users } from "@/db/schema";
import { getMailboxAccessLevel } from "@/lib/mailboxes/access";
import { formatEmailAddress, getEmailAddress } from "@/lib/email/address";

export async function getAuthorizedSenderAddress(
	env: CloudflareEnv,
	input: {
		userId: string;
		from: string;
		mailboxId?: string | null;
	},
): Promise<{ fromAddr: string; mailboxId: string }> {
	if (!input.mailboxId) throw new Error("Mailbox is required");

	const db = getDb(env);
	const [mailbox] = await db
		.select({
			localPart: mailboxes.localPart,
			displayName: mailboxes.displayName,
			hostname: domains.hostname,
			id: mailboxes.id,
		})
		.from(mailboxes)
		.innerJoin(domains, eq(mailboxes.domainId, domains.id))
		.where(eq(mailboxes.id, input.mailboxId))
		.limit(1);

	if (!mailbox) throw new Error("Mailbox not found");
	const [actor] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
	if (!actor || actor.disabled) throw new Error("Sender account not found");

	const access = await getMailboxAccessLevel(db, actor, mailbox.id);
	if (!access?.canSendOnBehalf) {
		throw new Error("You do not have permission to send from this mailbox");
	}

	const requestedAddress = getEmailAddress(input.from);
	const mailboxAddress = `${mailbox.localPart}@${mailbox.hostname}`;
	if (requestedAddress.toLowerCase() !== mailboxAddress.toLowerCase()) {
		throw new Error("Sender address does not match the selected mailbox");
	}

	if (access.canSendAs) {
		return {
			fromAddr: formatEmailAddress(mailboxAddress, mailbox.displayName),
			mailboxId: mailbox.id,
		};
	}

	const mailboxName = mailbox.displayName || mailboxAddress;
	return {
		fromAddr: formatEmailAddress(mailboxAddress, `${actor.name} on behalf of ${mailboxName}`),
		mailboxId: mailbox.id,
	};
}
