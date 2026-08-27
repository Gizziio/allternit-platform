"use client";

import { useQuery } from "@tanstack/react-query";
import { LogIn, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SkeletonRows } from "@/components/ui/skeleton";
import {
	fetchActivity,
	formatActivityDate,
	getActivityLabel,
	getActivityMetadata,
} from "./utils";

export default function ActivityPage() {
	const activity = useQuery({
		queryKey: ["activity"],
		queryFn: fetchActivity,
	});

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-neutral-900">Activity</h1>
				<p className="mt-1 text-sm text-neutral-500">Login and logout activity across user accounts.</p>
			</div>

			<section className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
				<div className="grid min-w-[980px] grid-cols-[110px_1.2fr_130px_130px_110px_110px_120px_170px] gap-4 border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
					<span>Activity</span>
					<span>User</span>
					<span>IP Address</span>
					<span>City</span>
					<span>Country</span>
					<span>Device</span>
					<span>Platform</span>
					<span>Time</span>
				</div>
				{activity.isLoading && <SkeletonRows count={7} />}
				{!activity.isLoading && (activity.data ?? []).length === 0 && (
					<p className="px-4 py-3 text-sm text-neutral-500">No login or logout activity yet</p>
				)}
				{(activity.data ?? []).map((log) => {
					const metadata = getActivityMetadata(log);
					const Icon = log.action === "auth.logout" ? LogOut : LogIn;
					return (
						<div key={log.id} className="grid min-w-[980px] grid-cols-[110px_1.2fr_130px_130px_110px_110px_120px_170px] gap-4 border-b border-neutral-100 px-4 py-3 last:border-b-0">
							<div className="min-w-0">
								<Badge variant="outline" className="gap-1">
									<Icon className="h-3 w-3" />
									{getActivityLabel(log.action)}
								</Badge>
							</div>
							<p className="truncate no-font-mono text-sm text-neutral-700">{log.actorEmail ?? "Unknown"}</p>
							<p className="truncate no-font-mono text-sm text-neutral-700">{metadata.ipAddress ?? "Unknown"}</p>
							<p className="truncate text-sm text-neutral-700">{metadata.city || "Unknown"}</p>
							<p className="truncate text-sm text-neutral-700">{metadata.country || "Unknown"}</p>
							<p className="truncate text-sm text-neutral-700">{metadata.device || "Unknown"}</p>
							<p className="truncate text-sm text-neutral-700">{metadata.platform || "Unknown"}</p>
							<p className="text-sm text-neutral-500">{formatActivityDate(log.createdAt)}</p>
						</div>
					);
				})}
			</section>
		</div>
	);
}
