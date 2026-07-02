import React from "react";
import { cn } from "@/lib/utils";

export function AgentListItem({ 
  id, 
  name, 
  count, 
  activeCount, 
  isSelected, 
  onClick, 
  icon: Icon 
}: { 
  id: string | null; 
  name: string; 
  count: number; 
  activeCount?: number; 
  isSelected: boolean; 
  onClick: () => void; 
  icon: any; 
}) {
  return (
    <button type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-2.5 rounded-lg border-none cursor-pointer transition-all duration-200",
        isSelected 
          ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] shadow-sm" 
          : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn(
          "size-8 rounded-lg flex items-center justify-center shrink-0 border border-solid",
          isSelected ? "border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10" : "border-muted bg-muted/30"
        )}>
          <Icon size={16} weight={isSelected ? "fill" : "regular"} />
        </div>
        <span className="text-[13px] font-semibold truncate">{name}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {activeCount !== undefined && activeCount > 0 && (
          <span className="size-2  rounded-full bg-green-500 animate-pulse" />
        )}
        <span className="text-[11px] font-bold bg-muted px-1.5 py-0.5 rounded-md min-w-[20px] text-center">
          {count}
        </span>
      </div>
    </button>
  );
}
