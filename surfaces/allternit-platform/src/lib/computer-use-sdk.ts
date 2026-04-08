/**
 * Computer Use SDK - Client for browser automation/computer use engines.
 * Local implementation (workspace package not present).
 */

export interface AllternitComputerUseClient {
  baseUrl: string;
  execute: (request: EngineExecutionRequestInput) => Promise<EngineExecutionResult>;
  watchRun: (runId: string, options?: WatchRunOptions) => AsyncIterable<EngineEventRecord>;
  getRunSnapshot: (runId: string) => Promise<EngineRunSnapshot>;
  getReceipts: (runId: string) => Promise<EngineReceiptsResponse>;
}

export interface EngineExecutionRequestInput {
  engineUrl: string;
  action: string;
  input?: Record<string, unknown>;
  timeout?: number;
  [key: string]: unknown;
}

export interface EngineExecutionResult {
  runId: string;
  status: 'running' | 'completed' | 'error';
  output?: unknown;
  error?: string;
}

export interface EngineEventRecord {
  type: string;
  timestamp: number;
  runId: string;
  data: unknown;
}

export interface EngineEventBatch {
  events: EngineEventRecord[];
}

export interface EngineRunSnapshot {
  runId: string;
  status: string;
  events: EngineEventRecord[];
  createdAt: number;
  updatedAt: number;
}

export interface EngineReceiptsResponse {
  receipts: Array<{ id: string; runId: string; timestamp: number; data: unknown }>;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
}

export interface WatchRunOptions {
  pollInterval?: number;
  timeout?: number;
}

export function createComputerUseClient(options: { baseUrl?: string; apiKey?: string } = {}): AllternitComputerUseClient {
  return {
    baseUrl: options.baseUrl ?? 'http://localhost:8080',
    async execute(request: EngineExecutionRequestInput): Promise<EngineExecutionResult> {
      const response = await fetch(`${this.baseUrl}/api/v1/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      return response.json() as Promise<EngineExecutionResult>;
    },
    async *watchRun(runId: string, _options?: WatchRunOptions): AsyncIterable<EngineEventRecord> {
      const response = await fetch(`${this.baseUrl}/api/v1/runs/${runId}/events`);
      const reader = response.body?.getReader();
      if (!reader) return;
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              yield { ...data, runId } as EngineEventRecord;
            } catch {
              // Skip malformed events
            }
          }
        }
      }
    },
    async getRunSnapshot(runId: string): Promise<EngineRunSnapshot> {
      const response = await fetch(`${this.baseUrl}/api/v1/runs/${runId}`);
      return response.json() as Promise<EngineRunSnapshot>;
    },
    async getReceipts(runId: string): Promise<EngineReceiptsResponse> {
      const response = await fetch(`${this.baseUrl}/api/v1/runs/${runId}/receipts`);
      return response.json() as Promise<EngineReceiptsResponse>;
    },
  };
}

export function resolveComputerUseBaseUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('allternit.platform.computerUse.baseUrl');
  } catch {
    return null;
  }
}
