export type ApiKey = {
	id: string;
	name: string;
	prefix: string;
	scopes: string;
	mailboxIds?: string | null;
	revokedAt?: string | null;
	createdAt?: string;
	lastUsedAt?: string | null;
};
