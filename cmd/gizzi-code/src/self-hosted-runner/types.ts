/**
 * Type definitions for the Gizzi Code self-hosted runner.
 */

/** Runner configuration sourced from env vars and/or config file. */
export interface RunnerConfig {
  apiUrl: string
  runnerToken: string
  runnerName: string
  maxConcurrentJobs: number
  workDir: string
  labels: string[]
  pollIntervalMs: number
  healthPort: number
}

/** A job dispatched from the Allternit API to this runner. */
export interface AgentJob {
  id: string
  type: 'agent-task' | 'code-generation' | 'code-review'
  prompt: string
  workingDirectory?: string
  timeout?: number
  environment?: Record<string, string>
}

/** Result reported back to the API after job execution. */
export interface JobResult {
  jobId: string
  status: 'completed' | 'failed' | 'cancelled' | 'timeout'
  output: string
  exitCode: number
  durationMs: number
}

/** Current runner status surfaced via the health endpoint. */
export type RunnerStatus = 'idle' | 'busy' | 'draining' | 'stopped'

/** State of a single running job. */
export interface JobState {
  job: AgentJob
  startedAt: number
  pid: number | null
  cancelled: boolean
}

/** Response from the API when claiming a job. */
export interface ClaimJobResponse {
  claimed: boolean
  job?: AgentJob
}

/** Response from runner registration. */
export interface RegistrationResponse {
  runnerId: string
  token?: string
  expiresAt?: string
}

/** Health check payload returned by GET /health. */
export interface HealthPayload {
  status: RunnerStatus
  runnerName: string
  labels: string[]
  activeJobs: number
  maxConcurrentJobs: number
  uptimeMs: number
}
