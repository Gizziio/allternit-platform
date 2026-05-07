export interface ExecuteResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
export interface ExecuteOptions {
    workingDir?: string;
    env?: Record<string, string>;
    timeout?: number;
}
export interface IEnvironment {
    execute(command: string, args?: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
}
