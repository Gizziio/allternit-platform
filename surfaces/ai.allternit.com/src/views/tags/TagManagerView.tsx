"use client";

import React, { useState, useMemo } from "react";
import { Plus, MagnifyingGlass, Trash, Pencil, Tag as TagIcon, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useTagStore } from "@/lib/tags/tag.store";
import { useTags } from "@/lib/tags/useTags";
import { TagChip } from "@/components/tagging";
import type { TagColor, TagScope, Tag as TagType } from "@/lib/tags/tag.types";
import { TAG_COLOR_STYLES } from "@/lib/tags/tag.types";

const ALL_COLORS: TagColor[] = [
  "slate", "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];

const SCOPE_LABELS: Record<TagScope | "global", string> = {
  global: "Global",
  agent: "Agent",
  tool: "Tool",
  script: "Script",
  artifact: "Artifact",
  session: "Session",
  plugin: "Plugin",
  mcp: "MCP",
  skill: "Skill",
};

export function TagManagerView() {
  const { tags, taggings, isLoading, error } = useTags();
  const createTag = useTagStore((state) => state.createTag);
  const updateTag = useTagStore((state) => state.updateTag);
  const deleteTag = useTagStore((state) => state.deleteTag);
  const resetError = useTagStore((state) => state.resetError);

  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<TagColor>("blue");
  const [newScope, setNewScope] = useState<TagScope | "global">("global");
  const [newDescription, setNewDescription] = useState("");

  const filteredTags = useMemo(() => {
    const q = search.toLowerCase();
    return tags.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [tags, search]);

  const usageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tg of taggings) {
      counts[tg.tagId] = (counts[tg.tagId] || 0) + 1;
    }
    return counts;
  }, [taggings]);

  const resetForm = () => {
    setNewLabel("");
    setNewColor("blue");
    setNewScope("global");
    setNewDescription("");
    setEditingTag(null);
    setIsCreating(false);
  };

  const startEdit = (tag: TagType) => {
    setEditingTag(tag);
    setNewLabel(tag.label);
    setNewColor(tag.color);
    setNewScope(tag.scope);
    setNewDescription(tag.description || "");
    setIsCreating(true);
  };

  const handleSave = async () => {
    const label = newLabel.trim();
    if (!label || isSubmitting) return;
    setIsSubmitting(true);
    resetError();
    try {
      if (editingTag) {
        await updateTag(editingTag.id, {
          label,
          color: newColor,
          scope: newScope,
          description: newDescription.trim() || undefined,
        });
      } else {
        await createTag({
          label,
          color: newColor,
          scope: newScope,
          description: newDescription.trim() || undefined,
        });
      }
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    resetError();
    try {
      await deleteTag(id);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-8 pb-12 pt-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
            Tags
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Organize agents, tools, scripts, artifacts, and sessions with shared labels.
          </p>
        </div>
        <button
          type="button"
          disabled={isSubmitting || isLoading}
          onClick={() => {
            resetForm();
            setIsCreating(true);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus size={16} />
          New Tag
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags..."
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] py-2 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
        </div>
      </div>

      {isCreating && (
        <div className="mb-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              {editingTag ? "Edit tag" : "Create tag"}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Name</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Production"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Scope</label>
              <select
                value={newScope}
                onChange={(e) => setNewScope(e.target.value as TagScope | "global")}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              >
                {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Description</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">Color</label>
              <div className="flex flex-wrap gap-2">
                {ALL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    className={cn(
                      "h-7 w-7 rounded-full border transition-transform",
                      TAG_COLOR_STYLES[color].bg,
                      TAG_COLOR_STYLES[color].border,
                      newColor === color && "scale-110 ring-2 ring-white"
                    )}
                    aria-label={`Select ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!newLabel.trim() || isSubmitting}
              className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {editingTag ? "Save changes" : "Create tag"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-3">
        {filteredTags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 transition-colors hover:border-[var(--border-hover)]"
          >
            <div className="flex items-center gap-3">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", TAG_COLOR_STYLES[tag.color].bg)}>
                <TagIcon size={16} className={TAG_COLOR_STYLES[tag.color].text} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <TagChip tag={tag} />
                  <span className="text-xs text-[var(--text-secondary)]">{SCOPE_LABELS[tag.scope]}</span>
                </div>
                {tag.description && (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{tag.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-secondary)]">
                {usageCounts[tag.id] || 0} uses
              </span>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => startEdit(tag)}
                className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
                aria-label={`Edit ${tag.label}`}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDeleteTag(tag.id)}
                className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                aria-label={`Delete ${tag.label}`}
              >
                <Trash size={14} />
              </button>
            </div>
          </div>
        ))}
        {filteredTags.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-12 text-center">
            <TagIcon size={32} className="mx-auto mb-3 text-[var(--text-secondary)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">No tags found</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {search ? "Try a different search." : "Create your first tag to get started."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TagManagerView;
