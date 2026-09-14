"use client";

import React from "react";
import { TagCloud } from "./TagCloud";
import { useTagStore } from "@/lib/tags/tag.store";
import type { TagScope } from "@/lib/tags/tag.types";
import { X, Funnel } from "@phosphor-icons/react";

interface TagFilterProps {
  scope?: TagScope | "all";
}

export function TagFilter({ scope = "all" }: TagFilterProps) {
  const tags = useTagStore((state) => state.tags);
  const filter = useTagStore((state) => state.filter);
  const setFilter = useTagStore((state) => state.setFilter);
  const clearFilter = useTagStore((state) => state.clearFilter);

  const scopedTags = scope === "all" ? tags : tags.filter((t) => t.scope === scope || t.scope === "global");

  const toggleInclude = (tagId: string) => {
    const next = filter.includedTagIds.includes(tagId)
      ? filter.includedTagIds.filter((id) => id !== tagId)
      : [...filter.includedTagIds, tagId];
    setFilter({ includedTagIds: next });
  };

  const hasFilter = filter.includedTagIds.length > 0 || filter.excludedTagIds.length > 0;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
          <Funnel size={12} />
          Filter by tag
        </div>
        {hasFilter && (
          <button
            type="button"
            onClick={clearFilter}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>
      <TagCloud
        tags={scopedTags}
        selectedIds={filter.includedTagIds}
        onSelect={(tag) => toggleInclude(tag.id)}
      />
    </div>
  );
}
