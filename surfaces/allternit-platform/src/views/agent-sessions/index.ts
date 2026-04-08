/**
 * Mode-Specific Agent Session Views
 * 
 * Each mode has its own agent session experience:
 * - Chat Mode: Conversation-based agent sessions
 * - Cowork Mode: Task-based agent workflows with scheduling
 * - Code Mode: Agent Development Environment (ADE)
 * - Browser Mode: Agent-driven browser sessions
 * 
 * All views use consistent Allternit dark obsidian theming.
 * 
 * @module agent-session-views
 */

export { ChatModeAgentSession } from './ChatModeAgentSession';
export { CoworkModeAgentTasks } from './CoworkModeAgentTasks';
export { CodeModeADE } from './CodeModeADE';
export { BrowserModeAgentSession } from './BrowserModeAgentSession';
export { AgentSessionLayout } from './AgentSessionLayout';

export type {
  ChatModeAgentSessionProps,
  CoworkModeAgentTasksProps,
  CodeModeADEProps,
  BrowserModeAgentSessionProps,
  AgentSessionMode,
  AgentSessionState,
  AgentSessionMessage,
  AgentSessionCanvas,
  AgentToolCall,
  AgentAttachment,
  AgentTask,
} from './types';
