"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActiveSettingsPath, settingsNavItems } from "./settings-nav-utils";

export function SettingsNav() {
	const pathname = usePathname();

	return (
		<aside className="px-4 py-5 w-60">
			<div className="sticky top-6 space-y-2 bg-neutral-100/60 p-4 rounded-2xl">
				<h2 className="px-2 text-xs uppercase font-semibold text-neutral-400">Settings</h2>
				<nav className="">
					{settingsNavItems.map((item) => {
						const active = isActiveSettingsPath(pathname, item.href);
						return (
							<Link
								key={item.href}
								href={item.href}
								className={cn(
									"block rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
									active
										? "text-blue-700"
										: "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
								)}
							>
								{item.label}
							</Link>
						);
					})}
				</nav>
			</div>
		</aside>
	);
}
