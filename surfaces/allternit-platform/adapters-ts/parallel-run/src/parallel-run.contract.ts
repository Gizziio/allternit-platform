// packages/parallel-run/src/parallel-run.contract.ts

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

export interface ParallelRunConfig {
  backend: ParallelExecutionBackend;
  // Backend-specific configuration
  superconductor?: {
    apiKey?: string;
    endpoint?: string;
    pollingInterval?: number;
  };
  selfhosted?: {
    clusterEndpoint?: string;
    resourceLimits?: ResourceLimits;
  };
  local?: {
    maxConcurrency?: number;
    resourceLimits?: ResourceLimits;
  };
}

export interface ResourceLimits {
  cpu?: string;
  memory?: string;
  maxRuntime?: number; // in seconds
}

export interface ParallelRunResult {
  runId: string;
  status: 'completed' | 'failed' | 'cancelled' | 'partial';
  results: VariantResult[];
  createdAt: string;
  completedAt?: string;
  executionStats: ExecutionStats;
}

export interface VariantResult {
  variantId: string;
  status: 'completed' | 'failed' | 'timeout';
  output?: string;
  previewUrl?: string;
  diff?: string;
  verificationResults?: VerificationResult[];
  error?: string;
  executionTimeMs?: number;
}

export interface VerificationResult {
  checkType: 'test' | 'lint' | 'typecheck' | 'custom';
  status: 'passed' | 'failed' | 'skipped';
  details?: string;
  error?: string;
}

export interface ExecutionStats {
  totalVariants: number;
  completedVariants: number;
  failedVariants: number;
  averageExecutionTimeMs: number;
  totalExecutionTimeMs: number;
  costEstimate?: number; // Estimated cost in USD or credits
}

export interface ParallelRunStatus {
  runId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  activeVariants: number;
  completedVariants: number;
  totalVariants: number;
  updatedAt: string;
  estimatedCompletion?: string;
}