import type { ExecuteOptions, ExecuteResult, IEnvironment } from './types.js';
export declare class HostEnvironment implements IEnvironment {
    execute(command: string, args?: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
}
