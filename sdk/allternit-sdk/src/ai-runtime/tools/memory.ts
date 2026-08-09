import type { ToolDefinition } from './types.js';

export type MemoryOperation = 'read' | 'write' | 'delete';

export interface MemoryValue {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface MemoryStore {
  read(key: string): Promise<MemoryValue | null>;
  write(key: string, value: unknown): Promise<MemoryValue>;
  delete(key: string): Promise<boolean>;
}

export interface MemoryToolOptions {
  store?: MemoryStore;
}

export class MemoryTool {
  private readonly store: MemoryStore;

  constructor(options: MemoryToolOptions = {}) {
    this.store = options.store ?? inMemoryStore();
  }

  definition(): ToolDefinition {
    return {
      name: 'memory',
      description: 'Read, write, or delete session-scoped memory values by key.',
      input_schema: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['read', 'write', 'delete'], description: 'Memory operation' },
          key: { type: 'string', description: 'Memory key' },
          value: { description: 'Value to write (required for write)' },
        },
        required: ['operation', 'key'],
      },
      metadata: { category: 'system' },
      execute: async (args: { operation: MemoryOperation; key: string; value?: unknown }) => {
        const operation = requiredOperation(args.operation);
        const key = requiredString(args.key, 'key');

        if (operation === 'read') {
          const entry = await this.store.read(key);
          return entry ?? { key, value: null, updated_at: new Date().toISOString() };
        }

        if (operation === 'write') {
          if (!('value' in args)) throw new Error('value is required for write');
          return this.store.write(key, args.value);
        }

        const deleted = await this.store.delete(key);
        return { key, deleted };
      },
    };
  }
}

function inMemoryStore(): MemoryStore {
  const state = new Map<string, MemoryValue>();
  return {
    read: async (key) => state.get(key) ?? null,
    write: async (key, value) => {
      const entry: MemoryValue = { key, value, updated_at: new Date().toISOString() };
      state.set(key, entry);
      return entry;
    },
    delete: async (key) => state.delete(key),
  };
}

function requiredString(value: string | undefined, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function requiredOperation(value: string | undefined): MemoryOperation {
  if (value === 'read' || value === 'write' || value === 'delete') return value;
  throw new Error("operation must be 'read', 'write', or 'delete'");
}
