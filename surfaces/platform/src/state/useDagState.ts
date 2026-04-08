import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DagNode, NodeStatus } from '../types/code/dag';

interface DagState {
  nodes: DagNode[];
  activeNodeId: string | null;
  addNode: (node: Omit<DagNode, 'id' | 'status' | 'dependencies' | 'artifacts'>) => void;
  updateNodeStatus: (id: string, status: NodeStatus) => void;
  addDependency: (sourceId: string, targetId: string) => void;
  setActiveNode: (id: string | null) => void;
  reset: () => void;
}

export const useDagState = create<DagState>()(
  persist(
    (set, get) => ({
      nodes: [
        { id: 'D0', title: 'Confirm Runtime Entrypoint', status: 'completed', dependencies: [], artifacts: [], owner: 'architect' },
        { id: 'D1', title: 'Unified Run Event Model', status: 'completed', dependencies: ['D0'], artifacts: [], owner: 'architect' },
        { id: 'D2', title: 'Chat Mode Wiring', status: 'completed', dependencies: ['D1'], artifacts: [], owner: 'implementer' },
        { id: 'D3', title: 'Inspector Wiring', status: 'completed', dependencies: ['D1'], artifacts: [], owner: 'implementer' },
        { id: 'D4', title: 'Orchestration Kanban', status: 'running', dependencies: ['D1'], artifacts: [], owner: 'architect' },
        { id: 'D5', title: 'Cowork Mode Panels', status: 'completed', dependencies: ['D1', 'D3'], artifacts: [], owner: 'implementer' },
        { id: 'D6', title: 'Plugin Registry Scanning', status: 'pending', dependencies: ['D5'], artifacts: [], owner: 'implementer' },
        { id: 'D7', title: 'MCP Connectors', status: 'pending', dependencies: ['D6'], artifacts: [], owner: 'architect' },
        { id: 'D8', title: 'Scheduler / Cron', status: 'completed', dependencies: ['D1', 'D3'], artifacts: [], owner: 'implementer' },
        { id: 'D9', title: 'Code Mode (ADE) Wiring', status: 'running', dependencies: ['D1', 'D3', 'D4'], artifacts: [], owner: 'architect' },
      ],
      activeNodeId: null,

      addNode: (data) => set((state) => ({
        nodes: [...state.nodes, { 
          ...data, 
          id: Math.random().toString(36).substring(7),
          status: 'pending',
          dependencies: [],
          artifacts: []
        }]
      })),

      updateNodeStatus: (id, status) => set((state) => ({
        nodes: state.nodes.map(n => n.id === id ? { ...n, status } : n)
      })),

      addDependency: (sourceId, targetId) => set((state) => ({
        nodes: state.nodes.map(n => n.id === sourceId ? { ...n, dependencies: [...n.dependencies, targetId] } : n)
      })),

      setActiveNode: (id) => set({ activeNodeId: id }),
      
      reset: () => set({ nodes: [], activeNodeId: null })
    }),
    { name: 'allternit-dag-storage-v2' }
  )
);
