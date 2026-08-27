"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch, getClientSessionToken } from "@/lib/auth/client";
import type { AuthGuardProps } from "./auth-guard-types";
import { PageSkeleton } from "@/components/page-skeletons";

export function AuthGuard({ children, mode = "protected", requireMailbox, requireRole }: AuthGuardProps) {
	const pathname = usePathname();
	const router = useRouter();
	const [authorized, setAuthorized] = useState(mode === "public");

	useEffect(() => {
		let cancelled = false;
		const token = getClientSessionToken();

		if (!token) {
			if (mode === "protected") router.replace("/login");
			return;
		}

		async function checkSession() {
			const response = await authFetch("/api/auth/me", { redirectOnUnauthorized: mode === "protected" });
			if (cancelled) return;

			if (!response.ok) {
				if (mode === "public") setAuthorized(true);
				return;
			}

			const data = (await response.json()) as { hasMailboxes?: boolean; user?: { role?: string } };
			if (mode === "public") {
				router.replace(data.hasMailboxes === false ? "/onboarding" : "/inbox");
				return;
			}

			if (requireMailbox && data.hasMailboxes === false && pathname !== "/onboarding") {
				router.replace("/onboarding");
				return;
			}

			if (!requireMailbox && data.hasMailboxes && pathname === "/onboarding") {
				router.replace("/inbox");
				return;
			}

			if (requireRole && data.user?.role !== requireRole) {
				router.replace("/inbox");
				return;
			}

			setAuthorized(true);
		}

		void checkSession();

		return () => {
			cancelled = true;
		};
	}, [mode, pathname, requireMailbox, requireRole, router]);

	if (!authorized) return <PageSkeleton />;
	return <>{children}</>;
}
