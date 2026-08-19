import { Archive, Clock, MailOpen, Send, ShieldAlert, Star, Trash2 } from "lucide-react";
import type { MessageFolderConfig } from "./types";

export const inboxFolderConfig: MessageFolderConfig = {
	folder: "inbox",
	title: "Inbox",
	emptyText: "No emails",
	hrefPrefix: "/inbox",
	icon: Star,
	headerIcons: [MailOpen, Clock],
	showRowBadge: false,
};

export const sentFolderConfig: MessageFolderConfig = {
	folder: "sent",
	title: "Sent",
	emptyText: "No emails",
	hrefPrefix: "/sent",
	icon: Send,
	headerIcons: [MailOpen, Clock],
	badgeVariant: "outline",
};

export const archivedFolderConfig: MessageFolderConfig = {
	folder: "archived",
	title: "Archived",
	emptyText: "No archived emails",
	hrefPrefix: "/archived",
	icon: Archive,
	badgeVariant: "outline",
};

export const spamFolderConfig: MessageFolderConfig = {
	folder: "spam",
	title: "Spam",
	emptyText: "No spam",
	hrefPrefix: "/spam",
	icon: ShieldAlert,
	badgeVariant: "outline",
};

export const trashFolderConfig: MessageFolderConfig = {
	folder: "trash",
	title: "Trash",
	emptyText: "No emails in trash",
	hrefPrefix: "/trash",
	icon: Trash2,
	badgeVariant: "outline",
};
