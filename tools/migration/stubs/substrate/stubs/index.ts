// STUB IMPLEMENTATIONS FOR MIGRATED FUNCTIONALITY
// These stubs maintain API contracts while allowing for gradual implementation

// 0-substrate/stubs/index.ts
export * from './logger.stub';
export * from './config.stub';

// 0-substrate/stubs/logger.stub.ts
import type { AllternitLogger } from '../types/contracts';

export class StubLogger implements AllternitLogger {
  info(message: string, meta?: any): void {
    console.log(`[INFO] ${message}`, meta || '');
  }

  warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${message}`, meta || '');
  }

  error(message: string, meta?: any): void {
    console.error(`[ERROR] ${message}`, meta || '');
  }

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, meta || '');
    }
  }
}

// 0-substrate/stubs/config.stub.ts
import type { AllternitConfig } from '../types/contracts';

export class StubConfig implements AllternitConfig {
  private config: Record<string, any> = {};

  constructor(initialConfig?: Record<string, any>) {
    this.config = { ...initialConfig };
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  set(key: string, value: any): void {
    this.config[key] = value;
  }

  merge(other: AllternitConfig): void {
    this.config = { ...this.config, ...other };
  }

  getAll(): Record<string, any> {
    return { ...this.config };
  }
}