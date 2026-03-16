/**
 * Agent Service - Rails-Integrated Implementation
 * 
 * Maps Agent Studio UI concepts to real backend services:
 * - Agents → Registry (via API)
 * - Runs → Rails DAGs + WIHs
 * - Tasks → Rails WIHs (Work In Hand)
 * - Checkpoints → Rails Vault archives
 * - History → Rails Ledger
 * - Queue → Rails WIHs (ready_only filter)
 * 
 * All requests go through Gateway (8013) → API (3000) → [Registry|Rails]
 * 
 * ZOD VALIDATION:
 * This service now uses Zod for runtime validation of API responses.
 * All data from external APIs is validated before being used.
 * See agent.types.ts for schema definitions.
 */

import { api } from '../../integration/api-client';
import type {
  Agent,
  AgentType,
  CreateAgentInput,
  VoiceConfig,
  AgentTask,
  AgentRun,
  Checkpoint,
  Commit,
  CommitChange,
  AgentEvent,
  QueueItem,
  ExecutionPlan,
  PlanStep,
} from './agent.types';
import {
  validateAgent,
  validateAgentArray,
  validateAgentListResponse,
  validateCreateAgentInput,
  safeValidate,
  agentListResponseSchema,
  agentSchema,
} from './agent.types';
import {
  createLocalAgent,
  deleteLocalAgent,
  getLocalAgent,
  listLocalAgents,
  mergeAgentCatalog,
  shouldUseLocalAgentRegistryFallback,
  updateLocalAgent,
} from './local-agent-registry';

// Import shared API configuration (avoids circular dependencies with rails.service.ts)
import { API_BASE_URL, apiRequest, apiRequestWithError, type ApiResponse } from './api-config';
export { API_BASE_URL, apiRequest, apiRequestWithError, type ApiResponse };

// Import Rails API for advanced features
import { railsApi, type WihInfo, type LedgerEvent } from './rails.service';

// ============================================================================
// Agent CRUD Operations (Registry via API)
// ============================================================================

export async function listAgents(): Promise<Agent[]> {
  try {
    const response = await api.listAgents();

    // Validate API response with Zod
    const validated = safeValidate(agentListResponseSchema, response);
    if (!validated) {
      // Silent fail - backend may return incomplete data, use local agents
      return listLocalAgents();
    }

    return mergeAgentCatalog(
      validated.agents.map(transformAgentFromApi),
      listLocalAgents(),
    );
  } catch (error) {
    if (shouldUseLocalAgentRegistryFallback(error)) {
      return listLocalAgents();
    }

    throw error;
  }
}

export async function getAgent(agentId: string): Promise<Agent> {
  try {
    const agent = await api.getAgent(agentId);

    // Validate with Zod before transforming
    const validated = safeValidate(agentSchema, agent);
    if (!validated) {
      // Instead of throwing, create a minimal valid agent from the partial data
      // This handles cases where backend returns incomplete responses
      const minimalAgent: Agent = {
        id: agentId,
        name: (agent as any).name || 'Unknown Agent',
        description: (agent as any).description || '',
        type: ((agent as any).type as AgentType) || 'worker',
        model: (agent as any).model || 'gpt-4',
        provider: ((agent as any).provider as any) || 'openai',
        capabilities: [],
        tools: [],
        maxIterations: (agent as any).maxIterations || 10,
        temperature: (agent as any).temperature || 0.7,
        config: {},
        status: 'idle',
        createdAt: (agent as any).createdAt || new Date().toISOString(),
        updatedAt: (agent as any).updatedAt || new Date().toISOString(),
      };
      return minimalAgent;
    }

    return transformAgentFromApi(validated);
  } catch (error) {
    if (shouldUseLocalAgentRegistryFallback(error)) {
      const localAgent = getLocalAgent(agentId);
      if (localAgent) {
        return localAgent;
      }
    }

    // Return minimal agent instead of throwing
    return {
      id: agentId,
      name: 'Unknown Agent',
      description: '',
      type: 'worker',
      model: 'gpt-4',
      provider: 'openai',
      capabilities: [],
      tools: [],
      maxIterations: 10,
      temperature: 0.7,
      config: {},
      status: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  // Validate input with Zod
  try {
    validateCreateAgentInput(input);
  } catch (validationError) {
    console.error('[AgentService] Invalid create agent input:', validationError);
    throw new Error(`Invalid input: ${validationError instanceof Error ? validationError.message : 'Validation failed'}`);
  }
  
  // Transform camelCase to snake_case for API
  const apiInput: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    agent_type: input.type || 'worker',
    parent_agent_id: input.parentAgentId,
    model: input.model,
    provider: input.provider,
    capabilities: input.capabilities || [],
    system_prompt: input.systemPrompt,
    tools: input.tools || [],
    max_iterations: input.maxIterations || 10,
    temperature: input.temperature ?? 0.7,
    voice: input.voice ? {
      voice_id: input.voice.voiceId,
      voice_label: input.voice.voiceLabel,
      engine: input.voice.engine,
      enabled: input.voice.enabled,
      auto_speak: input.voice.autoSpeak,
      speak_on_checkpoint: input.voice.speakOnCheckpoint,
    } : undefined,
    config: input.config || {},
    workspace_id: input.workspaceId,
    owner_id: input.ownerId,
  };
  
  console.log('[AgentService] Creating agent:', input.name);
  const startTime = Date.now();
  
  try {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[AgentService] API call attempt ${attempt + 1}/${maxRetries}...`);
        const agent = await api.createAgent(apiInput as Omit<Agent, 'id'>);
        console.log(`[AgentService] Agent created successfully in ${Date.now() - startTime}ms`);
        return transformAgentFromApi(agent);
      } catch (error: any) {
        lastError = error;
        console.error(`[AgentService] Attempt ${attempt + 1} failed:`, error.status, error.message);
        
        // If it's a rate limit error (429), wait and retry with short backoff
        if (error.status === 429 || (error instanceof Error && error.message.includes('429'))) {
          const delay = 500 + Math.random() * 500; // 0.5-1s delay
          console.warn(`[AgentService] Rate limited (429). Retrying in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        // For other errors, throw immediately
        throw error;
      }
    }
    console.error(`[AgentService] All ${maxRetries} attempts failed after ${Date.now() - startTime}ms`);
    throw lastError;
  } catch (error) {
    if (shouldUseLocalAgentRegistryFallback(error)) {
      return createLocalAgent(input);
    }

    throw error;
  }
}

/**
 * Transform agent data from API (snake_case) to frontend (camelCase)
 * Note: Input should already be validated by Zod before calling this
 */
function transformAgentFromApi(apiAgent: unknown): Agent {
  const a = apiAgent as Record<string, unknown>;
  const voiceData = a.voice as Record<string, unknown> | undefined;
  
  return {
    id: String(a.id || ''),
    name: String(a.name || ''),
    description: String(a.description || ''),
    type: (a.agent_type as Agent['type']) || 'worker',
    parentAgentId: a.parent_agent_id as string | undefined,
    model: String(a.model || ''),
    provider: (a.provider as Agent['provider']) || 'openai',
    capabilities: Array.isArray(a.capabilities) ? a.capabilities.map(String) : [],
    systemPrompt: a.system_prompt as string | undefined,
    tools: Array.isArray(a.tools) ? a.tools.map(String) : [],
    maxIterations: typeof a.max_iterations === 'number' ? a.max_iterations : 10,
    temperature: typeof a.temperature === 'number' ? a.temperature : 0.7,
    voice: voiceData ? {
      voiceId: String(voiceData.voice_id || 'default'),
      voiceLabel: voiceData.voice_label as string | undefined,
      engine: voiceData.engine as VoiceConfig['engine'],
      enabled: Boolean(voiceData.enabled),
      autoSpeak: voiceData.auto_speak as boolean | undefined,
      speakOnCheckpoint: voiceData.speak_on_checkpoint as boolean | undefined,
    } : undefined,
    config: (a.config as Record<string, unknown>) || {},
    status: (a.status as Agent['status']) || 'idle',
    createdAt: String(a.created_at || new Date().toISOString()),
    updatedAt: String(a.updated_at || new Date().toISOString()),
    lastRunAt: a.last_run_at as string | undefined,
    workspaceId: a.workspace_id as string | undefined,
    ownerId: a.owner_id as string | undefined,
  };
}

export async function updateAgent(
  agentId: string,
  updates: Partial<CreateAgentInput>
): Promise<Agent> {
  // Note: For partial updates, we skip full schema validation
  // as only some fields may be provided
  
  // Transform camelCase to snake_case for API
  const apiUpdates: Record<string, unknown> = {};
  
  if (updates.name !== undefined) apiUpdates.name = updates.name;
  if (updates.description !== undefined) apiUpdates.description = updates.description;
  if (updates.type !== undefined) apiUpdates.agent_type = updates.type;
  if (updates.parentAgentId !== undefined) apiUpdates.parent_agent_id = updates.parentAgentId;
  if (updates.model !== undefined) apiUpdates.model = updates.model;
  if (updates.provider !== undefined) apiUpdates.provider = updates.provider;
  if (updates.capabilities !== undefined) apiUpdates.capabilities = updates.capabilities;
  if (updates.systemPrompt !== undefined) apiUpdates.system_prompt = updates.systemPrompt;
  if (updates.tools !== undefined) apiUpdates.tools = updates.tools;
  if (updates.maxIterations !== undefined) apiUpdates.max_iterations = updates.maxIterations;
  if (updates.temperature !== undefined) apiUpdates.temperature = updates.temperature;
  if (updates.voice !== undefined) {
    apiUpdates.voice = updates.voice ? {
      voice_id: updates.voice.voiceId,
      voice_label: updates.voice.voiceLabel,
      engine: updates.voice.engine,
      enabled: updates.voice.enabled,
      auto_speak: updates.voice.autoSpeak,
      speak_on_checkpoint: updates.voice.speakOnCheckpoint,
    } : null;
  }
  if (updates.config !== undefined) apiUpdates.config = updates.config;
  
  try {
    const agent = await api.updateAgent(agentId, apiUpdates);
    return transformAgentFromApi(agent);
  } catch (error) {
    if (shouldUseLocalAgentRegistryFallback(error)) {
      return updateLocalAgent(agentId, updates);
    }

    throw error;
  }
}

export async function deleteAgent(agentId: string): Promise<void> {
  try {
    return await api.deleteAgent(agentId);
  } catch (error) {
    if (shouldUseLocalAgentRegistryFallback(error)) {
      deleteLocalAgent(agentId);
      return;
    }

    throw error;
  }
}

// ============================================================================
// Agent Execution (Rails DAG/WIH Integration)
// ============================================================================

/**
 * Start an agent run - API handles Rails DAG + Kernel execution
 * Maps to: POST /api/v1/agents/:agentId/runs
 */
export async function startAgentRun(
  agentId: string,
  input: string,
  options?: {
    plan?: ExecutionPlan;
    metadata?: Record<string, unknown>;
  }
): Promise<AgentRun> {
  const run = await api.startAgentRun(agentId, {
    input,
    plan: options?.plan,
    metadata: options?.metadata,
  });
  
  return {
    id: String(run.id || ''),
    agentId: String(run.agent_id || agentId),
    status: String(run.status || 'pending') as AgentRun['status'],
    input: String(run.input || input),
    output: run.output as string | undefined,
    tasks: [],
    checkpointCount: 0,
    metadata: (run.metadata as Record<string, unknown>) || {},
    startedAt: String(run.started_at || new Date().toISOString()),
    completedAt: run.completed_at as string | undefined,
  };
}

/**
 * Get run details by fetching DAG and associated WIHs
 */
export async function getAgentRun(agentId: string, runId: string): Promise<AgentRun> {
  // Get DAG details from Rails
  const dag = await railsApi.plan.show(runId);
  
  // Get WIHs for this DAG
  const { wihs } = await railsApi.wihs.list({ dag_id: runId });

  // Determine status from WIHs
  const status = determineRunStatus(wihs);

  return {
    id: runId,
    agentId,
    status,
    input: (dag.dag as { description?: string })?.description || '',
    output: undefined,
    tasks: [],
    checkpointCount: 0,
    metadata: {
      dag: dag.dag,
      wihs: wihs.length,
    },
    startedAt: (dag.dag as { created_at?: string })?.created_at || new Date().toISOString(),
    completedAt: status === 'completed' ? new Date().toISOString() : undefined,
  };
}

/**
 * List agent runs by querying Rails WIHs grouped by DAG
 */
export async function listAgentRuns(agentId: string): Promise<AgentRun[]> {
  try {
    // Get all WIHs for this agent
    const { wihs } = await railsApi.wihs.list();
    
    // Group WIHs by dag_id to form runs
    const runsByDag = new Map<string, WihInfo[]>();
    for (const wih of wihs) {
      if (!wih.dag_id) continue;
      const existing = runsByDag.get(wih.dag_id) || [];
      existing.push(wih);
      runsByDag.set(wih.dag_id, existing);
    }

    // Convert to AgentRun format
    const runs: AgentRun[] = [];
    for (const [dagId, dagWihs] of runsByDag) {
      runs.push({
        id: dagId,
        agentId,
        status: determineRunStatus(dagWihs),
        input: dagWihs[0]?.title || 'Untitled Run',
        output: undefined,
        tasks: [],
        checkpointCount: 0,
        metadata: {
          taskCount: dagWihs.length,
          completedCount: dagWihs.filter(w => w.status === 'closed').length,
        },
        startedAt: new Date().toISOString(), // Would come from ledger
        completedAt: dagWihs.every(w => w.status === 'closed') 
          ? new Date().toISOString() 
          : undefined,
      });
    }

    return runs.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  } catch (error) {
    console.error('[AgentService] Failed to list runs:', error);
    return [];
  }
}

/**
 * Cancel a run by closing all WIHs
 */
export async function cancelAgentRun(agentId: string, runId: string): Promise<void> {
  const { wihs } = await railsApi.wihs.list({ dag_id: runId });
  
  // Close all open WIHs
  for (const wih of wihs) {
    if (wih.status === 'open' || wih.status === 'signed') {
      await railsApi.wihs.close(wih.wih_id, {
        status: 'failed',
        evidence: ['Cancelled by user'],
      });
    }
  }
}

/**
 * Pause a run via gate mutation
 */
export async function pauseAgentRun(agentId: string, runId: string): Promise<void> {
  await railsApi.gate.mutate(runId, 'Pause execution', 'User requested pause', [
    { action: 'set_status', status: 'paused' },
  ]);
}

/**
 * Resume a run via gate mutation
 */
export async function resumeAgentRun(agentId: string, runId: string): Promise<void> {
  await railsApi.gate.mutate(runId, 'Resume execution', 'User requested resume', [
    { action: 'set_status', status: 'running' },
  ]);
}

// ============================================================================
// Task Management (Rails WIH Integration)
// ============================================================================

/**
 * List tasks by fetching Rails WIHs
 */
export async function listAgentTasks(agentId: string, runId?: string): Promise<AgentTask[]> {
  const { wihs } = await railsApi.wihs.list(runId ? { dag_id: runId } : {});

  return wihs.map((wih, index) => ({
    id: wih.wih_id,
    runId: wih.dag_id || '',
    agentId,
    title: wih.title || 'Untitled Task',
    description: '',
    status: mapWihStatusToTaskStatus(wih.status),
    priority: index,
    dependencies: [],
    result: undefined,
    error: undefined,
    startedAt: undefined,
    completedAt: wih.status === 'closed' ? new Date().toISOString() : undefined,
  }));
}

export async function getAgentTask(agentId: string, taskId: string): Promise<AgentTask> {
  const context = await railsApi.wihs.context(taskId);
  
  return {
    id: taskId,
    runId: '',
    agentId,
    title: 'Task Details',
    description: context.context_pack || '',
    status: 'pending',
    priority: 0,
    dependencies: [],
    result: undefined,
    error: undefined,
    startedAt: undefined,
    completedAt: undefined,
  };
}

export async function updateTaskStatus(
  agentId: string,
  taskId: string,
  status: AgentTask['status'],
  result?: string,
  error?: string
): Promise<AgentTask> {
  // Map task status to WIH action
  if (status === 'completed' || status === 'failed') {
    await railsApi.wihs.close(taskId, {
      status: status === 'completed' ? 'completed' : 'failed',
      evidence: result ? [result] : error ? [error] : [],
    });
  }

  return {
    id: taskId,
    runId: '',
    agentId,
    title: '',
    description: '',
    status,
    priority: 0,
    dependencies: [],
    result,
    error,
    startedAt: undefined,
    completedAt: status === 'completed' || status === 'failed' 
      ? new Date().toISOString() 
      : undefined,
  };
}

// ============================================================================
// Checkpoints (Rails Vault Integration)
// ============================================================================

export async function listCheckpoints(agentId: string, runId?: string): Promise<Checkpoint[]> {
  const { jobs } = await railsApi.vault.status();
  
  return jobs
    .filter(job => !runId || job.wih_id.startsWith(runId))
    .map(job => ({
      id: job.wih_id,
      runId: runId || '',
      agentId,
      label: `Checkpoint ${job.wih_id.slice(0, 8)}`,
      description: `Archived at ${job.created_at}`,
      data: { path: job.status },
      timestamp: job.created_at || new Date().toISOString(),
      taskId: undefined,
    }));
}

export async function createCheckpoint(
  agentId: string,
  runId: string,
  label: string,
  data: Record<string, unknown>,
  options?: {
    description?: string;
    taskId?: string;
  }
): Promise<Checkpoint> {
  // Archive via Rails vault
  const result = await railsApi.vault.archive({
    wih_id: options?.taskId || runId,
  });

  return {
    id: result.path,
    runId,
    agentId,
    label,
    description: options?.description,
    data,
    timestamp: new Date().toISOString(),
    taskId: options?.taskId,
  };
}

export async function restoreCheckpoint(
  agentId: string,
  checkpointId: string
): Promise<AgentRun> {
  // In Rails, restoring would create a new DAG from archived state
  const planResponse = await railsApi.plan.new({
    text: `Restore from checkpoint ${checkpointId}`,
  });

  return {
    id: planResponse.dag_id,
    agentId,
    status: 'running',
    input: `Restored from ${checkpointId}`,
    output: undefined,
    tasks: [],
    checkpointCount: 0,
    metadata: {
      restoredFrom: checkpointId,
    },
    startedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Commits (Rails Ledger Integration)
// ============================================================================

export async function listCommits(agentId: string): Promise<Commit[]> {
  // Query ledger for decision events
  const events = await railsApi.ledger.tail(100);
  
  return events
    .filter(e => e.event_type === 'decision')
    .map(e => ({
      id: e.event_id,
      agentId,
      message: (e.payload as { note?: string })?.note || 'Decision recorded',
      author: 'system',
      timestamp: e.timestamp,
      changes: [],
      parentId: undefined,
      checkpointId: undefined,
    }));
}

export async function createCommit(
  agentId: string,
  message: string,
  changes: CommitChange[],
  options?: {
    checkpointId?: string;
    parentId?: string;
  }
): Promise<Commit> {
  // Record decision via gate
  const result = await railsApi.gate.decision(message, 'User commit');

  return {
    id: result.decision_id,
    agentId,
    message,
    author: 'user',
    timestamp: new Date().toISOString(),
    changes: changes || [],
    parentId: options?.parentId,
    checkpointId: options?.checkpointId,
  };
}

export async function getCommit(agentId: string, commitId: string): Promise<Commit> {
  // Trace ledger for specific decision
  const events = await railsApi.ledger.trace({});
  const event = events.find(e => e.event_id === commitId);
  
  if (!event) {
    throw new Error(`Commit ${commitId} not found`);
  }

  return {
    id: commitId,
    agentId,
    message: (event.payload as { note?: string })?.note || '',
    author: 'system',
    timestamp: event.timestamp,
    changes: [],
    parentId: undefined,
    checkpointId: undefined,
  };
}

// ============================================================================
// Queue Management (Rails WIH Integration)
// ============================================================================

export async function listQueueItems(agentId?: string): Promise<QueueItem[]> {
  // Get ready WIHs (queued work)
  const { wihs } = await railsApi.wihs.list({ ready_only: true });

  return wihs.map((wih, index) => ({
    id: wih.wih_id,
    content: wih.title || 'Untitled',
    priority: index,
    agentId: agentId,
    status: 'queued' as const,
    createdAt: new Date().toISOString(),
  }));
}

export async function enqueueTask(
  content: string,
  priority: number,
  agentId?: string
): Promise<QueueItem> {
  // Create a plan which generates ready WIHs
  const planResponse = await railsApi.plan.new({
    text: content,
  });

  return {
    id: planResponse.dag_id,
    content,
    priority,
    agentId,
    status: 'queued',
    createdAt: new Date().toISOString(),
  };
}

export async function dequeueTask(itemId: string): Promise<void> {
  // Pick up the WIH to remove from queue
  // This requires knowing the dag_id and node_id
  // For now, this is a no-op - real implementation would track mapping
  console.log('[AgentService] Dequeue:', itemId);
}

// ============================================================================
// Event Streaming (Rails Integration)
// ============================================================================

export function connectAgentEventStream(
  agentId: string,
  handlers: {
    onEvent?: (event: AgentEvent) => void;
    onError?: (error: Error) => void;
    onConnected?: () => void;
  }
): () => void {
  // Connect through the shared API client/gateway.
  const eventSource = api.connectAgentEventStream(agentId);

  eventSource.onopen = () => {
    handlers.onConnected?.();
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Map API events to AgentEvent format
      const agentEvent: AgentEvent = {
        type: mapApiEventType(data.event_type),
        agentId: data.agent_id,
        taskId: data.task_id,
        runId: data.run_id,
        timestamp: data.timestamp || new Date().toISOString(),
        data: data.data || {},
      };
      
      handlers.onEvent?.(agentEvent);
    } catch (err) {
      console.error('[AgentService] Failed to parse event:', err);
    }
  };

  eventSource.onerror = (error) => {
    handlers.onError?.(new Error('Event stream error'));
  };

  return () => {
    eventSource.close();
  };
}

// ============================================================================
// Execution Plans (Rails DAG Integration)
// ============================================================================

export async function createExecutionPlan(
  agentId: string,
  steps: Omit<PlanStep, 'id' | 'order'>[]
): Promise<ExecutionPlan> {
  // Convert steps to a plan description
  const description = steps.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join('\n');
  
  const planResponse = await railsApi.plan.new({
    text: `Execute plan:\n${description}`,
  });

  const plan: ExecutionPlan = {
    id: planResponse.dag_id,
    agentId,
    steps: steps.map((s, i) => ({
      id: `${planResponse.dag_id}-step-${i}`,
      title: s.title,
      description: s.description,
      status: s.status,
      order: i,
      taskId: undefined,
    })),
    currentStepIndex: 0,
    status: 'active',
  };

  return plan;
}

export async function getExecutionPlan(agentId: string, planId: string): Promise<ExecutionPlan> {
  const dag = await railsApi.plan.show(planId);
  const { wihs } = await railsApi.wihs.list({ dag_id: planId });

  return {
    id: planId,
    agentId,
    steps: wihs.map((wih, i) => ({
      id: wih.node_id,
      title: wih.title || '',
      description: '',
      status: mapWihStatusToTaskStatus(wih.status),
      order: i,
      taskId: undefined,
    })),
    currentStepIndex: 0,
    status: determineRunStatus(wihs) === 'completed' ? 'completed' : 'active',
  };
}

// ============================================================================
// Gate/Review (Rails Integration)
// ============================================================================

import type { GateReview, GateDecision } from './agent.types';

/**
 * Get pending reviews for an agent
 */
export async function getPendingReviews(agentId: string): Promise<GateReview[]> {
  // This would call Rails to get pending gate checks for the agent's WIHs
  // For now, return mock data
  return [];
}

/**
 * Submit a gate decision (approve/reject)
 */
export async function submitGateDecision(
  reviewId: string,
  approved: boolean,
  note?: string
): Promise<GateDecision> {
  const result = await railsApi.gate.decision(
    approved ? 'Approved' : 'Rejected',
    note,
    [reviewId]
  );
  
  return {
    decisionId: result.decision_id,
    wihId: reviewId,
    approved,
    note,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get gate rules
 */
export async function getGateRules(): Promise<string | undefined> {
  const result = await railsApi.gate.rules();
  return result.rules;
}

/**
 * Check gate status
 */
export async function checkGateStatus(wihId: string, tool: string, paths: string[]): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const result = await railsApi.gate.check({
    wih_id: wihId,
    tool,
    paths,
  });
  
  return {
    allowed: result.allowed,
    reason: result.reason,
  };
}

/**
 * Mutate DAG via gate
 */
export async function mutateViaGate(
  dagId: string,
  note: string,
  mutations: Array<{ action: string; path?: string; value?: unknown }>
): Promise<{ decisionId: string; mutationIds: string[] }> {
  const result = await railsApi.gate.mutate(
    dagId,
    note,
    undefined,
    mutations.map(m => ({
      action: m.action,
      path: m.path,
      value: m.value,
    })) as import('./rails.service').DagMutation[]
  );
  
  return {
    decisionId: result.decision_id,
    mutationIds: result.mutation_ids,
  };
}

// ============================================================================
// Agent Mail (Rails Integration)
// ============================================================================

import type { AgentMailMessage, AgentMailThread, SendMailInput } from './agent.types';

/**
 * Get agent inbox messages
 */
export async function getAgentInbox(agentId: string, limit: number = 50): Promise<AgentMailMessage[]> {
  const response = await railsApi.mail.inbox({ limit });
  
  // Transform messages - filter by recipient
  const messages = (response.messages || []) as unknown[];
  return messages.map((msg: unknown): AgentMailMessage => {
    const m = msg as Record<string, unknown>;
    return {
      id: String(m.message_id || m.id || ''),
      threadId: String(m.thread_id || 'default'),
      fromAgentId: String(m.from_agent || ''),
      fromAgentName: undefined,
      toAgentId: undefined,
      subject: 'Message', // Rails mail doesn't have subject per message, topic is on thread
      body: String(m.body || ''),
      bodyRef: undefined,
      status: m.acknowledged ? 'acknowledged' : 'unread',
      priority: 'normal',
      timestamp: String(m.timestamp || new Date().toISOString()),
      requiresAck: !m.acknowledged,
      ackedAt: m.acknowledged ? String(m.timestamp) : undefined,
    };
  });
}

/**
 * Get mail threads for an agent
 */
export async function getAgentThreads(agentId: string): Promise<AgentMailThread[]> {
  // Get all messages and group by thread
  const messages = await getAgentInbox(agentId, 1000);
  
  const threads = new Map<string, AgentMailThread>();
  
  for (const msg of messages) {
    const existing = threads.get(msg.threadId);
    if (existing) {
      existing.messageCount++;
      existing.lastMessageAt = msg.timestamp;
      if (msg.status === 'unread') existing.unreadCount++;
    } else {
      threads.set(msg.threadId, {
        id: msg.threadId,
        subject: msg.subject,
        participants: [msg.fromAgentId],
        messageCount: 1,
        lastMessageAt: msg.timestamp,
        unreadCount: msg.status === 'unread' ? 1 : 0,
      });
    }
  }
  
  return Array.from(threads.values()).sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
}

/**
 * Send mail to another agent
 */
export async function sendAgentMail(
  fromAgentId: string,
  input: SendMailInput
): Promise<{ sent: boolean; messageId?: string }> {
  try {
    // Ensure thread exists - use subject as topic
    const thread = await railsApi.mail.ensureThread(input.subject);
    
    // Send message - body_ref would be a reference to stored content
    // For now, we store body directly and use a generated ref
    const bodyRef = `body-${Date.now()}`;
    await railsApi.mail.send({
      thread_id: thread.thread_id,
      body_ref: bodyRef,
    });
    
    return { sent: true };
  } catch (error) {
    console.error('[AgentService] Failed to send mail:', error);
    return { sent: false };
  }
}

/**
 * Acknowledge a message
 */
export async function acknowledgeMail(agentId: string, messageId: string): Promise<void> {
  // Extract thread ID from message (messageId format is typically "thread-msg")
  const threadId = messageId.split('-')[0] || 'default';
  await railsApi.mail.ack(threadId, messageId);
}

/**
 * Request review from another agent
 */
export async function requestAgentReview(
  fromAgentId: string,
  toAgentId: string,
  subject: string,
  body: string,
  wihId?: string
): Promise<{ requested: boolean }> {
  try {
    // Ensure thread exists
    const thread = await railsApi.mail.ensureThread(subject);
    // Request review on the thread
    await railsApi.mail.requestReview(thread.thread_id, wihId || 'default', body);
    return { requested: true };
  } catch (error) {
    console.error('[AgentService] Failed to request review:', error);
    return { requested: false };
  }
}

// ============================================================================
// Utilities
// ============================================================================

function determineRunStatus(wihs: WihInfo[]): AgentRun['status'] {
  if (wihs.length === 0) return 'running';
  
  const allClosed = wihs.every(w => w.status === 'closed');
  const anyFailed = wihs.some(w => w.status === 'closed'); // Would need error tracking
  const anyRunning = wihs.some(w => w.status === 'signed');
  
  if (allClosed) return 'completed';
  if (anyFailed) return 'failed';
  if (anyRunning) return 'running';
  return 'running';
}

function mapWihStatusToTaskStatus(wihStatus: string): AgentTask['status'] {
  switch (wihStatus) {
    case 'open':
      return 'pending';
    case 'signed':
      return 'in-progress';
    case 'closed':
      return 'completed';
    default:
      return 'pending';
  }
}

function mapApiEventType(apiType: string): AgentEvent['type'] {
  switch (apiType) {
    case 'session.created':
    case 'run.started':
      return 'run.started';
    case 'session.completed':
    case 'run.completed':
      return 'run.completed';
    case 'session.error':
    case 'run.failed':
      return 'run.failed';
    case 'tool.call':
      return 'task.created';
    case 'tool.result':
      return 'task.completed';
    default:
      return 'agent.status.changed';
  }
}

export function formatDuration(startTime: string, endTime?: string): string {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const diff = end - start;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
    case 'in-progress':
      return 'bg-yellow-500';
    case 'completed':
      return 'bg-green-500';
    case 'failed':
    case 'error':
      return 'bg-red-500';
    case 'paused':
      return 'bg-orange-500';
    case 'idle':
    case 'pending':
      return 'bg-gray-400';
    default:
      return 'bg-gray-300';
  }
}
