import type { ToolDefinition } from '../tools/types.js';
interface BrainClientLike {
    memory: {
        query(args: {
            query: {
                query: string;
                chunk_type?: string;
                limit?: number;
            };
        }): Promise<{
            data?: Array<{
                chunk_type?: string;
                content?: string;
                source?: string;
            }>;
        }>;
    };
}
export declare const BRAIN_TOOL: ToolDefinition;
export declare class BrainCapability {
    private client;
    constructor(client: BrainClientLike);
    getTool(): ToolDefinition;
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
export {};
