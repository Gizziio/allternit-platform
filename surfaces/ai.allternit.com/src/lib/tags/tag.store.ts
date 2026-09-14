"use client";

/**
 * Tag store — Zustand-backed state for tags and taggings.
 *
 * Persistence is backed by the Allternit API (/api/v1/tags and /api/v1/taggings).
 * The local Zustand slice acts as an optimistic cache. The filter itself is kept
 * in localStorage so user selections survive reloads.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Tag, TagColor, TagScope, Tagging, TagFilterState } from "./tag.types";
import {
  listTags as apiListTags,
  listTaggings as apiListTaggings,
  createTag as apiCreateTag,
  updateTag as apiUpdateTag,
  deleteTag as apiDeleteTag,
  createTagging as apiCreateTagging,
  deleteTagging as apiDeleteTagging,
} from "./tag.api";

const FILTER_STORAGE_KEY = "allternit-tag-filter-v1";

interface TagState {
  tags: Tag[];
  taggings: Tagging[];
  filter: TagFilterState;
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;
}

interface TagActions {
  // Lifecycle
  loadTags: () => Promise<void>;
  resetError: () => void;

  // Tag CRUD
  createTag: (input: Omit<Tag, "id" | "createdAt" | "updatedAt">) => Promise<Tag>;
  updateTag: (id: string, updates: Partial<Omit<Tag, "id" | "createdAt" | "updatedAt">>) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;

  // Tagging CRUD
  addTagging: (tagId: string, targetId: string, targetType: TagScope) => Promise<Tagging>;
  removeTagging: (taggingId: string) => Promise<void>;
  removeTaggingsByTarget: (targetId: string, targetType?: TagScope) => Promise<void>;

  // Filtering
  setFilter: (filter: Partial<TagFilterState>) => void;
  clearFilter: () => void;

  // Queries (derived)
  getTagsForTarget: (targetId: string, targetType?: TagScope) => Tag[];
  getTargetsForTag: (tagId: string) => Tagging[];
}

function now() {
  return new Date().toISOString();
}

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const useTagStore = create<TagState & TagActions>()(
  persist(
    (set, get) => ({
      tags: [],
      taggings: [],
      filter: { includedTagIds: [], excludedTagIds: [], scope: "all" },
      isLoading: false,
      error: null,
      isHydrated: false,

      resetError: () => set({ error: null }),

      loadTags: async () => {
        set({ isLoading: true, error: null });
        try {
          const [tags, taggings] = await Promise.all([apiListTags(), apiListTaggings()]);
          set({ tags, taggings, isLoading: false, isHydrated: true });

          // Seed a default palette if the user has no tags yet.
          if (tags.length === 0) {
            await seedDefaultTags(get().createTag);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set({ isLoading: false, error: message, isHydrated: true });
        }
      },

      createTag: async (input) => {
        const optimistic: Tag = {
          ...input,
          id: generateId(),
          createdAt: now(),
          updatedAt: now(),
        };
        set((state) => ({ tags: [...state.tags, optimistic] }));

        try {
          const tag = await apiCreateTag(input);
          set((state) => ({
            tags: state.tags.map((t) => (t.id === optimistic.id ? tag : t)),
          }));
          return tag;
        } catch (err) {
          set((state) => ({
            tags: state.tags.filter((t) => t.id !== optimistic.id),
            error: err instanceof Error ? err.message : String(err),
          }));
          throw err;
        }
      },

      updateTag: async (id, updates) => {
        const previous = get().tags.find((t) => t.id === id);
        set((state) => ({
          tags: state.tags.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: now() } : t
          ),
        }));

        try {
          const tag = await apiUpdateTag(id, updates);
          set((state) => ({
            tags: state.tags.map((t) => (t.id === id ? tag : t)),
            error: null,
          }));
          return tag;
        } catch (err) {
          if (previous) {
            set((state) => ({
              tags: state.tags.map((t) => (t.id === id ? previous : t)),
            }));
          }
          set({ error: err instanceof Error ? err.message : String(err) });
          throw err;
        }
      },

      deleteTag: async (id) => {
        const previousTags = get().tags;
        const previousTaggings = get().taggings;
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== id),
          taggings: state.taggings.filter((tg) => tg.tagId !== id),
        }));

        try {
          await apiDeleteTag(id);
          set({ error: null });
        } catch (err) {
          set({ tags: previousTags, taggings: previousTaggings, error: err instanceof Error ? err.message : String(err) });
          throw err;
        }
      },

      addTagging: async (tagId, targetId, targetType) => {
        const existing = get().taggings.find(
          (tg) => tg.tagId === tagId && tg.targetId === targetId && tg.targetType === targetType
        );
        if (existing) return existing;

        const optimistic: Tagging = {
          id: generateId(),
          tagId,
          targetId,
          targetType,
          createdAt: now(),
        };
        set((state) => ({ taggings: [...state.taggings, optimistic] }));

        try {
          const tagging = await apiCreateTagging(tagId, targetId, targetType);
          set((state) => ({
            taggings: state.taggings.map((tg) => (tg.id === optimistic.id ? tagging : tg)),
            error: null,
          }));
          return tagging;
        } catch (err) {
          set((state) => ({
            taggings: state.taggings.filter((tg) => tg.id !== optimistic.id),
            error: err instanceof Error ? err.message : String(err),
          }));
          throw err;
        }
      },

      removeTagging: async (taggingId) => {
        const previous = get().taggings;
        set((state) => ({
          taggings: state.taggings.filter((tg) => tg.id !== taggingId),
        }));

        try {
          await apiDeleteTagging(taggingId);
          set({ error: null });
        } catch (err) {
          set({ taggings: previous, error: err instanceof Error ? err.message : String(err) });
          throw err;
        }
      },

      removeTaggingsByTarget: async (targetId, targetType) => {
        const toRemove = get().taggings.filter(
          (tg) => tg.targetId === targetId && (!targetType || tg.targetType === targetType)
        );
        set((state) => ({
          taggings: state.taggings.filter(
            (tg) => tg.targetId !== targetId || (targetType && tg.targetType !== targetType)
          ),
        }));

        try {
          await Promise.all(toRemove.map((tg) => apiDeleteTagging(tg.id)));
          set({ error: null });
        } catch (err) {
          set((state) => ({
            taggings: state.taggings.concat(
              toRemove.filter((tg) => !state.taggings.some((t) => t.id === tg.id))
            ),
            error: err instanceof Error ? err.message : String(err),
          }));
          throw err;
        }
      },

      setFilter: (filter) => {
        set((state) => ({ filter: { ...state.filter, ...filter } }));
      },

      clearFilter: () => {
        set({ filter: { includedTagIds: [], excludedTagIds: [], scope: "all" } });
      },

      getTagsForTarget: (targetId, targetType) => {
        const state = get();
        const tagIds = state.taggings
          .filter((tg) => tg.targetId === targetId && (!targetType || tg.targetType === targetType))
          .map((tg) => tg.tagId);
        return state.tags.filter((t) => tagIds.includes(t.id));
      },

      getTargetsForTag: (tagId) => {
        return get().taggings.filter((tg) => tg.tagId === tagId);
      },
    }),
    {
      name: FILTER_STORAGE_KEY,
      partialize: (state) => ({ filter: state.filter }),
    }
  )
);

async function seedDefaultTags(
  createTag: (input: Omit<Tag, "id" | "createdAt" | "updatedAt">) => Promise<Tag>
) {
  const defaults: Array<{ label: string; color: TagColor; scope: TagScope; description?: string }> = [
    { label: "Production", color: "green", scope: "agent", description: "Agent cleared for production use" },
    { label: "Draft", color: "amber", scope: "agent", description: "Work in progress" },
    { label: "Review", color: "orange", scope: "agent", description: "Awaiting review" },
    { label: "SEO", color: "blue", scope: "agent", description: "Search/marketing agent" },
    { label: "SDR", color: "violet", scope: "agent", description: "Sales development agent" },
    { label: "Media Buyer", color: "fuchsia", scope: "agent", description: "Ads and campaign agent" },
    { label: "Favorite", color: "yellow", scope: "global", description: "Pinned across surfaces" },
    { label: "Shared", color: "cyan", scope: "global", description: "Shared with team" },
  ];

  for (const d of defaults) {
    try {
      await createTag(d);
    } catch {
      // If seeding fails (e.g. offline) we leave the store empty and let the
      // next loadTags() attempt retry.
      break;
    }
  }
}
