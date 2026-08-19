import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { contacts } from "@/db/schema";
import { normalizeEmailAddress } from "@/lib/email/address";
import type { ContactInput, MessageContactNames } from "@/lib/contacts/types";
import { getContactId, getContactNameFromAddress } from "@/lib/contacts/utils";

export async function upsertContactFromAddress(env: CloudflareEnv, input: ContactInput) {
	const email = normalizeEmailAddress(input.address);
	if (!email) return null;

	const displayName = getContactNameFromAddress(input.address);
	const db = getDb(env);
	const [existing] = await db
		.select()
		.from(contacts)
		.where(and(eq(contacts.userId, input.userId), eq(contacts.email, email)))
		.limit(1);
	const now = new Date();

	if (existing) {
		const nextDisplayName = getNextDisplayName(existing.displayName, existing.source, displayName);
		const nextSource = existing.source === "manual" ? "manual" : input.source;

		await db
			.update(contacts)
			.set({
				displayName: nextDisplayName,
				source: nextSource,
				lastSeenAt: now,
			})
			.where(eq(contacts.id, existing.id));
		return { ...existing, displayName: nextDisplayName, source: nextSource, lastSeenAt: now };
	}

	const id = getContactId(input.userId, email);
	await db.insert(contacts).values({
		id,
		userId: input.userId,
		email,
		displayName,
		source: input.source,
		lastSeenAt: now,
	});

	const [created] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
	return created ?? null;
}

export async function getContactDisplayNameMap(env: CloudflareEnv, userId: string, addresses: string[]) {
	const emails = Array.from(new Set(addresses.map(normalizeEmailAddress).filter(Boolean)));
	if (emails.length === 0) return new Map<string, string>();

	const db = getDb(env);
	const rows = await db
		.select()
		.from(contacts)
		.where(and(eq(contacts.userId, userId), inArray(contacts.email, emails)));

	return new Map(
		rows
			.filter((contact) => !!contact.displayName)
			.map((contact) => [contact.email, contact.displayName!]),
	);
}

export async function getMessageContactNames(
	env: CloudflareEnv,
	userId: string,
	fromAddr: string,
	toAddr: string,
): Promise<MessageContactNames> {
	const contactMap = await getContactDisplayNameMap(env, userId, [fromAddr, toAddr]);

	return {
		fromContactName: contactMap.get(normalizeEmailAddress(fromAddr)) ?? null,
		toContactName: contactMap.get(normalizeEmailAddress(toAddr)) ?? null,
	};
}

function getNextDisplayName(existingName: string | null, source: string, nextName: string | null): string | null {
	if (source === "manual") return existingName;
	if (nextName) return nextName;
	return existingName;
}
