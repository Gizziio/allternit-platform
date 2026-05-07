/**
 * Agent Components Index
 * 
 * Comprehensive suite of Allternit-native agent UI components.
 * All components follow Allternit design system with:
 * - Sand/nude obsidian color palette
 * - Glass morphism effects
 * - Mode-aware theming (chat/cowork/code/browser)
 * - Technical geometric precision
 * 
 * @module agent-components
 */

// Design System
export {
  SAND,
  NUDE,
  MODE_COLORS,
  GLASS,
  BACKGROUND,
  TEXT,
  BORDER,
  STATUS,
  SHADOW,
  SPACE,
  RADIUS,
  TYPOGRAPHY,
  ANIMATION,
  COMPONENT_PRESETS,
  getModeColors,
  createGlassStyle,
  createGlowStyle,
  type AgentMode,
} from '@/design/allternit.tokens';

// Agent Management
export { AllternitSystemPromptEditor } from './AllternitSystemPromptEditor';
export { AgentSelectorWizard } from './AgentSelectorWizard';
export { AgentTestingPlayground } from './AgentTestingPlayground';
export { SessionAnalyticsDashboard } from './SessionAnalyticsDashboard';
export { SwarmOrchestrator } from './SwarmOrchestrator';
export { LiveExecutionMonitor } from './LiveExecutionMonitor';

// Context & Tool Components
export { AgentContextStrip } from './AgentContextStrip';
export { AgentStorefrontCard } from './AgentStorefrontCard';
export { AgentLeaderboard } from './AgentLeaderboard';
export { McpMarketplace } from './McpMarketplace';
export { ToolCallVisualization, useToolCallAccent } from './ToolCallVisualization';
export { ToolConfirmation } from './ToolConfirmation';
export { AskUserQuestion, ToolQuestionDisplay } from './AskUserQuestion';
export { AskUserQuestionWizard } from './AskUserQuestionWizard';
export { CronJobWizard } from './CronJobWizard';

// Re-export types from individual components


export type {
  AgentSelectorWizardProps,
} from './AgentSelectorWizard';

// Core Agent Types centralized in lib
export type {
  CharacterLayerConfig,
  AgentSetup,
  Temperament,
  RoleHardBan,
  HardBanCategory,
  AvatarConfig,
  MascotTemplate,
  AgentType,
  ModelProvider,
} from '@/lib/agents/agent.types';

// Professional Avatar Collection - defined in AgentCreationWizardEnhanced
// export { PROFESSIONAL_AVATARS } from './AgentCreationWizardEnhanced';

export type {
  AgentTestingPlaygroundProps,
} from './AgentTestingPlayground';

export type {
  SessionAnalyticsDashboardProps,
} from './SessionAnalyticsDashboard';

export type {
  SwarmOrchestratorProps,
  SwarmConfig,
  SwarmAgent,
  AgentRole,
  ExecutionMode,
  RoutingConfig,
  RoutingStrategy,
  PriorityRule,
  AgentSwarmConfig,
  SwarmExecutionRequest,
  SwarmExecution,
  ExecutionStatus,
  ExecutionResult,
  ExecutionError,
  ExecutionMetrics,
  AgentExecutionMetric,
  SwarmExecutionUpdate,
  ValidationError,
} from './SwarmOrchestrator';

export type {
  LiveExecutionMonitorProps,
  LogEntry,
  DagNode,
  DagExecution,
  WihInfo,
} from './LiveExecutionMonitor';

export type {
  ToolQuestionDisplayProps,
} from './AskUserQuestion';
