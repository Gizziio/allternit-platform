"use client";

import { useEffect } from "react";
import { useTagStore } from "./tag.store";

/**
 * Loads tags and taggings once when a component mounts and keeps the
 * component subscribed to tag state. This replaces any localStorage-only
 * persistence paths with the API-backed Zustand store.
 */
export function useTags() {
  useEffect(() => {
    const { isHydrated, isLoading, loadTags } = useTagStore.getState();
    if (!isHydrated && !isLoading) {
      loadTags();
    }
  }, []);

  return useTagStore((state) => ({
    tags: state.tags,
    taggings: state.taggings,
    isLoading: state.isLoading,
    error: state.error,
  }));
}
