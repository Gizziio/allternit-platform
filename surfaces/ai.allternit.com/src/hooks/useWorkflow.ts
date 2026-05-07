"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  WorkflowDesignerEngine, 
  createWorkflowEngine,
  validateWorkflow,
  autoLayoutNodes,
} from '@/services/workflowEngine';
import { 
  WorkflowListEntry,
  WorkflowExecution,
  WorkflowDraft,
  DesignerNode,
  DesignerEdge,
  ValidationResult,
  NodePosition,
  ExecutableWorkflow,
  WorkflowPhase,
  ExecutionStatus,
} from '@/types/workflow';

// Re-export types
export type { 
  WorkflowListEntry as Workflow, 
  WorkflowExecution,
  ValidationResult,
  NodePosition,
};

interface UseWorkflowReturn {
  // Data
  workflows: WorkflowListEntry[];
  executions: WorkflowExecution[];
  
  // Loading state
  isLoading: boolean;
  error: Error | null;
  
  // Actions
  refetch: () => Promise<void>;
  createWorkflow: (workflow: Omit<WorkflowListEntry, 'workflow_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  executeWorkflow: (id: string) => Promise<string>;
  stopExecution: (id: string) => Promise<void>;
  
  // Design operations (using WorkflowEngine)
  validateDesign: (nodes: DesignerNode[], edges: DesignerEdge[]) => ValidationResult;
  autoLayout: (nodes: DesignerNode[], edges: DesignerEdge[]) => Map<string, NodePosition>;
  compileWorkflow: (draft: WorkflowDraft) => ExecutableWorkflow;
  wouldCreateCycle: (from: string, to: string, edges: DesignerEdge[]) => boolean;
}

interface BackendWorkflowSummary {
  id: string;
  name: string;
  version: string;
  description?: string | null;
  node_count: number;
  created_at: string;
  updated_at: string;
  status: string;
}

interface BackendWorkflowListResponse {
  workflows: BackendWorkflowSummary[];
  total: number;
}

interface BackendExecutionResponse {
  execution_id: string;
  workflow_id: string;
  status: string;
  start_time: string;
}

function normalizeWorkflowStatus(status: string | undefined): WorkflowListEntry['status'] {
  switch ((status || '').toLowerCase()) {
    case 'active':
    case 'running':
      return 'active';
    case 'archived':
    case 'deprecated':
      return 'archived';
    default:
      return 'draft';
  }
}

function normalizeWorkflowPhase(status: string | undefined): WorkflowPhase {
  switch (normalizeWorkflowStatus(status)) {
    case 'active':
      return WorkflowPhase.Active;
    case 'archived':
      return WorkflowPhase.Archived;
    default:
      return WorkflowPhase.Draft;
  }
}

function normalizeExecutionStatus(status: string | undefined): ExecutionStatus {
  switch ((status || '').toLowerCase()) {
    case 'running':
      return ExecutionStatus.Running;
    case 'succeeded':
    case 'completed':
      return ExecutionStatus.Completed;
    case 'failed':
      return ExecutionStatus.Failed;
    case 'cancelled':
      return ExecutionStatus.Cancelled;
    default:
      return ExecutionStatus.Pending;
  }
}

function normalizeWorkflow(workflow: BackendWorkflowSummary): WorkflowListEntry {
  const status = normalizeWorkflowStatus(workflow.status);

  return {
    workflow_id: workflow.id,
    id: workflow.id,
    name: workflow.name,
    description: workflow.description ?? '',
    version: workflow.version,
    phase: normalizeWorkflowPhase(workflow.status),
    status,
    created_at: workflow.created_at,
    updated_at: workflow.updated_at,
    execution_count: 0,
    node_count: workflow.node_count,
    tags: [],
    is_template: false,
  };
}

export function useWorkflow(): UseWorkflowReturn {
  const [workflows, setWorkflows] = useState<WorkflowListEntry[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Create engine instance
  const engine = useMemo(() => createWorkflowEngine(), []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const workflowsRes = await fetch('/api/v1/workflows');
      if (!workflowsRes.ok) throw new Error('Failed to fetch workflows');
      const workflowsData = await workflowsRes.json() as BackendWorkflowListResponse;
      setWorkflows((workflowsData.workflows || []).map(normalizeWorkflow));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createWorkflow = async (workflow: Omit<WorkflowListEntry, 'workflow_id' | 'created_at' | 'updated_at'>) => {
    const res = await fetch('/api/v1/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: workflow.name,
        version: workflow.version,
        description: workflow.description,
        nodes: [],
        connections: [],
        tags: workflow.tags,
      }),
    });
    if (!res.ok) throw new Error('Failed to create workflow');
    await fetchData();
  };

  const deleteWorkflow = async (id: string) => {
    const res = await fetch(`/api/v1/workflows/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete workflow');
    setWorkflows(prev => prev.filter(w => w.workflow_id !== id));
  };

  const executeWorkflow = async (id: string): Promise<string> => {
    const res = await fetch(`/api/v1/workflows/${id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Failed to execute workflow');
    const result = await res.json() as BackendExecutionResponse;
    setExecutions(prev => [...prev, {
      execution_id: result.execution_id,
      workflow_id: id,
      workflow_name: workflows.find(w => w.workflow_id === id)?.name || '',
      status: normalizeExecutionStatus(result.status),
      started_at: result.start_time,
      triggered_by: 'user',
      node_executions: [],
      logs: [],
    }]);
    return result.execution_id;
  };

  const stopExecution = async (id: string) => {
    const execution = executions.find((entry) => entry.execution_id === id);
    if (!execution) {
      throw new Error('Execution not found');
    }

    const res = await fetch(`/api/v1/workflows/${execution.workflow_id}/executions/${id}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to stop execution');
    setExecutions(prev => prev.map(e => 
      e.execution_id === id ? { 
        ...e, 
        status: ExecutionStatus.Cancelled,
        finished_at: new Date().toISOString(),
      } : e
    ));
  };

  // Design operations using the engine
  const validateDesign = useCallback((nodes: DesignerNode[], edges: DesignerEdge[]): ValidationResult => {
    return engine.validateWorkflow(nodes, edges);
  }, [engine]);

  const autoLayout = useCallback((nodes: DesignerNode[], edges: DesignerEdge[]): Map<string, NodePosition> => {
    return engine.autoLayout(nodes, edges);
  }, [engine]);

  const compileWorkflow = useCallback((draft: WorkflowDraft): ExecutableWorkflow => {
    return engine.compileToExecutable(draft);
  }, [engine]);

  const wouldCreateCycle = useCallback((from: string, to: string, edges: DesignerEdge[]): boolean => {
    return engine.wouldCreateCycle(from, to, edges);
  }, [engine]);

  return {
    workflows,
    executions,
    isLoading,
    error,
    refetch: fetchData,
    createWorkflow,
    deleteWorkflow,
    executeWorkflow,
    stopExecution,
    validateDesign,
    autoLayout,
    compileWorkflow,
    wouldCreateCycle,
  };
}

// Export utility functions
export { validateWorkflow, autoLayoutNodes };
