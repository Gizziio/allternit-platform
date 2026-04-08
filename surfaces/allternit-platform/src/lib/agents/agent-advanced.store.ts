/**
 * Agent Advanced Store - Multi-Agent, Swarms, Workflows, Templates
 * 
 * Extends the base agent store with advanced features for:
 * - Subagent management
 * - Swarm orchestration
 * - Workflow execution
 * - Template management
 * - Advanced configuration
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  SubagentConfig,
  AgentSwarm,
  SwarmRun,
  SwarmMessage,
  AgentWorkflow,
  WorkflowExecutionState,
  LoopControlConfig,
  AgentCallOptions,
  AgentToolConfig,
  AgentMemoryConfig,
  CostControlConfig,
  SafetyConfig,
  ObservabilityConfig,
  AgentRelationship,
  AdvancedAgentConfig,
  AgentTemplate,
  AdvancedAgentRun,
} from './agent-advanced.types';
import { PREDEFINED_AGENT_TEMPLATES } from './agent-advanced.types';
import type { Agent, AgentRun } from './agent.types';

// ============================================================================
// State
// ============================================================================

interface AdvancedAgentState {
  // Advanced Configurations
  advancedConfigs: Record<string, AdvancedAgentConfig>; // keyed by agentId
  
  // Subagents
  subagents: Record<string, SubagentConfig[]>; // keyed by parent agentId
  
  // Swarms
  swarms: AgentSwarm[];
  activeSwarmId: string | null;
  swarmRuns: Record<string, SwarmRun[]>; // keyed by swarmId
  swarmMessages: Record<string, SwarmMessage[]>; // keyed by swarmRunId
  
  // Workflows
  workflows: Record<string, AgentWorkflow[]>; // keyed by agentId
  workflowExecutions: Record<string, WorkflowExecutionState>; // keyed by runId
  
  // Templates
  templates: AgentTemplate[];
  selectedTemplateId: string | null;
  
  // Call Options (per-run overrides)
  activeCallOptions: AgentCallOptions | null;
  
  // UI State
  showAdvancedConfig: boolean;
  activeConfigTab: 'subagents' | 'swarms' | 'workflows' | 'tools' | 'memory' | 'safety' | 'observability';
  
  // Loading States
  isLoadingSwarms: boolean;
  isLoadingWorkflows: boolean;
  isCreatingSwarm: boolean;
  isExecutingWorkflow: boolean;
}

// ============================================================================
// Actions
// ============================================================================

interface AdvancedAgentActions {
  // Subagent Management
  fetchSubagents: (parentAgentId: string) => Promise<void>;
  createSubagent: (parentAgentId: string, config: Omit<SubagentConfig, 'id' | 'parentAgentId'>) => Promise<void>;
  updateSubagent: (parentAgentId: string, subagentId: string, updates: Partial<SubagentConfig>) => Promise<void>;
  deleteSubagent: (parentAgentId: string, subagentId: string) => Promise<void>;
  spawnSubagent: (parentAgentId: string, subagentId: string, input: string) => Promise<string>;
  
  // Swarm Management
  fetchSwarms: () => Promise<void>;
  createSwarm: (swarm: Omit<AgentSwarm, 'id'>) => Promise<AgentSwarm>;
  updateSwarm: (swarmId: string, updates: Partial<AgentSwarm>) => Promise<void>;
  deleteSwarm: (swarmId: string) => Promise<void>;
  joinSwarm: (swarmId: string, agentId: string, role: string) => Promise<void>;
  leaveSwarm: (swarmId: string, agentId: string) => Promise<void>;
  startSwarmRun: (swarmId: string, input: string) => Promise<string>;
  sendSwarmMessage: (swarmRunId: string, message: Omit<SwarmMessage, 'id' | 'timestamp'>) => Promise<void>;
  fetchSwarmMessages: (swarmRunId: string) => Promise<void>;
  
  // Workflow Management
  fetchWorkflows: (agentId: string) => Promise<void>;
  createWorkflow: (agentId: string, workflow: Omit<AgentWorkflow, 'id'>) => Promise<void>;
  updateWorkflow: (agentId: string, workflowId: string, updates: Partial<AgentWorkflow>) => Promise<void>;
  deleteWorkflow: (agentId: string, workflowId: string) => Promise<void>;
  executeWorkflow: (agentId: string, workflowId: string, input: Record<string, unknown>) => Promise<string>;
  pauseWorkflow: (runId: string) => Promise<void>;
  resumeWorkflow: (runId: string) => Promise<void>;
  
  // Template Management
  fetchTemplates: () => void; // Sync - uses predefined
  createTemplate: (template: Omit<AgentTemplate, 'id'>) => Promise<AgentTemplate>;
  deleteTemplate: (templateId: string) => Promise<void>;
  applyTemplate: (templateId: string, overrides?: Partial<Agent>) => Promise<Agent>;
  duplicateTemplate: (templateId: string, newName: string) => Promise<AgentTemplate>;
  
  // Advanced Configuration
  fetchAdvancedConfig: (agentId: string) => Promise<void>;
  updateAdvancedConfig: (agentId: string, config: Partial<AdvancedAgentConfig>) => Promise<void>;
  updateLoopControl: (agentId: string, config: Partial<LoopControlConfig>) => Promise<void>;
  updateCallOptions: (agentId: string, options: Partial<AgentCallOptions>) => Promise<void>;
  updateToolConfigs: (agentId: string, toolConfigs: Record<string, Partial<AgentToolConfig>>) => Promise<void>;
  updateMemoryConfig: (agentId: string, config: Partial<AgentMemoryConfig>) => Promise<void>;
  updateCostControl: (agentId: string, config: Partial<CostControlConfig>) => Promise<void>;
  updateSafetyConfig: (agentId: string, config: Partial<SafetyConfig>) => Promise<void>;
  updateObservability: (agentId: string, config: Partial<ObservabilityConfig>) => Promise<void>;
  addRelationship: (agentId: string, relationship: AgentRelationship) => Promise<void>;
  removeRelationship: (agentId: string, relatedAgentId: string) => Promise<void>;
  
  // UI Actions
  setShowAdvancedConfig: (show: boolean) => void;
  setActiveConfigTab: (tab: AdvancedAgentState['activeConfigTab']) => void;
  setSelectedTemplate: (templateId: string | null) => void;
  setActiveCallOptions: (options: AgentCallOptions | null) => void;
  
  // Swarm Event Handling
  handleSwarmEvent: (event: { swarmRunId: string; type: string; data: unknown }) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useAdvancedAgentStore = create<AdvancedAgentState & AdvancedAgentActions>()(
  devtools(
    (set, get) => ({
      // Initial State
      advancedConfigs: {},
      subagents: {},
      swarms: [],
      activeSwarmId: null,
      swarmRuns: {},
      swarmMessages: {},
      workflows: {},
      workflowExecutions: {},
      templates: PREDEFINED_AGENT_TEMPLATES,
      selectedTemplateId: null,
      activeCallOptions: null,
      showAdvancedConfig: false,
      activeConfigTab: 'subagents',
      isLoadingSwarms: false,
      isLoadingWorkflows: false,
      isCreatingSwarm: false,
      isExecutingWorkflow: false,

      // ----------------------------------------------------------------------
      // Subagent Management
      // ----------------------------------------------------------------------
      
      fetchSubagents: async (parentAgentId) => {
        try {
          const response = await fetch(`/api/v1/agents/${parentAgentId}/subagents`);
          if (!response.ok) throw new Error('Failed to fetch subagents');
          const data = await response.json();
          set(state => ({
            subagents: { ...state.subagents, [parentAgentId]: data.subagents }
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to fetch subagents:', err);
        }
      },

      createSubagent: async (parentAgentId, config) => {
        try {
          const response = await fetch(`/api/v1/agents/${parentAgentId}/subagents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
          });
          if (!response.ok) throw new Error('Failed to create subagent');
          const data = await response.json();
          set(state => ({
            subagents: {
              ...state.subagents,
              [parentAgentId]: [...(state.subagents[parentAgentId] || []), data.subagent]
            }
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to create subagent:', err);
          throw err;
        }
      },

      updateSubagent: async (parentAgentId, subagentId, updates) => {
        try {
          const response = await fetch(`/api/v1/agents/${parentAgentId}/subagents/${subagentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          if (!response.ok) throw new Error('Failed to update subagent');
          const data = await response.json();
          set(state => ({
            subagents: {
              ...state.subagents,
              [parentAgentId]: (state.subagents[parentAgentId] || []).map(s =>
                s.id === subagentId ? { ...s, ...data.subagent } : s
              )
            }
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to update subagent:', err);
          throw err;
        }
      },

      deleteSubagent: async (parentAgentId, subagentId) => {
        try {
          const response = await fetch(`/api/v1/agents/${parentAgentId}/subagents/${subagentId}`, {
            method: 'DELETE',
          });
          if (!response.ok) throw new Error('Failed to delete subagent');
          set(state => ({
            subagents: {
              ...state.subagents,
              [parentAgentId]: (state.subagents[parentAgentId] || []).filter(s => s.id !== subagentId)
            }
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to delete subagent:', err);
          throw err;
        }
      },

      spawnSubagent: async (parentAgentId, subagentId, input) => {
        try {
          const response = await fetch(`/api/v1/agents/${parentAgentId}/subagents/${subagentId}/spawn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input }),
          });
          if (!response.ok) throw new Error('Failed to spawn subagent');
          const data = await response.json();
          return data.runId;
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to spawn subagent:', err);
          throw err;
        }
      },

      // ----------------------------------------------------------------------
      // Swarm Management
      // ----------------------------------------------------------------------
      
      fetchSwarms: async () => {
        set({ isLoadingSwarms: true });
        try {
          const response = await fetch('/api/v1/swarms');
          if (!response.ok) throw new Error('Failed to fetch swarms');
          const data = await response.json();
          set({ swarms: data.swarms, isLoadingSwarms: false });
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to fetch swarms:', err);
          set({ isLoadingSwarms: false });
        }
      },

      createSwarm: async (swarm) => {
        set({ isCreatingSwarm: true });
        try {
          const response = await fetch('/api/v1/swarms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(swarm),
          });
          if (!response.ok) throw new Error('Failed to create swarm');
          const data = await response.json();
          set(state => ({
            swarms: [...state.swarms, data.swarm],
            isCreatingSwarm: false,
          }));
          return data.swarm;
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to create swarm:', err);
          set({ isCreatingSwarm: false });
          throw err;
        }
      },

      updateSwarm: async (swarmId, updates) => {
        try {
          const response = await fetch(`/api/v1/swarms/${swarmId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          if (!response.ok) throw new Error('Failed to update swarm');
          const data = await response.json();
          set(state => ({
            swarms: state.swarms.map(s => s.id === swarmId ? { ...s, ...data.swarm } : s),
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to update swarm:', err);
          throw err;
        }
      },

      deleteSwarm: async (swarmId) => {
        try {
          const response = await fetch(`/api/v1/swarms/${swarmId}`, {
            method: 'DELETE',
          });
          if (!response.ok) throw new Error('Failed to delete swarm');
          set(state => ({
            swarms: state.swarms.filter(s => s.id !== swarmId),
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to delete swarm:', err);
          throw err;
        }
      },

      joinSwarm: async (swarmId, agentId, role) => {
        try {
          const response = await fetch(`/api/v1/swarms/${swarmId}/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, role }),
          });
          if (!response.ok) throw new Error('Failed to join swarm');
          const data = await response.json();
          set(state => ({
            swarms: state.swarms.map(s => s.id === swarmId ? data.swarm : s),
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to join swarm:', err);
          throw err;
        }
      },

      leaveSwarm: async (swarmId, agentId) => {
        try {
          const response = await fetch(`/api/v1/swarms/${swarmId}/agents/${agentId}`, {
            method: 'DELETE',
          });
          if (!response.ok) throw new Error('Failed to leave swarm');
          const data = await response.json();
          set(state => ({
            swarms: state.swarms.map(s => s.id === swarmId ? data.swarm : s),
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to leave swarm:', err);
          throw err;
        }
      },

      startSwarmRun: async (swarmId, input) => {
        try {
          const response = await fetch(`/api/v1/swarms/${swarmId}/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input }),
          });
          if (!response.ok) throw new Error('Failed to start swarm run');
          const data = await response.json();
          set(state => ({
            swarmRuns: {
              ...state.swarmRuns,
              [swarmId]: [...(state.swarmRuns[swarmId] || []), data.run],
            },
          }));
          return data.run.id;
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to start swarm run:', err);
          throw err;
        }
      },

      sendSwarmMessage: async (swarmRunId, message) => {
        try {
          const response = await fetch(`/api/v1/swarms/runs/${swarmRunId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message),
          });
          if (!response.ok) throw new Error('Failed to send message');
          const data = await response.json();
          set(state => ({
            swarmMessages: {
              ...state.swarmMessages,
              [swarmRunId]: [...(state.swarmMessages[swarmRunId] || []), data.message],
            },
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to send message:', err);
          throw err;
        }
      },

      fetchSwarmMessages: async (swarmRunId) => {
        try {
          const response = await fetch(`/api/v1/swarms/runs/${swarmRunId}/messages`);
          if (!response.ok) throw new Error('Failed to fetch messages');
          const data = await response.json();
          set(state => ({
            swarmMessages: { ...state.swarmMessages, [swarmRunId]: data.messages },
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to fetch messages:', err);
        }
      },

      // ----------------------------------------------------------------------
      // Workflow Management
      // ----------------------------------------------------------------------
      
      fetchWorkflows: async (agentId) => {
        set({ isLoadingWorkflows: true });
        try {
          const response = await fetch(`/api/v1/agents/${agentId}/workflows`);
          if (!response.ok) throw new Error('Failed to fetch workflows');
          const data = await response.json();
          set(state => ({
            workflows: { ...state.workflows, [agentId]: data.workflows },
            isLoadingWorkflows: false,
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to fetch workflows:', err);
          set({ isLoadingWorkflows: false });
        }
      },

      createWorkflow: async (agentId, workflow) => {
        try {
          const response = await fetch(`/api/v1/agents/${agentId}/workflows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(workflow),
          });
          if (!response.ok) throw new Error('Failed to create workflow');
          const data = await response.json();
          set(state => ({
            workflows: {
              ...state.workflows,
              [agentId]: [...(state.workflows[agentId] || []), data.workflow],
            },
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to create workflow:', err);
          throw err;
        }
      },

      updateWorkflow: async (agentId, workflowId, updates) => {
        try {
          const response = await fetch(`/api/v1/agents/${agentId}/workflows/${workflowId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          if (!response.ok) throw new Error('Failed to update workflow');
          const data = await response.json();
          set(state => ({
            workflows: {
              ...state.workflows,
              [agentId]: (state.workflows[agentId] || []).map(w =>
                w.id === workflowId ? { ...w, ...data.workflow } : w
              ),
            },
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to update workflow:', err);
          throw err;
        }
      },

      deleteWorkflow: async (agentId, workflowId) => {
        try {
          const response = await fetch(`/api/v1/agents/${agentId}/workflows/${workflowId}`, {
            method: 'DELETE',
          });
          if (!response.ok) throw new Error('Failed to delete workflow');
          set(state => ({
            workflows: {
              ...state.workflows,
              [agentId]: (state.workflows[agentId] || []).filter(w => w.id !== workflowId),
            },
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to delete workflow:', err);
          throw err;
        }
      },

      executeWorkflow: async (agentId, workflowId, input) => {
        set({ isExecutingWorkflow: true });
        try {
          const response = await fetch(`/api/v1/agents/${agentId}/workflows/${workflowId}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input }),
          });
          if (!response.ok) throw new Error('Failed to execute workflow');
          const data = await response.json();
          set(state => ({
            workflowExecutions: {
              ...state.workflowExecutions,
              [data.runId]: data.executionState,
            },
            isExecutingWorkflow: false,
          }));
          return data.runId;
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to execute workflow:', err);
          set({ isExecutingWorkflow: false });
          throw err;
        }
      },

      pauseWorkflow: async (runId) => {
        try {
          await fetch(`/api/v1/workflows/runs/${runId}/pause`, { method: 'POST' });
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to pause workflow:', err);
        }
      },

      resumeWorkflow: async (runId) => {
        try {
          await fetch(`/api/v1/workflows/runs/${runId}/resume`, { method: 'POST' });
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to resume workflow:', err);
        }
      },

      // ----------------------------------------------------------------------
      // Template Management
      // ----------------------------------------------------------------------
      
      fetchTemplates: () => {
        // Templates are predefined, but we could fetch custom ones from API
        // For now, just use the predefined ones
      },

      createTemplate: async (template) => {
        try {
          const response = await fetch('/api/v1/agent-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(template),
          });
          if (!response.ok) throw new Error('Failed to create template');
          const data = await response.json();
          set(state => ({
            templates: [...state.templates, data.template],
          }));
          return data.template;
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to create template:', err);
          throw err;
        }
      },

      deleteTemplate: async (templateId) => {
        try {
          await fetch(`/api/v1/agent-templates/${templateId}`, { method: 'DELETE' });
          set(state => ({
            templates: state.templates.filter(t => t.id !== templateId),
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to delete template:', err);
          throw err;
        }
      },

      applyTemplate: async (templateId, overrides) => {
        const template = get().templates.find(t => t.id === templateId);
        if (!template) throw new Error('Template not found');
        
        try {
          const response = await fetch('/api/v1/agents/from-template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateId, overrides }),
          });
          if (!response.ok) throw new Error('Failed to apply template');
          const data = await response.json();
          return data.agent;
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to apply template:', err);
          throw err;
        }
      },

      duplicateTemplate: async (templateId, newName) => {
        const template = get().templates.find(t => t.id === templateId);
        if (!template) throw new Error('Template not found');
        
        const { id, ...templateWithoutId } = template;
        return get().createTemplate({
          ...templateWithoutId,
          name: newName,
        });
      },

      // ----------------------------------------------------------------------
      // Advanced Configuration
      // ----------------------------------------------------------------------
      
      fetchAdvancedConfig: async (agentId) => {
        try {
          const response = await fetch(`/api/v1/agents/${agentId}/config`);
          if (!response.ok) throw new Error('Failed to fetch config');
          const data = await response.json();
          set(state => ({
            advancedConfigs: { ...state.advancedConfigs, [agentId]: data.config },
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to fetch config:', err);
        }
      },

      updateAdvancedConfig: async (agentId, config) => {
        try {
          const response = await fetch(`/api/v1/agents/${agentId}/config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
          });
          if (!response.ok) throw new Error('Failed to update config');
          const data = await response.json();
          set(state => ({
            advancedConfigs: { ...state.advancedConfigs, [agentId]: data.config },
          }));
        } catch (err) {
          console.error('[AdvancedAgentStore] Failed to update config:', err);
          throw err;
        }
      },

      updateLoopControl: async (agentId, config) => {
        const current = get().advancedConfigs[agentId]?.loopControl;
        await get().updateAdvancedConfig(agentId, {
          loopControl: { ...current, ...config },
        });
      },

      updateCallOptions: async (agentId, options) => {
        const current = get().advancedConfigs[agentId]?.defaultCallOptions;
        await get().updateAdvancedConfig(agentId, {
          defaultCallOptions: { ...current, ...options },
        });
      },

      updateToolConfigs: async (agentId, toolConfigs) => {
        const current = get().advancedConfigs[agentId]?.toolConfigs || {};
        const merged: Record<string, AgentToolConfig> = { ...current };
        Object.entries(toolConfigs).forEach(([key, value]) => {
          if (current[key]) {
            merged[key] = { ...current[key], ...value } as AgentToolConfig;
          }
        });
        await get().updateAdvancedConfig(agentId, {
          toolConfigs: merged,
        });
      },

      updateMemoryConfig: async (agentId, config) => {
        const current = get().advancedConfigs[agentId]?.memory;
        await get().updateAdvancedConfig(agentId, {
          memory: { ...current, ...config },
        });
      },

      updateCostControl: async (agentId, config) => {
        const current = get().advancedConfigs[agentId]?.costControl;
        await get().updateAdvancedConfig(agentId, {
          costControl: { ...current, ...config },
        });
      },

      updateSafetyConfig: async (agentId, config) => {
        const current = get().advancedConfigs[agentId]?.safety;
        await get().updateAdvancedConfig(agentId, {
          safety: { ...current, ...config },
        });
      },

      updateObservability: async (agentId, config) => {
        const current = get().advancedConfigs[agentId]?.observability;
        await get().updateAdvancedConfig(agentId, {
          observability: { ...current, ...config },
        });
      },

      addRelationship: async (agentId, relationship) => {
        const current = get().advancedConfigs[agentId]?.relationships || [];
        await get().updateAdvancedConfig(agentId, {
          relationships: [...current, relationship],
        });
      },

      removeRelationship: async (agentId, relatedAgentId) => {
        const current = get().advancedConfigs[agentId]?.relationships || [];
        await get().updateAdvancedConfig(agentId, {
          relationships: current.filter(r => r.agentId !== relatedAgentId),
        });
      },

      // ----------------------------------------------------------------------
      // UI Actions
      // ----------------------------------------------------------------------
      
      setShowAdvancedConfig: (show) => set({ showAdvancedConfig: show }),
      setActiveConfigTab: (tab) => set({ activeConfigTab: tab }),
      setSelectedTemplate: (templateId) => set({ selectedTemplateId: templateId }),
      setActiveCallOptions: (options) => set({ activeCallOptions: options }),

      // ----------------------------------------------------------------------
      // Event Handling
      // ----------------------------------------------------------------------
      
      handleSwarmEvent: (event) => {
        const { swarmRunId, type, data } = event;
        
        switch (type) {
          case 'message':
            set(state => ({
              swarmMessages: {
                ...state.swarmMessages,
                [swarmRunId]: [...(state.swarmMessages[swarmRunId] || []), data as SwarmMessage],
              },
            }));
            break;
            
          case 'status':
            // Update swarm run status
            set(state => {
              const swarmId = Object.keys(state.swarmRuns).find(
                sid => state.swarmRuns[sid].some(r => r.id === swarmRunId)
              );
              if (!swarmId) return state;
              
              return {
                swarmRuns: {
                  ...state.swarmRuns,
                  [swarmId]: state.swarmRuns[swarmId].map(r =>
                    r.id === swarmRunId ? { ...r, ...(data as Partial<SwarmRun>) } : r
                  ),
                },
              };
            });
            break;
        }
      },
    }),
    { name: 'advanced-agent-store' }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export function useAgentSubagents(agentId: string | null): SubagentConfig[] {
  const { subagents } = useAdvancedAgentStore();
  return agentId ? subagents[agentId] || [] : [];
}

export function useAgentWorkflows(agentId: string | null): AgentWorkflow[] {
  const { workflows } = useAdvancedAgentStore();
  return agentId ? workflows[agentId] || [] : [];
}

export function useSelectedTemplate(): AgentTemplate | null {
  const { templates, selectedTemplateId } = useAdvancedAgentStore();
  return templates.find(t => t.id === selectedTemplateId) || null;
}

export function useSwarmMessages(swarmRunId: string | null): SwarmMessage[] {
  const { swarmMessages } = useAdvancedAgentStore();
  return swarmRunId ? swarmMessages[swarmRunId] || [] : [];
}
