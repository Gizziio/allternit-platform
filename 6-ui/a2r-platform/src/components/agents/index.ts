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
export { AgentTestingPlayground } from './AgentTestingPlayground';
export { SessionAnalyticsDashboard } from './SessionAnalyticsDashboard';
export { SwarmOrchestrator } from './SwarmOrchestrator';
export { LiveExecutionMonitor } from './LiveExecutionMonitor';

// Context & Tool Components
export { AgentContextStrip } from './AgentContextStrip';
export { ToolCallVisualization } from './ToolCallVisualization';
export { ToolConfirmation } from './ToolConfirmation';
export { AskUserQuestion } from './AskUserQuestion';
export { AskUserQuestionWizard } from './AskUserQuestionWizard';
export { CronJobWizard } from './CronJobWizard';

// Re-export types
export type {
  AgentCreationWizardProps,
  AgentTestingPlaygroundProps,
  SessionAnalyticsDashboardProps,
  SwarmOrchestratorProps,
  LiveExecutionMonitorProps,
} from './LiveExecutionMonitor';
