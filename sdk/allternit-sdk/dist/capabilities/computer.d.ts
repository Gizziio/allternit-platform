import type { ToolDefinition } from '../tools/types.js';
export declare const COMPUTER_TOOL: ToolDefinition;
export declare class ComputerCapability {
    private gatewayUrl;
    constructor(gatewayUrl?: string);
    getTool(): ToolDefinition;
    /**
     * Execute computer action via the Computer Use gateway
     */
    execute(args: {
        action: string;
        text?: string;
        coordinate?: [number, number];
    }): Promise<string>;
    getPromptAddendum(): string;
}
