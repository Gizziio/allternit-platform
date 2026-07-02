import type { Tool } from '../harness/types.js';
import { AllternitClient } from '../../dist/gen/allternit-client.js';
export declare const BRAIN_TOOL: Tool;
export declare class BrainCapability {
    private client;
    constructor(client: AllternitClient);
    getTool(): Tool;
    /**
     * Execute the brain query via the Allternit API
     */
    execute(args: {
        query: string;
        type?: string;
        limit?: number;
    }): Promise<string>;
    /**
     * System prompt addendum for Brain usage
     */
    getPromptAddendum(): string;
}
//# sourceMappingURL=brain.d.ts.map