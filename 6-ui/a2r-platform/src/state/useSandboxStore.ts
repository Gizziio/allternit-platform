import { create } from 'zustand';

export interface Sandbox {
  id: string;
  name: string;
  type: 'docker' | 'local' | 'vm';
  status: 'running' | 'stopped' | 'building';
  secrets: string[]; // IDs
}

interface SandboxState {
  sandboxes: Sandbox[];
  activeSandboxId: string | null;
  createSandbox: (name: string, type: Sandbox['type']) => void;
  setActiveSandbox: (id: string) => void;
}

export const useSandboxStore = create<SandboxState>((set) => ({
  sandboxes: [
    { id: 'sb1', name: 'Node 18 Environment', type: 'docker', status: 'running', secrets: ['npm_token'] },
    { id: 'sb2', name: 'Python 3.11 Environment', type: 'vm', status: 'stopped', secrets: [] }
  ],
  activeSandboxId: 'sb1',
  
  createSandbox: (name, type) => set((state) => ({
    sandboxes: [...state.sandboxes, { 
      id: Math.random().toString(36).substring(7), 
      name, 
      type, 
      status: 'building', 
      secrets: [] 
    }]
  })),

  setActiveSandbox: (id) => set({ activeSandboxId: id })
}));
