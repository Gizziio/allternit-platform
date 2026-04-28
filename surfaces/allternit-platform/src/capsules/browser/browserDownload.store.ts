import { create } from 'zustand';

export interface BrowserDownload {
  id: string;
  filename: string;
  url: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number;
  size?: string;
  startedAt: number;
  completedAt?: number;
}

interface BrowserDownloadStore {
  downloads: BrowserDownload[];
  addDownload: (download: Omit<BrowserDownload, 'id' | 'startedAt'>) => string;
  updateDownload: (id: string, updates: Partial<BrowserDownload>) => void;
  removeDownload: (id: string) => void;
  clearCompleted: () => void;
}

export const useBrowserDownloadStore = create<BrowserDownloadStore>((set, get) => ({
  downloads: [],
  addDownload: (download) => {
    const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const item: BrowserDownload = { ...download, id, startedAt: Date.now() };
    set((state) => ({ downloads: [item, ...state.downloads] }));
    return id;
  },
  updateDownload: (id, updates) => {
    set((state) => ({
      downloads: state.downloads.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    }));
  },
  removeDownload: (id) => {
    set((state) => ({
      downloads: state.downloads.filter((d) => d.id !== id),
    }));
  },
  clearCompleted: () => {
    set((state) => ({
      downloads: state.downloads.filter((d) => d.status !== 'completed' && d.status !== 'error'),
    }));
  },
}));
