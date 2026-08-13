/**
 * Page-agent runtime types shared across surfaces.
 */

export type PageAgentStatus = "idle" | "running" | "completed" | "error";

export type PageAgentActivity =
  | { type: "thinking" }
  | { type: "executing"; tool: string; input?: unknown }
  | { type: "executed"; tool: string; input?: unknown; output?: string; duration?: number }
  | { type: "retrying"; attempt: number; maxAttempts: number }
  | { type: "error"; message: string };

export type PageAgentHistoricalEvent =
  | {
      type: "step";
      stepIndex?: number;
      reflection?: {
        evaluation_previous_goal?: string;
        memory?: string;
        next_goal?: string;
      };
      action?: {
        name: string;
        input: unknown;
        output: string;
      };
      rawRequest?: unknown;
      rawResponse?: unknown;
    }
  | {
      type: "observation";
      content: string;
    }
  | {
      type: "retry";
      message: string;
      attempt: number;
      maxAttempts: number;
    }
  | {
      type: "error";
      message: string;
      rawResponse?: unknown;
    }
  | {
      type: "user_takeover";
      message?: string;
    };

export interface PageAgentSessionRecord {
  id: string;
  sessionId: string | null;
  task: string;
  status: Extract<PageAgentStatus, "completed" | "error">;
  history: PageAgentHistoricalEvent[];
  createdAt: number;
}

export interface PageAgentRunResult {
  success: boolean;
  data?: string;
}

export interface PageAgentSession {
  id: string;
  status: PageAgentStatus;
  goal: string;
  createdAt: number;
  updatedAt: number;
}
