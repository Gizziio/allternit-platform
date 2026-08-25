import type { LucideIcon } from "lucide-react";

export type NavLink = {
	href?: string;
	label?: string;
	icon?: LucideIcon;
	primary?: boolean;
	count?: number;
	onMessageDrop?: (messageIds: string[]) => void;
};
