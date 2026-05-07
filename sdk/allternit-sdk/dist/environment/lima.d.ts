import type { ExecuteOptions, ExecuteResult } from './types.js';
export declare const VM_NAME = "allternit";
export declare class LimaEnvironment {
    /**
     * Execute a command inside the Lima VM
     */
    execute(command: string, args?: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
    getStatus(): Promise<'running' | 'stopped' | 'not-installed' | 'error'>;
}
