/**
 * Simple logger for main process
 */

export function createLogger(namespace: string) {
  return {
    info: (...args: any[]) => {
      console.log(`[${namespace}]`, ...args);
    },
    error: (...args: any[]) => {
      console.error(`[${namespace}]`, ...args);
    },
    warn: (...args: any[]) => {
      console.warn(`[${namespace}]`, ...args);
    },
    debug: (...args: any[]) => {
      if (process.env.DEBUG) {
        console.log(`[${namespace}] [debug]`, ...args);
      }
    },
  };
}
