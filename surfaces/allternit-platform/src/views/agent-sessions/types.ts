/**
 * Agent Session View Types
 * 
 * @module agent-session-types
 */

import type { AgentMode } from '@/design/allternit.tokens';

export type AgentSessionMode = 'chat' | 'cowork' | 'code' | 'browser';

export interface BaseAgentSessionProps {
  /** Session identifier */
  sessionId?: string;
  /** Agent identifier */
  agentId?: string;
  /** Mode-specific accent color */
  mode: AgentSessionMode;
  /** Callback when session closes */
  onClose?: () => void;
  /** Initial layout split (0-100) */
  defaultLayout?: number[];
  /** Whether to show the workbench rail */
  showWorkbench?: boolean;
}

// Chat Mode: Conversation-focused
export interface ChatModeAgentSessionProps extends BaseAgentSessionProps {
  mode: 'chat';
  /** Enable streaming responses */
  enableStreaming?: boolean;
  /** Show suggested prompts */
  showSuggestions?: boolean;
  /** Conversation context */
  context?: string;
}

// Cowork Mode: Task and scheduling-focused
export interface CoworkModeAgentTasksProps extends BaseAgentSessionProps {
  mode: 'cowork';
  /** Initial task view */
  initialView?: 'tasks' | 'schedule' | 'runs' | 'drafts';
  /** Project identifier */
  projectId?: string;
  /** Show scheduling panel */
  showScheduler?: boolean;
  /** Task filter */
  taskFilter?: 'all' | 'pending' | 'running' | 'completed';
}

// Browser Mode: Agent-driven browsing
export interface BrowserModeAgentSessionProps extends BaseAgentSessionProps {
  mode: 'browser';
  /** Initial URL */
  initialUrl?: string;
  /** Show browser controls */
  showControls?: boolean;
  /** Agent can interact with page */
  enableInteraction?: boolean;
  /** Recording mode */
  recording?: boolean;
  /** Show DOM inspector */
  showInspector?: boolean;
}

export interface AgentSessionState {
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;
  messages: AgentSessionMessage[];
  canvases: AgentSessionCanvas[];
  metadata: Record<string, unknown>;
}

export interface AgentSessionMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: AgentToolCall[];
  attachments?: AgentAttachment[];
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
}

export interface AgentAttachment {
  id: string;
  type: 'image' | 'file' | 'code' | 'link';
  name: string;
  url?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentSessionCanvas {
  id: string;
  type: 'code' | 'markdown' | 'image' | 'browser' | 'diagram';
  title: string;
  content: string;
  language?: string;
  isPinned?: boolean;
}

export interface AgentTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'scheduled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  agentId?: string;
  cronExpression?: string;
  recurrence?: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
}
