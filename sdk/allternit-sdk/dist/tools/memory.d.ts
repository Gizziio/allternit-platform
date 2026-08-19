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
export declare class MemoryTool {
    private readonly store;
    constructor(options?: MemoryToolOptions);
    definition(): ToolDefinition;
}
