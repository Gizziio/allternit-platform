import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface MemoryDocument {
  id: string;
  agentId?: string;
  title: string;
  sourceType: string;
  sourceUrl?: string;
  chunkCount: number;
  isIndexed: boolean;
  createdAt: string;
}

interface AgentMemoryState {
  documents: MemoryDocument[];
  isLoading: boolean;
}

interface AgentMemoryActions {
  fetchDocuments: () => Promise<void>;
  createDocument: (data: { title: string; content: string; agentId?: string; sourceType?: string }) => Promise<void>;
}

export const useAgentMemoryStore = create<AgentMemoryState & AgentMemoryActions>()(
  devtools((set) => ({
    documents: [],
    isLoading: false,

    fetchDocuments: async () => {
      set({ isLoading: true });
      try {
        const res = await fetch('/api/v1/memory/documents');
        if (res.ok) {
          const data = await res.json();
          set({ documents: data || [] });
        }
      } catch (e) {
        console.error('Failed to fetch memory documents', e);
      } finally {
        set({ isLoading: false });
      }
    },

    createDocument: async (data) => {
      try {
        const res = await fetch('/api/v1/memory/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const created = await res.json();
          set((s) => ({ documents: [created, ...s.documents] }));
        }
      } catch (e) {
        console.error('Failed to create memory document', e);
      }
    },
  }))
);
