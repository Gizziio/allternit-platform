import type { ToolDefinition } from './types.js';
export type CodeExecutionLanguage = 'python' | 'python3' | 'node' | 'javascript' | 'bash' | 'sh' | 'rust' | string;
export interface CodeExecutionArtifact {
    name: string;
    content_type?: string;
    content: string;
}
export interface CodeExecutionResult {
    stdout: string;
    stderr: string;
    exit_code: number;
    success: boolean;
    artifacts?: CodeExecutionArtifact[];
}
export interface CodeExecutionRequest {
    language: CodeExecutionLanguage;
    code: string;
    timeout_seconds?: number;
    dependencies?: string[];
}
export interface CodeExecutionRunner {
    execute(request: CodeExecutionRequest): Promise<CodeExecutionResult>;
}
export interface CodeExecutionOptions {
    runner?: CodeExecutionRunner;
}
export declare class CodeExecutionTool {
    private readonly runner;
    constructor(options?: CodeExecutionOptions);
    definition(): ToolDefinition;
}
