export type MailboxDetail = {
	id: string;
	userId: string;
	domainId: string;
	localPart: string;
	displayName: string | null;
	type?: "personal" | "shared";
	permission?: "read_only" | "send_as" | "send_on_behalf" | "full_access";
	disabled?: boolean;
	createdAt: string;
	hostname: string;
	isPrimary?: boolean;
};

export type MailboxDetailResponse = {
	mailbox?: MailboxDetail;
	error?: string;
};
