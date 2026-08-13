/**
 * Runner authentication — registration and token refresh with the Allternit API.
 */

import type { RunnerConfig, RegistrationResponse, AgentJob, ClaimJobResponse, JobResult } from './types.js'

/**
 * Register this runner with the Allternit API.
 * Returns the runner ID and optionally a refreshed token.
 */
export async function registerRunner(config: RunnerConfig): Promise<RegistrationResponse> {
  const url = `${config.apiUrl}/api/runners/register`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.runnerToken}`,
    },
    body: JSON.stringify({
      name: config.runnerName,
      labels: config.labels,
      maxConcurrentJobs: config.maxConcurrentJobs,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `runner registration failed: ${response.status} ${response.statusText} — ${body}`,
    )
  }

  return (await response.json()) as RegistrationResponse
}

/**
 * Poll the API for a pending job this runner can execute.
 * Returns the job if one was claimed, or null if the queue is empty.
 */
export async function pollForJob(config: RunnerConfig): Promise<AgentJob | null> {
  const url = `${config.apiUrl}/api/runners/jobs/poll`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.runnerToken}`,
    },
    body: JSON.stringify({
      runnerName: config.runnerName,
      labels: config.labels,
    }),
  })

  if (response.status === 204) return null
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`poll failed: ${response.status} — ${body}`)
  }

  const data = (await response.json()) as ClaimJobResponse
  return data.claimed && data.job ? data.job : null
}

/**
 * Report job completion (or failure/cancellation) back to the API.
 */
export async function reportJobResult(config: RunnerConfig, result: JobResult): Promise<void> {
  const url = `${config.apiUrl}/api/runners/jobs/${result.jobId}/result`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.runnerToken}`,
    },
    body: JSON.stringify(result),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error(`[auth] failed to report result for job ${result.jobId}: ${response.status} — ${body}`)
  }
}

/**
 * Send a heartbeat to the API so this runner stays marked as active.
 */
export async function sendHeartbeat(config: RunnerConfig): Promise<void> {
  const url = `${config.apiUrl}/api/runners/heartbeat`

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.runnerToken}`,
      },
      body: JSON.stringify({ runnerName: config.runnerName }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[auth] heartbeat failed: ${msg}`)
  }
}
