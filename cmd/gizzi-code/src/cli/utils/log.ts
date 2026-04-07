/**
 * CLI logging utilities
 */

import { log as runtimeLog } from '../../runtime/util/log.js'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export function log(level: LogLevel, message: string, ...args: unknown[]): void {
  runtimeLog(level, message, ...args)
}

export function debug(message: string, ...args: unknown[]): void {
  runtimeLog('debug', message, ...args)
}

export function info(message: string, ...args: unknown[]): void {
  runtimeLog('info', message, ...args)
}

export function warn(message: string, ...args: unknown[]): void {
  runtimeLog('warn', message, ...args)
}

export function error(message: string, ...args: unknown[]): void {
  runtimeLog('error', message, ...args)
}

export function logError(message: string, ...args: unknown[]): void {
  runtimeLog('error', message, ...args)
}

export function success(message: string): void {
  console.log(`✓ ${message}`)
}

export function fail(message: string): void {
  console.error(`✗ ${message}`)
}

export function createLogger(prefix: string) {
  return {
    debug: (msg: string, ...args: unknown[]) => debug(`[${prefix}] ${msg}`, ...args),
    info: (msg: string, ...args: unknown[]) => info(`[${prefix}] ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => warn(`[${prefix}] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => error(`[${prefix}] ${msg}`, ...args),
  }
}

// Spinner/logging for long operations
export function logOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const startTime = Date.now()
  process.stdout.write(`${name}... `)
  
  return operation()
    .then(result => {
      const duration = Date.now() - startTime
      console.log(`done (${duration}ms)`)
      return result
    })
    .catch(err => {
      const duration = Date.now() - startTime
      console.log(`failed (${duration}ms)`)
      throw err
    })
}

// Progress logging
export function logProgress(current: number, total: number, message?: string): void {
  const percent = Math.round((current / total) * 100)
  const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5))
  process.stdout.write(`\r[${bar}] ${percent}% ${message || ''}`)
  if (current === total) {
    process.stdout.write('\n')
  }
}

// Group related logs
export function logGroup(label: string, fn: () => void): void {
  console.group(label)
  fn()
  console.groupEnd()
}

// Default export
export default {
  log,
  debug,
  info,
  warn,
  error,
  success,
  fail,
  createLogger,
  logOperation,
  logProgress,
  logGroup,
}
