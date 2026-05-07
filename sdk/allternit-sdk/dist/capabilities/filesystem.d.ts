import type { ToolDefinition } from '../tools/types.js';
import type { IEnvironment } from '../environment/types.js';
export declare const FILESYSTEM_TOOLS: ToolDefinition[];
export declare class FilesystemCapability {
    private environment;
    constructor(environment: IEnvironment);
    getTools(): ToolDefinition[];
    execute(name: string, args: any): Promise<string>;
}
