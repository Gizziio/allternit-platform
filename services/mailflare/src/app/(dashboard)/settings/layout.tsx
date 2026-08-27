import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-row">
			<main className="flex-1">{children}</main>
			<SettingsNav />
		</div>
	);
}
