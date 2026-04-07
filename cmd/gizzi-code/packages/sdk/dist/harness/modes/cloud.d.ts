/**
 * Cloud Mode
 * Routes requests through Allternit's managed API gateway
 */
import type { CloudConfig, StreamRequest, HarnessStreamChunk } from '../types';
/**
 * Stream from Allternit Cloud API
 * POST to https://api.allternit.com/v1/ai/stream
 */
export declare function streamFromCloud(config: CloudConfig, request: StreamRequest): AsyncGenerator<HarnessStreamChunk>;
/**
 * Non-streaming completion via Cloud API
 */
export declare function completeViaCloud(config: CloudConfig, request: StreamRequest): Promise<{
    content: string;
    tool_calls?: Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }>;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}>;
/**
 * List available models from Cloud API
 */
export declare function listCloudModels(config: CloudConfig, provider?: string): Promise<Array<{
    id: string;
    name: string;
    provider: string;
    tier: string;
    capabilities: string[];
}>>;
//# sourceMappingURL=cloud.d.ts.map