export type MailboxAccessRouteParams = {
	params: Promise<{ id: string }>;
};

export type MailboxAccessResponseItem = {
	id: string;
	userId: string;
	userEmail: string;
	userName: string;
	permission: "read_only" | "send_as" | "send_on_behalf" | "full_access";
	createdAt: string;
};
