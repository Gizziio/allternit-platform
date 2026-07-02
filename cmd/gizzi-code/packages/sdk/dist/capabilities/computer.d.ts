import type { Tool } from '../harness/types.js';
import { AllternitClient } from '../../dist/gen/allternit-client.js';
export declare const COMPUTER_TOOL: Tool;
export declare class ComputerCapability {
    private client;
    private gatewayUrl;
    constructor(client: AllternitClient, gatewayUrl?: string);
    getTool(): Tool;
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
//# sourceMappingURL=computer.d.ts.map