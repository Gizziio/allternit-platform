/**
 * Configuration management for the self-hosted runner.
 *
 * Reads settings from environment variables with sensible defaults.
 * Supports an optional JSON config file via --config.
 */

import { readFileSync } from 'node:fs'
import { hostname as osHostname } from 'node:os'
import type { RunnerConfig } from './types.js'
import { ALLTERNIT_GATEWAY_BASE } from '@/shared/constants/allternitGateway'

const DEFAULTS: RunnerConfig = {
  apiUrl: ALLTERNIT_GATEWAY_BASE,
  runnerToken: '',
  runnerName: '',
  maxConcurrentJobs: 2,
  workDir: '/tmp/gizzi-runner-work',
  labels: [],
  pollIntervalMs: 5_000,
  healthPort: 3090,
}

/** Load a JSON config file and merge it with the defaults. */
function loadConfigFile(filePath: string): Partial<RunnerConfig> {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as Partial<RunnerConfig>
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[config] failed to load config file ${filePath}: ${msg}`)
    return {}
  }
}

/** CLI options that extend beyond the core RunnerConfig fields. */
export interface ConfigOverrides extends Partial<RunnerConfig> {
  configFile?: string
}

/** Build the final RunnerConfig from env vars, config file, and CLI overrides. */
export function resolveConfig(overrides: ConfigOverrides = {}): RunnerConfig {
  // 1. Start with defaults.
  let config: RunnerConfig = { ...DEFAULTS }

  // 2. Merge optional config file.
  const configFilePath = overrides.configFile ?? process.env.GIZZI_RUNNER_CONFIG
  if (configFilePath) {
    const fileConfig = loadConfigFile(configFilePath as string)
    config = { ...config, ...fileConfig }
  }

  // 3. Merge environment variables.
  const env = process.env
  if (env.ALLTERNIT_API_URL) config.apiUrl = env.ALLTERNIT_API_URL
  if (env.GIZZI_RUNNER_TOKEN) config.runnerToken = env.GIZZI_RUNNER_TOKEN
  if (env.GIZZI_RUNNER_NAME) config.runnerName = env.GIZZI_RUNNER_NAME
  if (env.GIZZI_RUNNER_LABELS) {
    config.labels = env.GIZZI_RUNNER_LABELS.split(',').map((l) => l.trim()).filter(Boolean)
  }
  if (env.GIZZI_RUNNER_MAX_JOBS) {
    const parsed = parseInt(env.GIZZI_RUNNER_MAX_JOBS, 10)
    if (!Number.isNaN(parsed) && parsed > 0) config.maxConcurrentJobs = parsed
  }
  if (env.GIZZI_RUNNER_WORK_DIR) config.workDir = env.GIZZI_RUNNER_WORK_DIR
  if (env.GIZZI_RUNNER_POLL_INTERVAL) {
    const parsed = parseInt(env.GIZZI_RUNNER_POLL_INTERVAL, 10)
    if (!Number.isNaN(parsed) && parsed >= 1_000) config.pollIntervalMs = parsed
  }
  if (env.GIZZI_RUNNER_HEALTH_PORT) {
    const parsed = parseInt(env.GIZZI_RUNNER_HEALTH_PORT, 10)
    if (!Number.isNaN(parsed) && parsed > 0) config.healthPort = parsed
  }

  // 4. Merge explicit CLI overrides (highest priority).
  config = { ...config, ...overrides }

  // 5. Generate a runner name if none was supplied.
  if (!config.runnerName) {
    config.runnerName = `gizzi-runner-${osHostname()}-${process.pid}`
  }

  return config
}

/** Validate that required config values are present. Returns an error message or null. */
export function validateConfig(config: RunnerConfig): string | null {
  if (!config.apiUrl) return 'apiUrl is required (set ALLTERNIT_API_URL or --api-url)'
  if (!config.runnerToken) return 'runnerToken is required (set GIZZI_RUNNER_TOKEN or --token)'
  if (config.maxConcurrentJobs < 1) return 'maxConcurrentJobs must be at least 1'
  return null
}
