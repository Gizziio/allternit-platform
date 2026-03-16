export type LineKind = "text" | "progress" | "badge";

export interface TelemetryLineBase {
  type: LineKind;
  label: string;
  scope?: "overview" | "detail";
}

export interface TextLine extends TelemetryLineBase {
  type: "text";
  value: string;
  color?: string;
  subtitle?: string;
}

export interface ProgressLine extends TelemetryLineBase {
  type: "progress";
  used: number;
  limit: number;
  format: "percent" | "dollars" | "count";
  resetsAt?: string;
  periodDurationMs?: number;
  color?: string;
}

export interface BadgeLine extends TelemetryLineBase {
  type: "badge";
  text: string;
  color?: string;
  subtitle?: string;
}

export type TelemetryLine = TextLine | ProgressLine | BadgeLine;

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  cached?: number;
}

export interface ModelUsageSummary {
  messages: number;
  toolCalls: number;
  lastUsedAt: number;
  avgLatencyMs?: number;
}

export interface ToolUsageEntry {
  name: string;
  count: number;
  lastUsedAt: number;
}

export type TimelineEntryType = "message" | "ledger" | "receipt" | "status";

export interface TimelineEntry {
  timestamp: number;
  label: string;
  type: TimelineEntryType;
  speaker?: string;
  detail?: string;
}

export interface TelemetrySnapshot {
  sessionId: string;
  providerId?: string;
  providerName?: string;
  status: "active" | "idle" | "complete" | "error";
  timestamp: number;
  tokenUsage?: TokenUsage;
  cost?: number;
  toolUsage?: ToolUsageEntry[];
  modelUsage?: Record<string, ModelUsageSummary>;
  timeline?: TimelineEntry[];
  lines?: TelemetryLine[];
  metadata?: Record<string, unknown>;
}

export interface SessionDuration {
  startedAt: number;
  lastActivityAt: number;
  minutes: number;
}
