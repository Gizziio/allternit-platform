/**
 * Agent Components Index
 * 
 * Comprehensive suite of A2R-native agent UI components.
 * All components follow A2R design system with:
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
} from '@/design/a2r.tokens';

// Agent Management
export { AgentCreationWizard } from './AgentCreationWizard';
export { AgentCreationWizardEnhanced } from './AgentCreationWizardEnhanced';
export { AgentCreationWizardWithTemplates } from './AgentCreationWizardWithTemplates';
export { AgentHubModal } from './AgentHubModal';
export { AgentSelectorWizard } from './AgentSelectorWizard';
export { AgentTestingPlayground } from './AgentTestingPlayground';
export { SessionAnalyticsDashboard } from './SessionAnalyticsDashboard';
export { SwarmOrchestrator } from './SwarmOrchestrator';
export { LiveExecutionMonitor } from './LiveExecutionMonitor';

// Context & Tool Components
export { AgentContextStrip } from './AgentContextStrip';
export { ToolCallVisualization, useToolCallAccent } from './ToolCallVisualization';
export { ToolConfirmation } from './ToolConfirmation';
export { AskUserQuestion, ToolQuestionDisplay } from './AskUserQuestion';
export { AskUserQuestionWizard } from './AskUserQuestionWizard';
export { CronJobWizard } from './CronJobWizard';

// Re-export types from individual components
export type {
  AgentCreationWizardProps,
} from './AgentCreationWizard';

export type {
  AgentCreationWizardWithTemplatesProps,
} from './AgentCreationWizardWithTemplates';

export type {
  AgentHubModalProps,
} from './AgentHubModal';

export type {
  AgentSelectorWizardProps,
} from './AgentSelectorWizard';

export type {
  AgentCreationWizardProps as AgentCreationWizardEnhancedProps,
  CharacterLayerConfig,
  CharacterIdentity,
  AgentSetup,
  Temperament,
  RoleCardConfig,
  RoleHardBan,
  HardBanCategory,
  VoiceConfigLayer,
  RelationshipConfig,
  RelationshipPair,
  ProgressionConfig,
  ProgressionStatRule,
  UnlockableAbility,
  AvatarConfig,
  MascotConfig,
  MascotTemplate,
  EyeStyle,
  BodyShape,
  MascotAccessory,
  AnimationSet,
  MascotEmotion,
  AvatarTemplate,
  WorkspaceDocuments,
  AgentType,
  ModelProvider,
  ProfessionalAvatar,
} from './AgentCreationWizardEnhanced';

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
