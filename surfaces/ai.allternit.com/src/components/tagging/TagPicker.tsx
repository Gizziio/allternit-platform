"use client";

import React, { useState, useMemo } from "react";
import { Plus, Check, X, Tag as TagIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useTagStore } from "@/lib/tags/tag.store";
import { useTags } from "@/lib/tags/useTags";
import { TagChip } from "./Tag";
import type { TagColor, TagScope } from "@/lib/tags/tag.types";
import { TAG_COLOR_STYLES } from "@/lib/tags/tag.types";

interface TagPickerProps {
  targetId: string;
  targetType: TagScope;
  scope?: TagScope | "global";
}

const ALL_COLORS: TagColor[] = [
  "slate", "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];

export function TagPicker({ targetId, targetType, scope = "global" }: TagPickerProps) {
  const { tags, taggings, isLoading, error } = useTags();
  const createTag = useTagStore((state) => state.createTag);
  const addTagging = useTagStore((state) => state.addTagging);
  const removeTagging = useTagStore((state) => state.removeTagging);
  const resetError = useTagStore((state) => state.resetError);

  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<TagColor>("blue");
  const [search, setSearch] = useState("");

  const assignedTaggings = taggings.filter(
    (tg) => tg.targetId === targetId && tg.targetType === targetType
  );
  const assignedTagIds = new Set(assignedTaggings.map((tg) => tg.tagId));

  const availableTags = useMemo(() => {
    return tags.filter(
      (t) =>
        !assignedTagIds.has(t.id) &&
        (scope === "global" || t.scope === scope || t.scope === "global") &&
        t.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [tags, assignedTagIds, scope, search]);

  const assignedTags = tags.filter((t) => assignedTagIds.has(t.id));

  const handleCreate = async () => {
    const label = newLabel.trim();
    if (!label || isSubmitting) return;
    setIsSubmitting(true);
    resetError();
    try {
      const tag = await createTag({ label, color: newColor, scope: scope === "global" ? "global" : scope });
      await addTagging(tag.id, targetId, targetType);
      setNewLabel("");
      setIsCreating(false);
      setSearch("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 shadow-xl">
      <div className="mb-3 flex flex-wrap gap-2">
        {assignedTags.length === 0 && (
          <span className="text-xs text-[var(--text-secondary)]">No tags assigned</span>
        )}
        {assignedTags.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            removable
            onRemove={async () => {
              const tg = assignedTaggings.find((t) => t.tagId === tag.id);
              if (!tg || isSubmitting) return;
              setIsSubmitting(true);
              resetError();
              try {
                await removeTagging(tg.id);
              } finally {
                setIsSubmitting(false);
              }
            }}
          />
        ))}
      </div>

      <div className="relative mb-2">
        <TagIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={14} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search or create tag..."
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] py-1.5 pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-primary)] focus:outline-none"
        />
      </div>

      <div className="mb-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto py-1">
        {availableTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            disabled={isSubmitting || isLoading}
            onClick={async () => {
              if (isSubmitting) return;
              setIsSubmitting(true);
              resetError();
              try {
                await addTagging(tag.id, targetId, targetType);
                setSearch("");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50",
              TAG_COLOR_STYLES[tag.color].bg,
              TAG_COLOR_STYLES[tag.color].text,
              TAG_COLOR_STYLES[tag.color].border,
              "hover:brightness-110"
            )}
          >
            <Plus size={10} weight="bold" />
            {tag.label}
          </button>
        ))}
        {availableTags.length === 0 && search.trim() && (
          <span className="text-xs text-[var(--text-secondary)]">
            No matching tags. Create &quot;{search}" below.
          </span>
        )}
      </div>

      {!isCreating ? (
        <button
          type="button"
          disabled={isSubmitting || isLoading}
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline disabled:opacity-50"
        >
          <Plus size={12} />
          Create new tag
        </button>
      ) : (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Tag name"
            autoFocus
            className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
          <div className="flex flex-wrap gap-1">
            {ALL_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewColor(color)}
                className={cn(
                  "h-5 w-5 rounded-full border",
                  TAG_COLOR_STYLES[color].bg,
                  TAG_COLOR_STYLES[color].border,
                  newColor === color && "ring-1 ring-white"
                )}
                aria-label={`Select ${color} color`}
              >
                {newColor === color && <Check size={12} className="m-auto text-white" weight="bold" />}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewLabel("");
              }}
              className="rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              <X size={14} />
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newLabel.trim() || isSubmitting}
              className="rounded bg-[var(--accent-primary)] px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
