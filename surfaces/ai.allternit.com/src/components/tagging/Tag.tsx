"use client";

import React from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { Tag as TagType } from "@/lib/tags/tag.types";
import { TAG_COLOR_STYLES } from "@/lib/tags/tag.types";

interface TagProps {
  tag: TagType;
  onRemove?: () => void;
  onClick?: () => void;
  removable?: boolean;
  interactive?: boolean;
  className?: string;
}

export function TagChip({ tag, onRemove, onClick, removable = false, interactive = false, className }: TagProps) {
  const styles = TAG_COLOR_STYLES[tag.color];

  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
        styles.bg,
        styles.text,
        styles.border,
        (interactive || onClick) && "cursor-pointer hover:brightness-110",
        className
      )}
    >
      {tag.icon && <span className="opacity-80">{tag.icon}</span>}
      <span>{tag.label}</span>
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-0.5 ml-0.5 rounded-full p-0.5 opacity-70 hover:bg-black/20 hover:opacity-100 focus:outline-none"
          aria-label={`Remove ${tag.label} tag`}
        >
          <X size={10} weight="bold" />
        </button>
      )}
    </span>
  );
}
