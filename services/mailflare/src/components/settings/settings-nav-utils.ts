import type { SettingsNavItem } from "./settings-nav-types";

export const settingsNavItems: SettingsNavItem[] = [
	{
		href: "/settings",
		label: "Account",
	},
	{
		href: "/settings/rules",
		label: "Rules",
	},
	{
		href: "/settings/import",
		label: "Import",
	},
	{
		href: "/settings/export",
		label: "Export",
	},
];

export function isActiveSettingsPath(pathname: string, href: string): boolean {
	if (href === "/settings") return pathname === href;
	return pathname === href || pathname.startsWith(`${href}/`);
}
