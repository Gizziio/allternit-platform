import type { BulkMessageAction } from "@/app/api/messages/bulk/types";
import type { MessageDirection } from "@/hooks/types";

export type MessageActionsProps = {
	messageId: string;
	mailboxId: string | null;
	senderAddress: string;
	direction: MessageDirection;
	status: string;
	read: boolean;
	unsubscribeUrl?: string | null;
};

export type SingleMessageAction = BulkMessageAction | "reply";

export type TrashSenderRuleInput = {
	mailboxId: string;
	senderAddress: string;
};
