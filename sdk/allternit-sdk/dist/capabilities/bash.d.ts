import type { ToolDefinition } from '../tools/types.ts';
import type { IEnvironment } from '../environment/types.ts';
export declare const BASH_TOOL: ToolDefinition;
export declare class BashCapability {
    private environment;
    constructor(environment: IEnvironment);
    getTool(): ToolDefinition;
}
