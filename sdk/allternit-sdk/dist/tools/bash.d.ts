import type { ToolDefinition } from './types.js';
export interface BashResult {
    stdout: string;
    stderr: string;
    exit_code: number;
    success: boolean;
}
export interface BashRunner {
    run(args: {
        command: string;
        timeout?: number;
        restart?: boolean;
    }): Promise<BashResult>;
}
export interface BashToolOptions {
    runner?: BashRunner;
}
export declare class BashTool {
    private readonly runner;
    constructor(options?: BashToolOptions);
    definition(): ToolDefinition;
}
