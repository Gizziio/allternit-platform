// packages/executor-core/src/executor.interface.ts

export interface Executor {
  execute(run: ParallelRun): Promise<ExecutionResult>;
  pollStatus(runId: string): Promise<ExecutionStatus>;
  cancel(runId: string): Promise<void>;
  streamUpdates?(runId: string): AsyncIterable<ExecutionUpdate>;
}

export interface ParallelRun {
  runId: string;
  goal: string;
  snapshotId?: string; // Optional depending on backend
  variants: Variant[];
  verificationProfile?: VerificationProfile;
  createdAt: string;
  backend: ParallelExecutionBackend;
}

export interface Variant {
  variantId: string;
  model: string; // e.g., 'claude-sonnet', 'gpt-4', 'gemini-pro', etc.
  agentType: string; // e.g., 'code', 'research', 'analysis'
  params: Record<string, any>;
  priority?: number;
}

export interface VerificationProfile {
  tests?: boolean;
  linting?: boolean;
  typechecking?: boolean;
  customChecks?: string[];
}

export type ParallelExecutionBackend = 'local' | 'selfhosted' | 'superconductor';

export interface ExecutionResult {
  runId: string;
  status: 'completed' | 'failed' | 'cancelled' | 'partial';
  results: VariantResult[];
  createdAt: string;
  completedAt?: string;
}

export interface VariantResult {
  variantId: string;
  status: 'completed' | 'failed' | 'timeout';
  output?: string;
  previewUrl?: string;
  diff?: string;
  verificationResults?: VerificationResult[];
  error?: string;
}

export interface ExecutionStatus {
  runId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  activeVariants: number;
  completedVariants: number;
  totalVariants: number;
  updatedAt: string;
}

export interface ExecutionUpdate {
  runId: string;
  variantId?: string;
  eventType: 'started' | 'progress' | 'preview-ready' | 'diff-ready' | 'verification-result' | 'completed' | 'error';
  payload: any;
  timestamp: string;
}

export interface VerificationResult {
  checkType: 'test' | 'lint' | 'typecheck' | 'custom';
  status: 'passed' | 'failed' | 'skipped';
  details?: string;
  error?: string;
}