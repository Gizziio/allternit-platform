/**
 * TypeScript types for A2R Agent Workspace
 * 
 * These types mirror the Rust types from a2r-agent-workspace crate
 */

/** Session runtime status - matches terminal app states */
export type SessionStatus =
  | "idle"
  | "connecting"
  | "hydrating"
  | "planning"
  | "web"
  | "executing"
  | "responding"
  | "compacting"
  | "error"

/** Policy check result */
export interface PolicyCheckResult {
  allowed: boolean;
  requires_approval: boolean;
  reason: string | null;
}

/** Tool policy */
export interface ToolPolicy {
  tool_id: string;
  tier: 'read_only' | 'write' | 'destructive' | 'network';
  default_action: 'allow' | 'deny' | 'ask';
  requires_approval: boolean;
}

/** Boot event */
export interface BootEvent {
  phase: 'SystemInit' | 'Identity' | 'Environment' | 'Memory' | 'Capabilities' | 'ContextBuild';
  step: number;
  description: string;
  status: 'Started' | 'Completed' | { Warning: string } | { Error: string };
  timestamp: string;
}

/** Workspace metadata */
export interface WorkspaceMetadata {
  workspace_id: string;
  workspace_version: string;
  agent_name: string;
  created_at: string;
  layers: {
    cognitive: boolean;
    identity: boolean;
    governance: boolean;
    skills: boolean;
    business: boolean;
  };
}

/** Skill definition */
export interface SkillDefinition {
  id: string;
  version: string;
  intent: string;
  contract_path: string;
}

/** Context pack summary */
export interface ContextSummary {
  agent_name: string;
  agent_role: string;
  current_focus: string;
  active_tasks: string[];
  recent_lessons: string[];
  key_preferences: Record<string, string>;
  context_pressure: 'Low' | 'Medium' | 'High';
}

/** File operation types */
export type FileOperation = 'Read' | 'Write' | 'Delete';

/** Workspace interface */
export interface IWorkspace {
  /** Check if this is a valid agent workspace */
  isValid(): boolean;
  
  /** Get workspace version */
  getVersion(): string | null;
  
  /** Get workspace metadata */
  getMetadata(): Promise<WorkspaceMetadata>;
  
  /** Boot the workspace */
  boot(): Promise<void>;
  
  /** Get boot events */
  getBootEvents(): BootEvent[];
}

/** Policy engine interface */
export interface IPolicyEngine {
  /** Check if a tool call is allowed */
  checkTool(toolId: string): Promise<PolicyCheckResult>;
  
  /** Check if a file operation is allowed */
  checkFileOp(path: string, operation: FileOperation): Promise<PolicyCheckResult>;
}

/** Skills registry interface */
export interface ISkillsRegistry {
  /** List all skills */
  listSkills(): Promise<SkillDefinition[]>;
  
  /** Get skill by ID */
  getSkill(id: string): Promise<SkillDefinition | null>;
  
  /** Find matching skills */
  findMatching(query: string): Promise<SkillDefinition[]>;
}

/** Checkpoint interface */
export interface ICheckpoint {
  id: string;
  timestamp: string;
  session_id: string;
  agent_state: {
    current_goal: string;
    recent_decisions: string[];
    open_questions: string[];
    blockers: string[];
    mood: 'Focused' | 'Exploring' | 'Blocked' | 'Reviewing' | 'Completing';
  };
  task_state: {
    active_task_id: string | null;
    progress_percent: number;
    completed_steps: string[];
    pending_steps: string[];
    verification_status: 'NotStarted' | 'InProgress' | 'Passed' | 'Failed';
  };
}

/** Checkpoint manager interface */
export interface ICheckpointManager {
  /** Create a new checkpoint */
  create(sessionId: string): Promise<ICheckpoint>;
  
  /** Get the latest checkpoint */
  getLatest(): Promise<ICheckpoint | null>;
  
  /** Restore from checkpoint */
  restore(checkpointId: string): Promise<void>;
  
  /** List checkpoints */
  list(limit: number): Promise<ICheckpoint[]>;
}

/** Legacy Workspace API interface - kept for backward compatibility */
export interface IWorkspaceAPI {
  workspace: IWorkspace;
  policy: IPolicyEngine;
  skills: ISkillsRegistry;
  checkpoints: ICheckpointManager;
}

// =============================================================================
// Unified Workspace API Types
// =============================================================================

/** Workspace layers availability */
export interface WorkspaceLayers {
  cognitive: boolean;
  identity: boolean;
  governance: boolean;
  skills: boolean;
  business: boolean;
}

/** Task status */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';

/** Task priority */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/** Task definition */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  updated_at: string;
  due_date?: string;
  assignee?: string;
  tags: string[];
  parent_id?: string;
  metadata?: Record<string, unknown>;
}

/** Create task request */
export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  assignee?: string;
  tags?: string[];
  parent_id?: string;
  metadata?: Record<string, unknown>;
}

/** Policy rule action */
export type PolicyAction = 'allow' | 'deny' | 'ask';

/** Policy rule tier */
export type PolicyTier = 'read_only' | 'write' | 'destructive' | 'network';

/** Policy rule definition */
export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  tool_pattern: string;
  tier: PolicyTier;
  action: PolicyAction;
  requires_approval: boolean;
  conditions?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Skill definition for unified API */
export interface Skill {
  id: string;
  name: string;
  description?: string;
  version: string;
  intent: string;
  contract_path?: string;
  installed: boolean;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

/** Checkpoint for unified API */
export interface Checkpoint {
  id: string;
  name: string;
  timestamp: string;
  session_id?: string;
  agent_state?: {
    current_goal: string;
    recent_decisions: string[];
    open_questions: string[];
    blockers: string[];
    mood: 'Focused' | 'Exploring' | 'Blocked' | 'Reviewing' | 'Completing';
  };
  task_state?: {
    active_task_id: string | null;
    progress_percent: number;
    completed_steps: string[];
    pending_steps: string[];
    verification_status: 'NotStarted' | 'InProgress' | 'Passed' | 'Failed';
  };
  metadata?: Record<string, unknown>;
}

/** Memory entry type */
export type MemoryEntryType = 'observation' | 'decision' | 'lesson' | 'preference' | 'fact';

/** Memory entry */
export interface MemoryEntry {
  id: string;
  type: MemoryEntryType;
  content: string;
  timestamp: string;
  tags: string[];
  source?: string;
  importance: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

/** Identity configuration */
export interface IdentityConfig {
  id: string;
  name: string;
  role: string;
  personality?: string;
  expertise: string[];
  preferences: Record<string, string>;
  constraints: string[];
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

/** A2R Native Project State (GSD-inspired context engineering) */
export interface AllternitNativeState {
  project?: {
    name: string;
    description: string;
    core_value: string;
    last_updated: string;
  };
  roadmap?: {
    milestones: {
      id: string;
      title: string;
      status: 'pending' | 'active' | 'completed';
      requirements: string[];
    }[];
  };
  current_state: {
    phase: string;
    plan_index: number;
    total_plans_in_phase: number;
    status: string;
    progress_percent: number;
    last_activity: string;
  };
  active_plan?: {
    id: string;
    objective: string;
    wave: number;
    tasks: {
      id: string;
      name: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
      action: string;
      verify: string;
    }[];
  };
}

/** Unified Workspace API interface
 * 
 * This interface supports both WASM mode (basic features only) and
 * HTTP mode (all features available). All optional properties should
 * be checked before use.
 */
export interface WorkspaceAPI {
  // Core workspace info (always available)
  workspace: {
    getMetadata(): Promise<WorkspaceMetadata>;
    getLayers?(): Promise<WorkspaceLayers>;
  };

  // A2R Native Context State (Protocol Layer)
  allternitNative?: {
    getState(): Promise<AllternitNativeState>;
    refreshState(): Promise<AllternitNativeState>;
  };
  
  // Task operations (available with HTTP backend)
  tasks?: {
    list(): Promise<Task[]>;
    create(task: CreateTaskRequest): Promise<Task>;
    update(id: string, updates: Partial<Task>): Promise<Task>;
    delete(id: string): Promise<void>;
  };
  
  // Policy operations (optional)
  policy?: {
    listRules(): Promise<PolicyRule[]>;
    createRule(rule: PolicyRule): Promise<void>;
    deleteRule(id: string): Promise<void>;
    updateRule(id: string, updates: Partial<PolicyRule>): Promise<void>;
  };
  
  // Skills operations (optional)
  skills?: {
    list(): Promise<Skill[]>;
    install(skillId: string): Promise<void>;
    uninstall(skillId: string): Promise<void>;
    get(skillId: string): Promise<Skill | null>;
  };
  
  // Checkpoints operations (optional)
  checkpoints?: {
    list(): Promise<Checkpoint[]>;
    create(name: string): Promise<Checkpoint>;
    restore(id: string): Promise<void>;
    delete(id: string): Promise<void>;
  };
  
  // Memory operations (optional)
  memory?: {
    getEntries(): Promise<MemoryEntry[]>;
    addEntry(entry: MemoryEntry): Promise<void>;
    search(query: string): Promise<MemoryEntry[]>;
  };
  
  // Identity operations (optional)
  identity?: {
    getConfig(): Promise<IdentityConfig>;
    updateConfig(config: Partial<IdentityConfig>): Promise<void>;
  };
  
  // Session operations (optional)
  createSession?(): Promise<string>;
  sendPrompt?(sessionId: string, prompt: string): Promise<void>;
  getSessionState?(sessionId: string): Promise<{
    status: SessionStatus;
    pendingTools: string[];
  }>;
  endSession?(sessionId: string): Promise<void>;
}
