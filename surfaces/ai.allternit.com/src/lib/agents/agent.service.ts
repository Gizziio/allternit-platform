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
  AppMode,
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
  AgentWorkspaceLayers,
} from './agent.types';
import {
  validateCreateAgentInput,
  safeValidate,
  agentSchema,
} from './agent.types';
import { getDefaultAgentModel } from './agent-models';
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
import { railsApi, type WihInfo } from './rails.service';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('AgentService');

// ============================================================================
// Agent CRUD Operations (Registry via API)
// ============================================================================

export async function listAgents(): Promise<Agent[]> {
  try {
    const response = await api.listAgents();

    // Normalize casing first, then validate each canonical agent. Validating
    // the raw rows rejects every snake_case backend response (and rails-api
    // omits `total`), which silently hid all API agents behind the local
    // registry fallback.
    const rawAgents = (response as { agents?: unknown })?.agents;
    if (!Array.isArray(rawAgents)) {
      return listLocalAgents();
    }

    const apiAgents = rawAgents
      .map(transformAgentFromApi)
      .filter((agent) => safeValidate(agentSchema, agent) !== null);

    return mergeAgentCatalog(apiAgents, listLocalAgents());
  } catch (error) {
    if (shouldUseLocalAgentRegistryFallback(error)) {
      return listLocalAgents();
    }

    throw error;
  }
}

export async function getAgent(agentId: string): Promise<Agent> {
  try {
    const response = await api.getAgent(agentId);
    // allternit-api wraps the row as { agent: {...} }; unwrap before transforming.
    const agent = (response as { agent?: unknown })?.agent ?? response;

    // Normalize casing first, then validate the canonical shape. Validating
    // the raw payload rejects every snake_case backend response.
    const transformed = transformAgentFromApi(agent);
    const validated = safeValidate(agentSchema, transformed);
    if (!validated) {
      // Instead of throwing, repair the transformed agent in place. This
      // handles cases where backend returns incomplete responses.
      const minimalAgent: Agent = {
        ...transformed,
        id: transformed.id || agentId,
        name: transformed.name || 'Unknown Agent',
        model: transformed.model || getDefaultAgentModel().id,
      };
      return minimalAgent;
    }

    return transformed;
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
      model: getDefaultAgentModel().id,
      provider: getDefaultAgentModel().provider,
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

export function normalizeCreateAgentInput(input: CreateAgentInput): CreateAgentInput {
  const allowedSurfaces = input.allowedSurfaces?.length
    ? input.allowedSurfaces
    : ['chat' as const];
  return {
    ...input,
    type: input.type || 'worker',
    harness: input.harness || { mode: 'cloud' as const },
    allowedSurfaces,
    trustTier: input.trustTier || 'standard',
    writeScope: input.writeScope || 'workspace',
    characterLayer: input.characterLayer || {
      identity: {
        setup: 'generalist' as const,
        className: 'Generalist',
        specialtySkills: [],
        temperament: 'balanced' as const,
        personalityTraits: [],
        backstory: '',
      },
      roleCard: {
        domain: input.name || 'general',
        inputs: [],
        outputs: [],
        definitionOfDone: [],
        hardBans: [],
        escalation: [],
        metrics: [],
      },
      voice: {
        style: '',
        rules: [],
        microBans: [],
        tone: { formality: 0.5, enthusiasm: 0.5, empathy: 0.5, directness: 0.5 },
      },
      progression: {
        class: 'Generalist',
        relevantStats: [],
        level: { maxLevel: 99, xpFormula: 'linear' },
      },
      avatar: {
        type: 'mascot' as const,
        mascot: { template: 'bot' as const },
        style: { primaryColor: '#6366f1', accentColor: '#1e1c1a' },
      },
    },
  };
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  input = normalizeCreateAgentInput(input);
  // Validate input with Zod
  try {
    validateCreateAgentInput(input);
  } catch (validationError) {
    logger.error({ err: validationError }, 'Invalid create agent input');
    throw new Error(`Invalid input: ${validationError instanceof Error ? validationError.message : 'Validation failed'}`);
  }
  
  // Transform camelCase to snake_case for API
  const apiInput: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    type: input.type || 'worker',
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
    // The agents API has no dedicated `source` column; persist the ownership
    // tier inside config (config.source is taken by integration origins).
    config: input.source ? { ...(input.config || {}), agentSource: input.source } : (input.config || {}),
    workspace_id: input.workspaceId,
    owner_id: input.ownerId,
    avatar: input.avatar,
    character_json: input.characterLayer,
    trust_tier: input.trustTier,
    harness_config: input.harness,
    enabled_modes: input.allowedSurfaces || ['chat'],
    allowed_skills: input.allowedSkills,
    allowed_tools: input.allowedTools,
    category: input.category,
    tags: input.tags,
    data_classification: input.dataClassification,
    write_scope: input.writeScope,
    is_bot: input.isBot,
    bot_profile: input.botProfile,
    brain_id: input.brainId,
    connector_bindings: input.connectorBindings,
    secret_refs: input.secretRefs,
    messaging_config: input.messagingConfig,
    identity_channels: input.identityChannels,
  };

  // Persist bot metadata in config as a fallback for backends that don't have
  // dedicated columns yet. This lets the UI treat packaged bots consistently
  // regardless of whether the registry supports top-level bot fields.
  if (input.isBot) {
    apiInput.config = {
      ...(apiInput.config as Record<string, unknown> || {}),
      isBot: true,
      botProfile: input.botProfile,
      ...(input.brainId ? { brainId: input.brainId } : {}),
    };
  }

  // Persist autonomous primitive metadata in config as a fallback for backends
  // that don't have dedicated columns yet.
  if (
    input.connectorBindings ||
    input.secretRefs ||
    input.messagingConfig ||
    input.identityChannels
  ) {
    apiInput.config = {
      ...(apiInput.config as Record<string, unknown> || {}),
      ...(input.connectorBindings ? { connectorBindings: input.connectorBindings } : {}),
      ...(input.secretRefs ? { secretRefs: input.secretRefs } : {}),
      ...(input.messagingConfig ? { messagingConfig: input.messagingConfig } : {}),
      ...(input.identityChannels ? { identityChannels: input.identityChannels } : {}),
    };
  }

  logger.debug('Creating agent: ' + String(input.name));
  const startTime = Date.now();
  
  try {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        logger.debug(`API call attempt ${attempt + 1}/${maxRetries}`);
        const response = await api.createAgent(apiInput as Omit<Agent, 'id'>);
        logger.debug(`Agent created in ${Date.now() - startTime}ms`);
        // allternit-api's create response only carries { agent: { id } } — no
        // other fields — so merge the generated id over what we already sent
        // instead of transforming a near-empty row.
        const created = (response as { agent?: { id?: string } })?.agent ?? (response as { id?: string });
        return transformAgentFromApi({ ...apiInput, ...created });
      } catch (error: any) {
        lastError = error;
        logger.error({ status: error.status, message: error.message }, `Attempt ${attempt + 1} failed`);

        // If it's a rate limit error (429), wait and retry with short backoff
        if (error.status === 429 || (error instanceof Error && error.message.includes('429'))) {
          const delay = 500 + Math.random() * 500; // 0.5-1s delay
          logger.warn(`Rate limited (429). Retrying in ${Math.round(delay)}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        // For other errors, throw immediately
        throw error;
      }
    }
    logger.error(`All ${maxRetries} attempts failed after ${Date.now() - startTime}ms`);
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
export function transformAgentFromApi(apiAgent: unknown): Agent {
  const a = apiAgent as Record<string, unknown>;
  const voiceData = a.voice as Record<string, unknown> | undefined;
  const config = (a.config as Record<string, unknown>) || {};
  // Backends differ in casing (allternit-api returns snake_case rows,
  // already-normalized payloads are camelCase) — accept both.
  const pick = <T,>(...values: unknown[]): T | undefined =>
    values.find((v) => v !== undefined && v !== null) as T | undefined;

  const allowedSurfaces = pick<AppMode[]>(
    Array.isArray(a.enabled_modes) ? a.enabled_modes : undefined,
    Array.isArray(a.allowedSurfaces) ? a.allowedSurfaces : undefined,
  );

  return {
    id: String(a.id || ''),
    name: String(a.name || ''),
    description: String(a.description || ''),
    type: pick<Agent['type']>(a.agent_type, a.type) || 'worker',
    parentAgentId: pick<string>(a.parent_agent_id, a.parentAgentId),
    model: String(a.model || ''),
    provider: (a.provider as Agent['provider']) || 'openai',
    capabilities: Array.isArray(a.capabilities) ? a.capabilities.map(String) : [],
    systemPrompt: pick<string>(a.system_prompt, a.systemPrompt),
    tools: Array.isArray(a.tools) ? a.tools.map(String) : [],
    maxIterations: pick<number>(
      typeof a.max_iterations === 'number' ? a.max_iterations : undefined,
      typeof a.maxIterations === 'number' ? a.maxIterations : undefined,
    ) ?? 10,
    temperature: typeof a.temperature === 'number' ? a.temperature : 0.7,
    voice: voiceData ? {
      voiceId: String(pick(voiceData.voice_id, voiceData.voiceId) || 'default'),
      voiceLabel: pick<string>(voiceData.voice_label, voiceData.voiceLabel),
      engine: voiceData.engine as VoiceConfig['engine'],
      enabled: Boolean(voiceData.enabled),
      autoSpeak: pick<boolean>(voiceData.auto_speak, voiceData.autoSpeak),
      speakOnCheckpoint: pick<boolean>(voiceData.speak_on_checkpoint, voiceData.speakOnCheckpoint),
    } : undefined,
    config,
    status: (a.status as Agent['status']) || 'idle',
    source: pick<Agent['source']>(config.agentSource, a.source),
    createdAt: String(pick(a.created_at, a.createdAt) || new Date().toISOString()),
    updatedAt: String(pick(a.updated_at, a.updatedAt) || new Date().toISOString()),
    lastRunAt: pick<string>(a.last_run_at, a.lastRunAt),
    workspaceId: pick<string>(a.workspace_id, a.workspaceId),
    ownerId: pick<string>(a.owner_id, a.ownerId),
    avatar: (a.avatar as Agent['avatar']) || undefined,
    characterLayer: pick<Agent['characterLayer']>(a.character_json, a.characterLayer),
    trustTier: pick<Agent['trustTier']>(a.trust_tier, a.trustTier) || 'standard',
    harness: pick<Agent['harness']>(a.harness_config, a.harness),
    allowedSurfaces: allowedSurfaces ?? ['chat'],
    allowedSkills: pick<string[]>(
      Array.isArray(a.allowed_skills) ? a.allowed_skills : undefined,
      Array.isArray(a.allowedSkills) ? a.allowedSkills : undefined,
    ),
    allowedTools: pick<string[]>(
      Array.isArray(a.allowed_tools) ? a.allowed_tools : undefined,
      Array.isArray(a.allowedTools) ? a.allowedTools : undefined,
    ),
    category: (a.category as Agent['category']) || undefined,
    tags: Array.isArray(a.tags) ? (a.tags as string[]) : undefined,
    dataClassification: pick<string>(a.data_classification, a.dataClassification),
    writeScope: pick<string>(a.write_scope, a.writeScope),
    isBot: pick<boolean>(a.is_bot, a.isBot, config.isBot) ?? false,
    botProfile: pick<Agent['botProfile']>(
      a.bot_profile as Agent['botProfile'],
      a.botProfile as Agent['botProfile'],
      config.botProfile as Agent['botProfile'],
    ) || undefined,
    brainId: pick<string>(a.brain_id, a.brainId, config.brainId as string),
    connectorBindings: pick<Agent['connectorBindings']>(
      Array.isArray(a.connector_bindings) ? a.connector_bindings : undefined,
      Array.isArray(a.connectorBindings) ? a.connectorBindings : undefined,
      config.connectorBindings as Agent['connectorBindings'],
    ),
    secretRefs: pick<Agent['secretRefs']>(
      Array.isArray(a.secret_refs) ? a.secret_refs : undefined,
      Array.isArray(a.secretRefs) ? a.secretRefs : undefined,
      config.secretRefs as Agent['secretRefs'],
    ),
    messagingConfig: pick<Agent['messagingConfig']>(
      a.messaging_config as Agent['messagingConfig'],
      a.messagingConfig as Agent['messagingConfig'],
      config.messagingConfig as Agent['messagingConfig'],
    ),
    identityChannels: pick<Agent['identityChannels']>(
      a.identity_channels as Agent['identityChannels'],
      a.identityChannels as Agent['identityChannels'],
      config.identityChannels as Agent['identityChannels'],
    ),
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
  if (updates.type !== undefined) apiUpdates.type = updates.type;
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
  if (updates.source !== undefined) {
    // No dedicated column — persist the ownership tier inside config, merged
    // over the config update (if any) so neither write clobbers the other.
    apiUpdates.config = { ...((apiUpdates.config as Record<string, unknown>) || {}), agentSource: updates.source };
  }
  if (updates.avatar !== undefined) apiUpdates.avatar = updates.avatar;
  if (updates.characterLayer !== undefined) apiUpdates.character_json = updates.characterLayer;
  if (updates.trustTier !== undefined) apiUpdates.trust_tier = updates.trustTier;
  if (updates.harness !== undefined) apiUpdates.harness_config = updates.harness;
  if (updates.allowedSurfaces !== undefined) apiUpdates.enabled_modes = updates.allowedSurfaces;
  if (updates.allowedSkills !== undefined) apiUpdates.allowed_skills = updates.allowedSkills;
  if (updates.allowedTools !== undefined) apiUpdates.allowed_tools = updates.allowedTools;
  if (updates.category !== undefined) apiUpdates.category = updates.category;
  if (updates.tags !== undefined) apiUpdates.tags = updates.tags;
  if (updates.dataClassification !== undefined) apiUpdates.data_classification = updates.dataClassification;
  if (updates.writeScope !== undefined) apiUpdates.write_scope = updates.writeScope;
  if (updates.isBot !== undefined) apiUpdates.is_bot = updates.isBot;
  if (updates.botProfile !== undefined) apiUpdates.bot_profile = updates.botProfile;
  if (updates.brainId !== undefined) apiUpdates.brain_id = updates.brainId;
  if (updates.connectorBindings !== undefined) apiUpdates.connector_bindings = updates.connectorBindings;
  if (updates.secretRefs !== undefined) apiUpdates.secret_refs = updates.secretRefs;
  if (updates.messagingConfig !== undefined) apiUpdates.messaging_config = updates.messagingConfig;
  if (updates.identityChannels !== undefined) apiUpdates.identity_channels = updates.identityChannels;

  // Mirror bot metadata and autonomous primitives into config so backends
  // without dedicated columns still round-trip them.
  if (
    updates.isBot !== undefined ||
    updates.botProfile !== undefined ||
    updates.connectorBindings !== undefined ||
    updates.secretRefs !== undefined ||
    updates.messagingConfig !== undefined ||
    updates.identityChannels !== undefined
  ) {
    apiUpdates.config = {
      ...((apiUpdates.config as Record<string, unknown>) || {}),
      ...(updates.isBot !== undefined ? { isBot: updates.isBot } : {}),
      ...(updates.botProfile !== undefined ? { botProfile: updates.botProfile } : {}),
      ...(updates.connectorBindings !== undefined ? { connectorBindings: updates.connectorBindings } : {}),
      ...(updates.secretRefs !== undefined ? { secretRefs: updates.secretRefs } : {}),
      ...(updates.messagingConfig !== undefined ? { messagingConfig: updates.messagingConfig } : {}),
      ...(updates.identityChannels !== undefined ? { identityChannels: updates.identityChannels } : {}),
    };
  }

  try {
    // allternit-api's update response is just { success: true } — no row —
    // so re-fetch to return the agent's actual post-update state.
    await api.updateAgent(agentId, apiUpdates);
    return await getAgent(agentId);
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
    logger.error({ err: error }, 'Failed to list runs');
    return [];
  }
}

/**
 * Cancel a run by closing all WIHs
 */
export async function cancelAgentRun(agentId: string, runId: string): Promise<void> {
  const { wihs } = await railsApi.wihs.list({ dag_id: runId });
  
  // Close all open WIHs in parallel
  await Promise.all(
    wihs.map(async (wih) => {
      if (wih.status === 'open' || wih.status === 'signed') {
        await railsApi.wihs.close(wih.wih_id, {
          status: 'failed',
          evidence: ['Cancelled by user'],
        });
      }
    })
  );
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
  logger.debug('Dequeue: ' + String(itemId));
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
      logger.error({ err: err }, 'Failed to parse event');
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
  await railsApi.plan.show(planId);
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
  throw new Error(
    `Pending gate reviews are unavailable for agent '${agentId}' because no backend listing endpoint is implemented.`
  );
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
 * Get agent inbox messages from the Rails mail backend.
 * This is the single CommRails mail implementation; there is no local fallback.
 */
export async function getAgentInbox(agentId: string, limit: number = 50): Promise<AgentMailMessage[]> {
  // Real endpoint: GET /mail/inbox/:agent_id (issue #16). The old
  // POST /mail/inbox route does not exist on the backend.
  const response = await railsApi.mail.inbox({ agent_id: agentId, limit });

  // Transform messages - filter by recipient
  const messages = (response.messages || []) as unknown[];
  return messages.map((msg: unknown): AgentMailMessage => {
    const m = msg as Record<string, unknown>;
    return {
      id: String(m.message_id || m.id || ''),
      threadId: String(m.thread_id || 'default'),
      fromAgentId: String(m.from_agent || ''),
      fromAgentName: undefined,
      toAgentId: typeof m.to_agent === 'string' ? m.to_agent : undefined,
      subject: typeof m.subject === 'string' ? m.subject : 'Message',
      body: String(m.body || ''),
      bodyRef: typeof m.body_ref === 'string' ? m.body_ref : undefined,
      status: m.acknowledged ? 'acknowledged' : 'unread',
      priority: (m.priority as AgentMailMessage['priority']) ?? 'normal',
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
  const response = await railsApi.mail.threads();
  const summaries = (response.threads || []) as Array<{ thread_id: string; messages: number; last_ts: string }>;

  const messages = await getAgentInbox(agentId, 1000);

  return summaries.map((t) => {
    const threadMessages = messages.filter((m) => m.threadId === t.thread_id);
    const participants = Array.from(
      new Set(
        threadMessages.flatMap((m) => [m.fromAgentId, m.toAgentId]).filter((p): p is string => typeof p === 'string'),
      ),
    );
    const unreadCount = threadMessages.filter((m) => m.toAgentId === agentId && m.status === 'unread').length;

    return {
      id: t.thread_id,
      subject: threadMessages[0]?.subject || 'Message',
      participants,
      messageCount: t.messages,
      lastMessageAt: t.last_ts,
      unreadCount,
    };
  });
}

/**
 * Send mail to another agent
 */
export async function sendAgentMail(
  fromAgentId: string,
  input: SendMailInput
): Promise<{ sent: boolean; messageId?: string }> {
  // Ensure thread exists - use subject as topic and include sender/recipient
  // as participants so the thread is visible to both agents.
  const participants = [fromAgentId, input.toAgentId].filter(Boolean) as string[];
  const thread = await railsApi.mail.ensureThread(input.subject, participants);

  const bodyRef = `body-${Date.now()}`;
  await railsApi.mail.send({
    thread_id: thread.thread_id,
    body_ref: bodyRef,
    body: input.body,
    to_agent_id: input.toAgentId,
    subject: input.subject,
    priority: input.priority,
    attachments: input.attachments?.map((a) => a.ref),
  });

  return { sent: true, messageId: bodyRef };
}

/**
 * Hand off a task/message from one bot to another bot's inbox.
 * This is the runtime implementation of the `@mention` handoff pattern.
 */
export async function handoffToBot(
  fromAgentId: string,
  toAgentId: string,
  content: string,
  subject = 'Handoff',
  priority: AgentMailMessage['priority'] = 'normal'
): Promise<{ sent: boolean; messageId?: string }> {
  return sendAgentMail(fromAgentId, {
    toAgentId,
    subject,
    body: content,
    priority,
  });
}

/**
 * Acknowledge a message
 */
export async function acknowledgeMail(
  _agentId: string,
  messageId: string,
  threadId?: string,
): Promise<void> {
  await railsApi.mail.ack(threadId || 'default', messageId);
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
    logger.error({ err: error }, 'Failed to request review');
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

function formatDuration(startTime: string, endTime?: string): string {
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

function getStatusColor(status: string): string {
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
      return 'bg-zinc-400';
    default:
      return 'bg-zinc-300';
  }
}

import { createDefaultAvatarConfig } from './character.types';
import type { CreationCardSeedState, CreationBlueprintState } from './agent.types';
import type { CharacterTelemetryEvent } from './character.types';
export { createDefaultAvatarConfig };

export function setupSeedDefaults(setup?: string): CreationCardSeedState {
  const voiceStyleMap: Record<string, string> = {
    coding: 'precise',
    creative: 'expressive',
    research: 'analytical',
    operations: 'professional',
    generalist: 'conversational',
  };
  return {
    domainFocus: setup || 'general',
    definitionOfDone: 'Task completed successfully with all requirements met',
    escalationRules: 'Escalate if stuck for more than 3 iterations\nEscalate on security or data concerns',
    voiceRules: 'Be concise and clear\nUse active voice',
    voiceMicroBans: 'Avoid jargon\nNo excessive hedging',
    voiceStyle: voiceStyleMap[setup || ''] || 'professional',
    hardBanCategories: [],
  };
}

export function detectPluginConflicts(tools: string[]): { hasConflicts: boolean; hasConflict: boolean; severity: string | null; conflicts: string[] } {
  const conflictPairs: [string, string][] = [
    ['browser-automation', 'terminal'],
    ['file-operations', 'database'],
  ];
  const conflicts: string[] = [];
  for (const [a, b] of conflictPairs) {
    if (tools.includes(a) && tools.includes(b)) {
      conflicts.push(`${a} conflicts with ${b}`);
    }
  }
  return {
    hasConflicts: conflicts.length > 0,
    hasConflict: conflicts.length > 0,
    severity: conflicts.length > 0 ? 'warning' : null,
    conflicts,
  };
}

export function splitLines(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

export interface WorkspaceDocumentInput {
  name: string;
  description: string;
  model: string;
  provider: string;
  type?: string;
  trustTier?: string;
  writeScope?: string;
  dataClassification?: string;
  allowedSurfaces?: string[];
  allowedSkills?: string[];
  allowedTools?: string[];
  harness?: Record<string, unknown>;
  category?: string;
  tags?: string[];
  tools?: string[];
  capabilities?: string[];
  layers?: AgentWorkspaceLayers;
}

const DEFAULT_WORKSPACE_LAYERS: AgentWorkspaceLayers = {
  cognitive: true,
  identity: true,
  governance: true,
  skills: true,
  business: false,
};

export function generateEnhancedWorkspaceDocuments(
  config: unknown,
  metadata: WorkspaceDocumentInput
): Array<{ path: string; content: string }> {
  const name = metadata.name || 'Agent';
  const description = metadata.description || '';
  const model = metadata.model || getDefaultAgentModel().id;
  const provider = metadata.provider || getDefaultAgentModel().provider;
  const agentType = metadata.type || 'worker';
  const trustTier = metadata.trustTier || 'standard';
  const writeScope = metadata.writeScope || 'workspace';
  const dataClassification = metadata.dataClassification || 'internal';
  const allowedSurfaces = metadata.allowedSurfaces || ['chat'];
  const allowedSkills = metadata.allowedSkills || [];
  const allowedTools = metadata.allowedTools || metadata.tools || [];
  const harness = metadata.harness || { mode: 'cloud' };
  const category = metadata.category || 'general';
  const tags = metadata.tags || [];
  const layers = metadata.layers ?? DEFAULT_WORKSPACE_LAYERS;
  const c = (config as Record<string, unknown>) || {};
  const personality = (c.personality as Record<string, unknown>) || {};
  const character = (c.character as Record<string, unknown>) || {};
  const tools = metadata.tools || (c.tools as string[]) || [];
  const capabilities = metadata.capabilities || (c.capabilities as string[]) || [];
  const hardBans = (character.hardBans as Array<{ category: string }>) || [];
  const specialtySkills = (character.specialtySkills as string[]) || [];
  const setup = (character.setup as string) || 'generalist';
  const temperament = (character.temperament as string) || 'balanced';
  const now = new Date().toISOString();

  const docs: Array<{ path: string; content: string }> = [
    {
      path: '.allternit/manifest.json',
      content: JSON.stringify({
        id: `${agentType}-${Date.now()}`,
        agentName: name,
        template: 'allternit-standard',
        version: '1.0.0',
        createdAt: Date.now(),
        lastModified: Date.now(),
        layers,
        files: [],
      }, null, 2),
    },
    {
      path: '.allternit/README.md',
      content: `# ${name}

${description}

## Configuration
- **Model**: ${model} (${provider})
- **Setup**: ${setup}
- **Temperament**: ${temperament}
- **Created**: ${now.split('T')[0]}

## Capabilities
${capabilities.length > 0 ? capabilities.map(c => `- ${c}`).join('\n') : '*No capabilities configured*'}

## Tools
${tools.length > 0 ? tools.map(t => `- ${t}`).join('\n') : '*No tools configured*'}
`
    },
  ];

  if (layers.cognitive) {
    docs.push({
      path: '.allternit/cognitive/COGNITIVE.md',
      content: `# COGNITIVE.md — ${name}'s Cognitive Layer

## Overview
This layer contains the agent's reasoning, memory, and learning systems.

## Current Focus
${description || 'Ready to assist with tasks'}

## Active Tasks
- [ ] Initialize and learn about the workspace
- [ ] Ready for first interaction

## Task Graph
*To be populated based on interactions*

## Review Criteria
*To be defined based on agent purpose*

## Memory Systems
- Working memory: active session context
- Long-term memory: persistent facts and patterns
- Episodic memory: conversation history and outcomes
`,
    },
    {
      path: '.allternit/cognitive/BRAIN.md',
      content: `# BRAIN.md — ${name}'s Cognitive Core

## Current Focus
${description || 'Ready to assist with tasks'}

## Active Tasks
- [ ] Initialize and learn about the workspace
- [ ] Ready for first interaction

## Task Graph
*To be populated based on interactions*

## Review Criteria
*To be defined based on agent purpose*
`,
    },
    {
      path: '.allternit/memory/active-tasks.md',
      content: `# Active Tasks

*No active tasks*

> Tasks will be automatically added when ${name} receives work.
`,
    });
  }

  if (layers.identity) {
    docs.push({
      path: '.allternit/identity/IDENTITY.md',
      content: `# IDENTITY.md — Who Is ${name}?

| Field | Value |
|-------|-------|
| **Name** | ${name} |
| **Type** | ${setup} |
| **Temperament** | ${temperament} |
| **Model** | ${model} |
| **Provider** | ${provider} |

## Purpose
${description || 'To assist effectively and deliver high-quality results.'}

## Specialty Skills
${specialtySkills.length > 0 ? specialtySkills.map(s => `- ${s}`).join('\n') : '- General assistance'}
`,
    },
    {
      path: '.allternit/identity/SOUL.md',
      content: `# SOUL.md — ${name}'s Core Principles

## Communication Style
- **Approach**: ${(personality.communicationStyle as string) || 'direct'}
- **Work Style**: ${(personality.workStyle as string) || 'independent'}
- **Decision Making**: ${(personality.decisionMaking as string) || 'data-driven'}

## Personality Traits
${((c.personalityTraits as string[]) || []).map(t => `- ${t}`).join('\n') || '- Adaptable and professional'}

## Backstory
${(c.backstory as string) || 'An AI assistant created to serve with accuracy and efficiency.'}
`,
    },
    {
      path: '.allternit/identity/VOICE.md',
      content: `# VOICE.md — How ${name} Speaks

## Voice Style
${(c.voiceStyle as string) || 'Professional and clear'}

## Tone
- Formality: ${((c.voice as Record<string, unknown>)?.tone as Record<string, number>)?.formality ?? 0.5}
- Enthusiasm: ${((c.voice as Record<string, unknown>)?.tone as Record<string, number>)?.enthusiasm ?? 0.5}
- Empathy: ${((c.voice as Record<string, unknown>)?.tone as Record<string, number>)?.empathy ?? 0.5}
- Directness: ${((c.voice as Record<string, unknown>)?.tone as Record<string, number>)?.directness ?? 0.5}

## Rules
${(((c.voice as Record<string, unknown>)?.rules as string[]) || []).map(r => `- ${r}`).join('\n') || '- Be clear and concise'}

## Micro-bans
${(((c.voice as Record<string, unknown>)?.microBans as string[]) || []).map(m => `- ${m}`).join('\n') || '- None configured'}
`,
    });
  }

  if (layers.governance) {
    docs.push({
      path: '.allternit/governance/PLAYBOOK.md',
      content: `# PLAYBOOK.md — ${name}'s Execution Rules

## Standard Operating Procedures

### Communication
- Be ${(personality.communicationStyle as string) || 'direct'} and clear
- Adapt tone to context
- Acknowledge uncertainty honestly

### Error Handling
- Acknowledge limitations honestly
- Offer alternatives when stuck
- Log errors for improvement

### Boundaries
${hardBans.length > 0 ? hardBans.map(b => `- **${b.category}**: Prohibited`).join('\n') : '- No hard bans configured'}
`,
    },
    {
      path: '.allternit/governance/TOOLS.md',
      content: `# TOOLS.md — ${name}'s Tool Inventory

## Available Tools
${tools.length > 0 ? tools.map(t => `- ${t}`).join('\n') : '*No tools configured*'}

## Capabilities
${capabilities.length > 0 ? capabilities.map(c => `- ${c}`).join('\n') : '*No capabilities configured*'}

## Tool Usage Guidelines
- Verify permissions before use
- Explain what tools will do
- Report results clearly
`,
    },
    {
      path: '.allternit/governance/HEARTBEAT.md',
      content: `# HEARTBEAT.md — ${name}'s Periodic Tasks

## Scheduled Tasks
*Configure in CronJob wizard*

### Daily
- [ ] Self-check
- [ ] Memory review

### Weekly
- [ ] Performance review
- [ ] Archive old data
`,
    },
    {
      path: '.allternit/governance/POLICY.md',
      content: `# POLICY.md — ${name}'s Operating Policy

## Trust Tier
${trustTier}

## Write Scope
${writeScope}

## Data Classification
${dataClassification}

## Allowed Mode Surfaces
${allowedSurfaces.map(s => `- ${s}`).join('\n')}

## Hard Bans
${hardBans.length > 0 ? hardBans.map(b => `- **${b.category}**: Prohibited`).join('\n') : '- No hard bans configured'}

## Escalation Rules
${((character.escalation as string[]) || []).map(e => `- ${e}`).join('\n') || '- Escalate on policy violations'}
`,
    });
  }

  if (layers.skills) {
    docs.push({
      path: '.allternit/skills/SKILL.md',
      content: `# SKILL.md — ${name}'s Skill Manifest

## Specialty Skills
${specialtySkills.length > 0 ? specialtySkills.map(s => `- ${s}`).join('\n') : '- General assistance'}

## Allowed Skills
${allowedSkills.length > 0 ? allowedSkills.map(s => `- ${s}`).join('\n') : '- All platform skills'}

## Allowed Tools
${allowedTools.length > 0 ? allowedTools.map(t => `- ${t}`).join('\n') : '- No tools configured'}

## Capabilities
${capabilities.length > 0 ? capabilities.map(c => `- ${c}`).join('\n') : '- No capabilities configured'}
`,
    },
    {
      path: '.allternit/skills/contract.json',
      content: JSON.stringify({
        schema_version: '1.0.0',
        agent: {
          name,
          type: agentType,
          category,
          tags,
          model,
          provider,
        },
        trust: {
          tier: trustTier,
          write_scope: writeScope,
          data_classification: dataClassification,
        },
        runtime: {
          allowed_surfaces: allowedSurfaces,
          harness,
          max_iterations: (c.maxIterations as number) || 10,
          temperature: (c.temperature as number) || 0.7,
        },
        skills: {
          allowed: allowedSkills,
          tools: allowedTools,
          capabilities,
        },
        created_at: now,
      }, null, 2),
    });
  }

  if (layers.business) {
    docs.push({
      path: '.allternit/business/BUSINESS.md',
      content: `# BUSINESS.md — ${name}'s Business Layer

## Purpose
${description || 'To assist the user effectively'}

## Success Metrics
- Task completion rate
- User satisfaction
- Accuracy of outputs
- Efficiency of execution

## Key Stakeholders
- User: primary beneficiary of agent outputs
- Platform: Allternit runtime and governance

## Value Proposition
*Define the unique value this agent provides*

## Escalation Paths
- Technical issues: platform support
- Safety concerns: governance policy review
- Scope questions: refer to IDENTITY.md and PLAYBOOK.md
`,
    });
  }

  docs.push({
    path: '.allternit/CHANGELOG.md',
    content: `# Changelog

## 1.0.0 — ${now.split('T')[0]}
- Agent created
- Workspace initialized with ${tools.length} tools, ${capabilities.length} capabilities
- ${hardBans.length} hard bans configured
- Trust tier: ${trustTier}
- Enabled surfaces: ${allowedSurfaces.join(', ')}
- Layers: ${Object.entries(layers).filter(([, v]) => v).map(([k]) => k).join(', ')}
`,
  });

  return docs;
}

export function buildSeedTelemetryEvents(blueprint: CreationBlueprintState): CharacterTelemetryEvent[] {
  return [
    {
      id: `evt-${Date.now()}`,
      type: 'mission_created',
      timestamp: Date.now(),
      runId: `run-${Date.now()}`,
      payload: {
        setup: blueprint.setup,
        temperament: blueprint.temperament,
        specialtySkills: blueprint.specialtySkills ?? [],
      },
    },
  ];
}
