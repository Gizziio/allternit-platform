import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface InboxItem {
  id: string;
  agentId?: string;
  type: 'mail' | 'gate_review' | 'run_complete' | 'system_alert' | 'ban_triggered';
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'unread' | 'read' | 'acknowledged' | 'dismissed';
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface AgentInboxState {
  items: InboxItem[];
  unreadCount: number;
  isLoading: boolean;
}

interface AgentInboxActions {
  fetchInbox: () => Promise<void>;
  markAsRead: (itemId: string) => Promise<void>;
  dismissItem: (itemId: string) => Promise<void>;
  acknowledgeItem: (itemId: string) => Promise<void>;
}

export const useAgentInboxStore = create<AgentInboxState & AgentInboxActions>()(
  devtools((set, get) => ({
    items: [],
    unreadCount: 0,
    isLoading: false,

    fetchInbox: async () => {
      set({ isLoading: true });
      try {
        const res = await fetch('/api/v1/inbox');
        if (res.ok) {
          const data = await res.json();
          set({ items: data.items || [], unreadCount: data.unreadCount || 0 });
        }
      } catch (e) {
        console.error('Failed to fetch inbox', e);
      } finally {
        set({ isLoading: false });
      }
    },

    markAsRead: async (itemId) => {
      try {
        await fetch('/api/v1/inbox', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, status: 'read' }),
        });
        set((s) => ({
          items: s.items.map((i) => (i.id === itemId ? { ...i, status: 'read' as const } : i)),
          unreadCount: Math.max(0, s.unreadCount - 1),
        }));
      } catch (e) {
        console.error('Failed to mark as read', e);
      }
    },

    dismissItem: async (itemId) => {
      try {
        await fetch('/api/v1/inbox', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, status: 'dismissed' }),
        });
        set((s) => ({
          items: s.items.filter((i) => i.id !== itemId),
          unreadCount: s.items.find((i) => i.id === itemId)?.status === 'unread'
            ? Math.max(0, s.unreadCount - 1)
            : s.unreadCount,
        }));
      } catch (e) {
        console.error('Failed to dismiss item', e);
      }
    },

    acknowledgeItem: async (itemId) => {
      try {
        await fetch('/api/v1/inbox', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, status: 'acknowledged' }),
        });
        set((s) => ({
          items: s.items.map((i) => (i.id === itemId ? { ...i, status: 'acknowledged' as const } : i)),
        }));
      } catch (e) {
        console.error('Failed to acknowledge item', e);
      }
    },
  }))
);
