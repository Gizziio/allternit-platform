/**
 * Logging utilities for runtime
 */

import { feature } from 'bun:bundle'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

let currentLogLevel: LogLevel = 'info'
let globalLogFile: string | undefined

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel]
}

// Logger instance interface
export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

// Log class for creating contextual loggers
export class Log {
  private service: string
  private metadata: Record<string, unknown>

  constructor(options: { service: string; metadata?: Record<string, unknown> }) {
    this.service = options.service
    this.metadata = options.metadata || {}
  }

  static create(options: { service: string; metadata?: Record<string, unknown> }): Logger {
    const log = new Log(options)
    return {
      debug: (msg: string, ...args: unknown[]) => log.debug(msg, ...args),
      info: (msg: string, ...args: unknown[]) => log.info(msg, ...args),
      warn: (msg: string, ...args: unknown[]) => log.warn(msg, ...args),
      error: (msg: string, ...args: unknown[]) => log.error(msg, ...args),
    }
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!shouldLog(level)) return

    const timestamp = new Date().toISOString()
    const formatted = `[${timestamp}] [${level.toUpperCase()}] [${this.service}] ${message}`

    if (level === 'error') {
      console.error(formatted, ...args, this.metadata)
    } else if (level === 'warn') {
      console.warn(formatted, ...args, this.metadata)
    } else {
      console.log(formatted, ...args, this.metadata)
    }

    if (globalLogFile && feature('FILE_LOGGING')) {
      try {
        const fs = require('fs')
        const line = `${formatted} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`
        fs.appendFileSync(globalLogFile, line)
      } catch {
        // Ignore file write errors
      }
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args)
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args)
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args)
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args)
  }
}

// Standalone log function
export function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (!shouldLog(level)) return

  const timestamp = new Date().toISOString()
  const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`

  if (level === 'error') {
    console.error(formatted, ...args)
  } else if (level === 'warn') {
    console.warn(formatted, ...args)
  } else {
    console.log(formatted, ...args)
  }
}

export function debug(message: string, ...args: unknown[]): void {
  log('debug', message, ...args)
}

export function info(message: string, ...args: unknown[]): void {
  log('info', message, ...args)
}

export function warn(message: string, ...args: unknown[]): void {
  log('warn', message, ...args)
}

export function error(message: string, ...args: unknown[]): void {
  log('error', message, ...args)
}

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level
}

export function getLogLevel(): LogLevel {
  return currentLogLevel
}

export function setLogFile(path: string): void {
  globalLogFile = path
}

export function createLogger(prefix: string): Logger {
  return Log.create({ service: prefix })
}

// Initialize from environment
if (typeof process !== 'undefined') {
  const envLevel = process.env.LOG_LEVEL as LogLevel
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    currentLogLevel = envLevel
  }
  if (process.env.LOG_FILE) {
    globalLogFile = process.env.LOG_FILE
  }
}

// Default export for compatibility
export default {
  Log,
  log,
  debug,
  info,
  warn,
  error,
  setLogLevel,
  getLogLevel,
  setLogFile,
  createLogger,
}
