import { cn } from "@/lib/utils";
import type { TooltipProps } from "./tooltip-types";

export function Tooltip({ label, children, className }: TooltipProps) {
	return (
		<span className={cn("group/tooltip relative inline-flex", className)}>
			{children}
			<span
				role="tooltip"
				className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity delay-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
			>
				{label}
			</span>
		</span>
	);
}
