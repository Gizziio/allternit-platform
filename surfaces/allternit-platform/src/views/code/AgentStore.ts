import { create } from 'zustand';

export type AgentRole = 'Planner' | 'Implementer' | 'Reviewer' | 'Tester' | 'Security';
export type AgentStatus = 'Idle' | 'Thinking' | 'Working' | 'Waiting';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  currentTaskId: string | null;
  avatar?: string;
}

interface AgentState {
  agents: Agent[];
  assignAgent: (agentId: string, taskId: string) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [
    { id: 'a1', name: 'Architect', role: 'Planner', status: 'Idle', currentTaskId: null },
    { id: 'a2', name: 'Coder', role: 'Implementer', status: 'Working', currentTaskId: 't2' },
    { id: 'a3', name: 'QA', role: 'Tester', status: 'Waiting', currentTaskId: null },
  ],
  
  assignAgent: (agentId, taskId) => set((state) => ({
    agents: state.agents.map(a => a.id === agentId ? { ...a, currentTaskId: taskId, status: 'Working' } : a)
  })),

  updateAgentStatus: (agentId, status) => set((state) => ({
    agents: state.agents.map(a => a.id === agentId ? { ...a, status } : a)
  }))
}));
