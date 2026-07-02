type LineKind = "text" | "progress" | "badge";

interface TelemetryLineBase {
  type: LineKind;
  label: string;
  scope?: "overview" | "detail";
}

interface TextLine extends TelemetryLineBase {
  type: "text";
  value: string;
  color?: string;
  subtitle?: string;
}

interface ProgressLine extends TelemetryLineBase {
  type: "progress";
  used: number;
  limit: number;
  format: "percent" | "dollars" | "count";
  resetsAt?: string;
  periodDurationMs?: number;
  color?: string;
}

interface BadgeLine extends TelemetryLineBase {
  type: "badge";
  text: string;
  color?: string;
  subtitle?: string;
}

type TelemetryLine = TextLine | ProgressLine | BadgeLine;

interface TokenUsage {
  input: number;
  output: number;
  total: number;
  cached?: number;
}

interface ModelUsageSummary {
  messages: number;
  toolCalls: number;
  lastUsedAt: number;
  avgLatencyMs?: number;
}

interface ToolUsageEntry {
  name: string;
  count: number;
  lastUsedAt: number;
}

type TimelineEntryType = "message" | "ledger" | "receipt" | "status";

interface TimelineEntry {
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

interface SessionDuration {
  startedAt: number;
  lastActivityAt: number;
  minutes: number;
}
