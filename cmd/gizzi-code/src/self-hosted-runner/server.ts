/**
 * Minimal HTTP server for health, status, and job management endpoints.
 *
 * Uses node:http — no frameworks.
 *
 * Endpoints:
 *   GET  /health         — runner status payload
 *   GET  /jobs           — currently running jobs
 *   POST /cancel/:jobId  — cancel a running job
 */

import { createServer, type ServerResponse, type Server } from 'node:http'
import type { HealthPayload, RunnerStatus } from './types.js'
import type { JobExecutor } from './job-executor.js'

export interface HealthServerOptions {
  port: number
  runnerName: string
  labels: string[]
  maxConcurrentJobs: number
  startedAt: number
  getStatus: () => RunnerStatus
  executor: JobExecutor
}

/** Write a JSON response. */
function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/** Match a route and extract path parameters. */
function matchRoute(
  method: string,
  pathname: string,
  routeMethod: string,
  routePattern: string,
): Record<string, string> | null {
  if (method !== routeMethod) return null

  const routeParts = routePattern.split('/')
  const pathParts = pathname.split('/')
  if (routeParts.length !== pathParts.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i].startsWith(':')) {
      params[routeParts[i].slice(1)] = pathParts[i]
    } else if (routeParts[i] !== pathParts[i]) {
      return null
    }
  }
  return params
}

export function createHealthServer(options: HealthServerOptions): Server {
  const { port, runnerName, labels, maxConcurrentJobs, startedAt, getStatus, executor } = options

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    const method = req.method?.toUpperCase() ?? 'GET'

    // GET /health
    if (matchRoute(method, pathname, 'GET', '/health')) {
      const payload: HealthPayload = {
        status: getStatus(),
        runnerName,
        labels,
        activeJobs: executor.runningCount,
        maxConcurrentJobs,
        uptimeMs: Date.now() - startedAt,
      }
      sendJson(res, 200, payload)
      return
    }

    // GET /jobs
    if (matchRoute(method, pathname, 'GET', '/jobs')) {
      sendJson(res, 200, { jobs: executor.getActiveJobs() })
      return
    }

    // POST /cancel/:jobId
    const cancelParams = matchRoute(method, pathname, 'POST', '/cancel/:jobId')
    if (cancelParams) {
      const jobId = cancelParams.jobId
      if (!jobId) {
        sendJson(res, 400, { error: 'missing jobId' })
        return
      }
      const found = executor.cancel(jobId)
      if (found) {
        sendJson(res, 200, { cancelled: true, jobId })
      } else {
        sendJson(res, 404, { error: `job ${jobId} not found` })
      }
      return
    }

    // Fallback: 404
    sendJson(res, 404, { error: 'not found' })
  })

  server.listen(port, () => {
    console.log(`[server] health server listening on http://0.0.0.0:${port}`)
  })

  server.on('error', (err) => {
    console.error(`[server] HTTP server error: ${err.message}`)
  })

  return server
}
