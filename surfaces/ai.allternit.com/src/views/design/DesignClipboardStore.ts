/**
 * Design clipboard — persisted in localStorage.
 *
 * Any part of the design surface (Inspect CSS copy, SVG export, token copy)
 * calls pushClipboardItem() to record the snippet here.
 * DesignClipboardPanel reads the store to render the history list.
 */

import { create } from 'zustand';

export type ClipboardItemType = 'css' | 'svg' | 'token' | 'code';

export interface ClipboardItem {
  id: string;
  type: ClipboardItemType;
  title: string;
  content: string;
  timestamp: number;
}

const LS_KEY = 'allternit-design-clipboard-v2';
const MAX_ITEMS = 50;

function load(): ClipboardItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(items: ClipboardItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

interface DesignClipboardState {
  items: ClipboardItem[];
  push: (type: ClipboardItemType, title: string, content: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  hydrate: () => void;
}

export const useDesignClipboardStore = create<DesignClipboardState>((set, get) => ({
  items: [],

  hydrate() {
    set({ items: load() });
  },

  push(type, title, content) {
    const item: ClipboardItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      title,
      content,
      timestamp: Date.now(),
    };
    const next = [item, ...get().items].slice(0, MAX_ITEMS);
    save(next);
    set({ items: next });
  },

  remove(id) {
    const next = get().items.filter(i => i.id !== id);
    save(next);
    set({ items: next });
  },

  clear() {
    save([]);
    set({ items: [] });
  },
}));

/** Convenience — push without importing the hook (usable in callbacks). */
export function pushClipboardItem(type: ClipboardItemType, title: string, content: string) {
  useDesignClipboardStore.getState().push(type, title, content);
}
