"use client";

import React from "react";
import { TagChip } from "./Tag";
import type { Tag as TagType } from "@/lib/tags/tag.types";

interface TagCloudProps {
  tags: TagType[];
  selectedIds?: string[];
  onSelect?: (tag: TagType) => void;
  onRemove?: (tag: TagType) => void;
  emptyMessage?: string;
}

export function TagCloud({ tags, selectedIds = [], onSelect, onRemove, emptyMessage = "No tags yet" }: TagCloudProps) {
  if (tags.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)] italic">{emptyMessage}</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const isSelected = selectedIds.includes(tag.id);
        return (
          <TagChip
            key={tag.id}
            tag={tag}
            interactive={!!onSelect}
            removable={!!onRemove}
            onClick={() => onSelect?.(tag)}
            onRemove={() => onRemove?.(tag)}
            className={isSelected ? "ring-1 ring-white/40" : undefined}
          />
        );
      })}
    </div>
  );
}
