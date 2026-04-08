/**
 * Simple module logger for AI tools and services
 * 
 * Log levels:
 * - debug: Only shown when VITE_LOG_LEVEL=debug
 * - info: Shown in development by default
 * - warn: Always shown
 * - error: Always shown
 */

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  debug: (context: LogContext | string, message?: string) => void;
  info: (context: LogContext | string, message?: string) => void;
  warn: (context: LogContext | string, message?: string) => void;
  error: (context: LogContext | string, message?: string) => void;
}

// Check if debug logging is enabled
// Use process.env.NODE_ENV instead of import.meta.env (Vite-only) for Next.js compatibility
const isDev = process.env.NODE_ENV !== 'production';
const isDebugEnabled = isDev && process.env.NEXT_PUBLIC_LOG_LEVEL === 'debug';
const isInfoEnabled = isDev;

export function createModuleLogger(module: string): Logger {
  const prefix = `[${module}]`;

  return {
    debug: (context: LogContext | string, message?: string) => {
      if (!isDebugEnabled) return;
      if (typeof context === 'string') {
        console.debug(`${prefix} ${context}`);
      } else {
        console.debug(`${prefix} ${message || ''}`, context);
      }
    },
    info: (context: LogContext | string, message?: string) => {
      if (!isInfoEnabled) return;
      if (typeof context === 'string') {
        console.info(`${prefix} ${context}`);
      } else {
        console.info(`${prefix} ${message || ''}`, context);
      }
    },
    warn: (context: LogContext | string, message?: string) => {
      if (typeof context === 'string') {
        console.warn(`${prefix} ${context}`);
      } else {
        console.warn(`${prefix} ${message || ''}`, context);
      }
    },
    error: (context: LogContext | string, message?: string) => {
      if (typeof context === 'string') {
        console.error(`${prefix} ${context}`);
      } else {
        console.error(`${prefix} ${message || ''}`, context);
      }
    },
  };
}

// Default logger instance
export const logger = createModuleLogger('app');
