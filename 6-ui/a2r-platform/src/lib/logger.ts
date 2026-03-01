/**
 * Simple module logger for AI tools and services
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

export function createModuleLogger(module: string): Logger {
  const prefix = `[${module}]`;
  
  return {
    debug: (context: LogContext | string, message?: string) => {
      if (typeof context === 'string') {
        console.debug(`${prefix} ${context}`);
      } else {
        console.debug(`${prefix} ${message || ''}`, context);
      }
    },
    info: (context: LogContext | string, message?: string) => {
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
