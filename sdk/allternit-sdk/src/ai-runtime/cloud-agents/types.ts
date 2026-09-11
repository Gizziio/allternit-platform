export type CloudSessionStatus =
  | "idle"
  | "running"
  | "waiting"
  | "failed"
  | "archived";

export interface CloudComputer {
  kind: "none" | "sandbox" | "local";
  id?: string | null;
}

export interface CloudSessionBudget {
  max_tokens?: number;
  max_turns?: number;
  max_tool_calls?: number;
  tokens_used?: number;
  turns_used?: number;
  tool_calls_used?: number;
}

export interface CloudSession {
  id: string;
  agent_id?: string | null;
  name?: string | null;
  status: CloudSessionStatus;
  metadata: Record<string, unknown>;
  budget: CloudSessionBudget;
  computer: CloudComputer;
  brain_id?: string | null;
  vault_ids?: string[];
  bot_id?: string | null;
  parent_thread_id?: string | null;
  permission?: "always_allow" | "always_ask" | "auto" | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

export type CloudSessionAgentRef =
  | string
  | { id: string; version?: number }
  | {
      model: string;
      instructions?: string;
      tools?: unknown[];
      name?: string;
    };

export interface CreateCloudSessionOptions {
  /** Existing agent id, versioned reference, or an inline agent definition. */
  agent?: CloudSessionAgentRef;
  /** Packaged bot id (BA-8). Used as the session agent when `agent` is omitted. */
  botId?: string;
  computer?: CloudComputer;
  /** Initial user message (plain string or `{ type: "user.message", content }`). */
  input?: string | { type: "user.message"; content: string };
  vaultIds?: unknown[];
  budget?: {
    max_tokens?: number;
    max_turns?: number;
    max_tool_calls?: number;
  };
  metadata?: Record<string, unknown>;
  brainId?: string | null;
  parent_thread_id?: string;
  permission?: "always_allow" | "always_ask" | "auto";
}

export interface BotProfile {
  displayName: string;
  tagline?: string;
  welcomeMessage?: string;
  starterPrompts?: string[];
  accentColor?: string;
  groupChatEnabled?: boolean;
  botCategory?: string;
}

export interface BotAgent {
  id: string;
  name: string;
  description?: string;
  isBot?: boolean;
  botProfile?: BotProfile;
  model?: string;
  provider?: string;
  status?: string;
  brain?: unknown;
  brainId?: string;
}

export interface CreateBotOptions {
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  botProfile: BotProfile;
}

export type SendCloudSessionEvent =
  | { type: "user.message"; content: string }
  | { type: "user.interrupt"; data?: Record<string, unknown> }
  | {
      type: "user.tool_result";
      content?: unknown;
      data?: Record<string, unknown>;
    };

export type CloudSessionEventType =
  | "session.created"
  | "session.running"
  | "session.idle"
  | "session.waiting"
  | "session.failed"
  | "computer.pending"
  | "computer.ready"
  | "computer.failed"
  | "turn.started"
  | "turn.completed"
  | "turn.failed"
  | "agent.message"
  | "agent.tool_use"
  | "agent.tool_result";

export interface CloudTurn {
  id: string;
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at?: string | null;
}

export interface CloudSessionEvent {
  id: string;
  sequence?: number;
  type: CloudSessionEventType;
  session_id: string;
  created_at: string;
  data: Record<string, unknown>;
}
