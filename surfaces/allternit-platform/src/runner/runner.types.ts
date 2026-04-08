export type RunState = "idle" | "received" | "thinking" | "tooling" | "writing" | "complete" | "error" | "cancelled";
export interface RunnerRun { id: string; prompt: string; state: RunState; startedAt: number; output: string; }

export type TraceStatus = "running" | "success" | "error";
export type TraceKind = "info" | "tool" | "system" | "error" | "success";

export interface RunnerTraceEntry {
  id: string;
  timestamp: number;
  kind: TraceKind;
  title: string;
  detail?: string;
  status?: TraceStatus;
}
