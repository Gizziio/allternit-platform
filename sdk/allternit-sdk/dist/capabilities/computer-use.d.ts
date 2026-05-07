import type { ToolDefinition } from '../tools/types.js';
export declare const COMPUTER_USE_TOOL: ToolDefinition;
export declare class ComputerUseCapability {
    private gatewayUrl;
    constructor(gatewayUrl?: string);
    getTool(): ToolDefinition;
    execute(args: {
        action: string;
        text?: string;
        coordinate?: [number, number];
    }): Promise<string>;
}
