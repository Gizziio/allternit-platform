/**
 * Meta-Swarm Dashboard
 * 
 * Export all components and types for the Meta-Swarm Dashboard
 */

export { MetaSwarmDashboard } from './MetaSwarmDashboard';
export { AgentStatusPanel } from './components/AgentStatusPanel';
export { ProgressPanel } from './components/ProgressPanel';
export { CostTracker } from './components/CostTracker';
export { FileConflictPanel } from './components/FileConflictPanel';
export { KnowledgePanel } from './components/KnowledgePanel';

export type {
  SwarmMode,
  Status,
  AgentStatus,
  Priority,
  EntityId,
  Cost,
  Progress,
  Task,
  Agent,
  AgentRole,
  AgentStats,
  AgentTeam,
  ExecutionResult,
  ProgressUpdate,
  ProgressUpdateType,
  RoutingDecision,
  Session,
  Pattern,
  FileLock,
  QualityCheck,
  TriageItem,
  TriageResult,
  BudgetInfo,
} from './types';

export { metaSwarmClient, MetaSwarmClient } from './api';
