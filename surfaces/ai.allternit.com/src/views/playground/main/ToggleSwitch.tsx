"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  on: boolean;
  onChange: () => void;
  label?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ on, onChange, label }) => {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[12px] text-[var(--ui-text-secondary)]">{label}</span>}
      <button type="button"
        onClick={onChange}
        className={cn(
          "w-9 h-5 rounded-full border-none cursor-pointer p-0 shrink-0 relative transition-all duration-150",
          on ? "bg-[var(--accent-primary)] opacity-90" : "bg-[var(--ui-border-default)]"
        )}
      >
        <span 
          className={cn(
            "absolute top-0.5 size-3.5 rounded-full transition-all duration-200",
            on ? "left-[18px] bg-[var(--surface-canvas)]" : "left-1 bg-[var(--ui-text-muted)]"
          )}
        />
      </button>
    </div>
  );
};
