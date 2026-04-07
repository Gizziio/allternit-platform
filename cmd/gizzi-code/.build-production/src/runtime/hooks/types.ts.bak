export type HookEventName = 
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "ToolError"
  | "SessionStart"
  | "SessionEnd";

export interface HookEvent<T = any> {
  name: HookEventName;
  timestamp: number;
  sessionId: string;
  payload: T;
}

export interface HookResponse {
  decision: "allow" | "deny";
  reason?: string;
  modifiedPayload?: any;
}
