import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface TestMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  latency?: number;
  tokens?: { input: number; output: number; total: number };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: Record<string, unknown>;
  duration?: number;
}

export interface TestSuiteSummary {
  id: string;
  agentId: string;
  name: string;
  description?: string;
  caseCount: number;
  runCount: number;
  createdAt: string;
}

interface AgentTestState {
  messages: TestMessage[];
  toolCalls: ToolCall[];
  isRunning: boolean;
  suites: TestSuiteSummary[];
  activeSuiteId: string | null;
}

interface AgentTestActions {
  sendTestMessage: (agentId: string, content: string, variables?: Record<string, string>) => Promise<void>;
  clearMessages: () => void;
  fetchSuites: () => Promise<void>;
  createSuite: (data: { agentId: string; name: string; description?: string; cases?: unknown[] }) => Promise<void>;
}

export const useAgentTestStore = create<AgentTestState & AgentTestActions>()(
  devtools((set) => ({
    messages: [],
    toolCalls: [],
    isRunning: false,
    suites: [],
    activeSuiteId: null,

    sendTestMessage: async (agentId, content, variables) => {
      set({ isRunning: true });
      const userMsg: TestMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, userMsg] }));

      try {
        const res = await fetch('/api/v1/agents/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            messages: [...useAgentTestStore.getState().messages, userMsg],
            variables,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.message) {
            set((s) => ({ messages: [...s.messages, data.message] }));
          }
          if (data.toolCalls?.length) {
            set((s) => ({ toolCalls: [...s.toolCalls, ...data.toolCalls] }));
          }
        } else {
          set((s) => ({
            messages: [...s.messages, {
              id: `err_${Date.now()}`,
              role: 'assistant',
              content: 'Error: Agent test execution failed. Please try again.',
              timestamp: new Date().toISOString(),
            }],
          }));
        }
      } catch (e) {
        console.error('Test message failed', e);
      } finally {
        set({ isRunning: false });
      }
    },

    clearMessages: () => set({ messages: [], toolCalls: [] }),

    fetchSuites: async () => {
      try {
        const res = await fetch('/api/v1/agents/suites');
        if (res.ok) {
          const data = await res.json();
          set({ suites: data || [] });
        }
      } catch (e) {
        console.error('Failed to fetch test suites', e);
      }
    },

    createSuite: async (data) => {
      try {
        const res = await fetch('/api/v1/agents/suites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          const created = await res.json();
          set((s) => ({ suites: [created, ...s.suites] }));
        }
      } catch (e) {
        console.error('Failed to create test suite', e);
      }
    },
  }))
);
