export type AgentRole = 'coding' | 'research' | 'general';

export interface AgentTurn {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface ToolResult {
  callId: string;
  output: string;
  success: boolean;
}

export interface OrchestrationContext {
  sessionId: string;
  agentId: string;
  role: AgentRole;
  history: AgentTurn[];
  maxTurns?: number;
}

export interface StreamEvent {
  type: 'delta' | 'tool-start' | 'tool-end' | 'done' | 'error';
  payload: any;
}
