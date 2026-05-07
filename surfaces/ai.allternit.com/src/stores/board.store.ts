import { create } from 'zustand';
import { subscribeSSE } from '../lib/sse/global-sse-manager';

export interface BoardItem {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';
  assigneeType?: 'human' | 'agent';
  assigneeId?: string;
  assigneeName?: string;
  reporterId: string;
  priority: number;
  labels?: string[];
  estimatedMinutes?: number;
  deadline?: string;
  dependencies?: string[];
  createdAt: string;
  updatedAt: string;
  comments?: BoardComment[];
}

export interface BoardComment {
  id: string;
  itemId: string;
  authorType: 'human' | 'agent';
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
}

export interface CreateBoardItemInput {
  title: string;
  description?: string;
  status?: string;
  priority?: number;
  labels?: string[];
  estimatedMinutes?: number;
  deadline?: string;
  dependencies?: string[];
  assigneeType?: 'human' | 'agent';
}

interface BoardState {
  items: BoardItem[];
  comments: Record<string, BoardComment[]>;
  isLoading: boolean;
  error: string | null;
  activeItemId: string | null;
  filterStatus: string | null;
  filterAssignee: string | null;

  fetchItems: (workspaceId: string) => Promise<void>;
  createItem: (workspaceId: string, input: CreateBoardItemInput) => Promise<BoardItem | null>;
  updateItem: (id: string, updates: Partial<BoardItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  moveItem: (id: string, status: BoardItem['status']) => Promise<void>;
  assignItem: (id: string, assigneeType: 'human' | 'agent', assigneeId: string, assigneeName?: string) => Promise<void>;
  addComment: (itemId: string, body: string, authorType?: 'human' | 'agent', authorId?: string) => Promise<void>;
  setActiveItem: (id: string | null) => void;
  setFilterStatus: (status: string | null) => void;
  setFilterAssignee: (assignee: string | null) => void;
  connectStream: (workspaceId: string) => () => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  items: [],
  comments: {},
  isLoading: false,
  error: null,
  activeItemId: null,
  filterStatus: null,
  filterAssignee: null,

  fetchItems: async (workspaceId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/v1/board-items?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const items: BoardItem[] = (data.items || []).map((item: any) => ({
        ...item,
        labels: item.labels ? JSON.parse(item.labels) : undefined,
        dependencies: item.dependencies ? JSON.parse(item.dependencies) : undefined,
        deadline: item.deadline ? new Date(item.deadline).toISOString() : undefined,
      }));
      const commentsMap: Record<string, BoardComment[]> = {};
      for (const item of items) {
        if (item.comments) {
          commentsMap[item.id] = item.comments;
        }
      }
      set({ items, comments: commentsMap, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createItem: async (workspaceId, input) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/v1/board-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, ...input }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const item: BoardItem = {
        ...data.item,
        labels: data.item.labels ? JSON.parse(data.item.labels) : undefined,
        dependencies: data.item.dependencies ? JSON.parse(data.item.dependencies) : undefined,
      };
      set((state) => ({ items: [item, ...state.items], isLoading: false }));
      return item;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return null;
    }
  },

  updateItem: async (id, updates) => {
    try {
      const res = await fetch(`/api/v1/board-items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? { ...i, ...data.item } : i)),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteItem: async (id) => {
    try {
      await fetch(`/api/v1/board-items/${id}`, { method: 'DELETE' });
      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        activeItemId: state.activeItemId === id ? null : state.activeItemId,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  moveItem: async (id, status) => {
    const { updateItem } = get();
    await updateItem(id, { status });
  },

  assignItem: async (id, assigneeType, assigneeId, assigneeName) => {
    try {
      const res = await fetch(`/api/v1/board-items/${id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeType, assigneeId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      set((state) => ({
        items: state.items.map((i) =>
          i.id === id
            ? { ...i, assigneeType: data.item.assigneeType, assigneeId: data.item.assigneeId, assigneeName }
            : i
        ),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addComment: async (itemId, body, authorType = 'human', authorId) => {
    try {
      const res = await fetch(`/api/v1/board-items/${itemId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, authorType, authorId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      set((state) => ({
        comments: {
          ...state.comments,
          [itemId]: [...(state.comments[itemId] || []), data.comment],
        },
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  setActiveItem: (id) => set({ activeItemId: id }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  setFilterAssignee: (assignee) => set({ filterAssignee: assignee }),

  connectStream: (workspaceId) => {
    const url = `/api/v1/board-stream/${workspaceId}`;

    const unsubscribe = subscribeSSE(url, {
      onMessage: (data) => {
        // Process board updates from SSE
        try {
          if (typeof data === 'object' && data !== null) {
            const event = data as Record<string, unknown>;
            const eventType = event.type;

            if (eventType === 'item.created' || eventType === 'item.updated') {
              const item = event.item as BoardItem | undefined;
              if (item) {
                set((state) => ({
                  items: state.items.map((i) => (i.id === item.id ? { ...i, ...item } : i)),
                }));
              }
            } else if (eventType === 'item.deleted') {
              const itemId = event.itemId as string | undefined;
              if (itemId) {
                set((state) => ({
                  items: state.items.filter((i) => i.id !== itemId),
                }));
              }
            }
          }
        } catch (err) {
          console.error('[BoardStream] Failed to process message:', err);
        }
      },
      onError: () => {
        console.warn('[BoardStream] Connection error, retrying...');
      },
      onCustom: {
        connected: () => {
          console.log('[BoardStream] Connected to', workspaceId);
        },
        heartbeat: () => {
          // keepalive
        },
      },
    });

    return unsubscribe;
  },
}));
