export interface ComputerUseRequest {
  mode: 'intent' | 'direct' | 'assist';
  task: string;
  session_id?: string;
  run_id?: string;
  target_scope?: 'browser' | 'desktop' | 'hybrid' | 'auto';
  options?: Record<string, unknown>;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ComputerUseResponse {
  run_id: string;
  session_id: string;
  status: string;
  mode: string;
  target_scope: string;
  summary?: string;
  result?: Record<string, unknown> | null;
  error?: string | null;
}

export interface WatchOptions {
  runId: string;
  signal?: AbortSignal;
}

export interface WatchRunOptions {
  intervalMs?: number;
  signal?: AbortSignal;
}

export interface WaitForRunOptions {
  intervalMs?: number;
  signal?: AbortSignal;
}

export interface ApprovalOptions {
  approver_id?: string;
  comment?: string;
  [key: string]: unknown;
}

export interface CancelOptions {
  approver_id?: string;
  comment?: string;
  [key: string]: unknown;
}

export interface ResumeOptions {
  approver_id?: string;
  comment?: string;
  [key: string]: unknown;
}

export interface RequestOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export declare class AllternitComputerUseClient {
  readonly baseUrl: string;
  readonly fetch: typeof fetch;
  readonly headers: Record<string, string>;
  constructor(config?: RequestOptions);
  execute(request: ComputerUseRequest): Promise<ComputerUseResponse>;
  watch(options: WatchOptions): Promise<Response>;
  getReceipts(runId: string): Promise<unknown>;
  getSnapshot(runId: string): Promise<unknown>;
  approveRun(runId: string, options?: ApprovalOptions): Promise<unknown>;
  denyRun(runId: string, options?: ApprovalOptions): Promise<unknown>;
  cancelRun(runId: string, options?: CancelOptions): Promise<unknown>;
  pauseRun(runId: string, options?: CancelOptions): Promise<unknown>;
  resumeRun(runId: string, options?: ResumeOptions): Promise<unknown>;
  watchRun(runId: string, options?: WatchRunOptions): AsyncGenerator<unknown, void, unknown>;
  waitForRun(runId: string, options?: WaitForRunOptions): Promise<unknown>;
}

export declare function createComputerUseClient(config?: RequestOptions): AllternitComputerUseClient;
export declare function resolveComputerUseBaseUrl(url?: string): string;

export type EngineEventBatch = unknown;
export type EngineEventRecord = unknown;
export type EngineExecutionRequestInput = ComputerUseRequest;
export type EngineReceiptsResponse = unknown;
export type EngineRunSnapshot = unknown;
