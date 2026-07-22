export type HookEventName = 
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "PermissionRequest"
  | "PermissionResult"
  | "Stop"
  | "StopFailure"
  | "Interrupt"
  | "SessionStart"
  | "SessionEnd"
  | "SubagentStart"
  | "SubagentStop"
  | "PreCompact"
  | "PostCompact"
  | "Notification";

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
  message?: string;
}
