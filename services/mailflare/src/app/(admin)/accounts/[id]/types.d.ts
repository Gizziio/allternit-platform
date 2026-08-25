export type AccountDetail = {
	id: string;
	email: string;
	name: string;
	resetEmail: string | null;
	role: "admin" | "user";
	disabled?: boolean;
	createdAt: string;
};

export type DomainOption = {
	id: string;
	hostname: string;
};

export type AccountMailboxItem = {
	id: string;
	domainId: string;
	localPart: string;
	hostname: string;
	displayName: string | null;
	type: "personal" | "shared";
	createdAt: string;
};

export type AccountMailboxAccessItem = {
	mailboxId: string;
	localPart: string;
	hostname: string;
	displayName: string | null;
	permission: "read_only" | "send_as" | "send_on_behalf" | "full_access" | null;
};

export type AccountMailboxAccessResponse = {
	account?: AccountDetail;
	access?: AccountMailboxAccessItem[];
	error?: string;
};

export type AccountDetailResponse = {
	account?: AccountDetail;
	error?: string;
};
