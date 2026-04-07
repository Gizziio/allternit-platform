/**
 * Local Mode (Ollama)
 * Routes requests to local Ollama server
 */
import type { LocalConfig, StreamRequest, HarnessStreamChunk } from '../types';
/**
 * Stream from local Ollama server
 */
export declare function streamFromLocal(config: LocalConfig, request: StreamRequest): AsyncGenerator<HarnessStreamChunk>;
/**
 * Non-streaming completion via Ollama
 */
export declare function completeViaLocal(config: LocalConfig, request: StreamRequest): Promise<{
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
 * List available local models from Ollama
 */
export declare function listLocalModels(config: LocalConfig): Promise<Array<{
    name: string;
    modified_at: string;
    size: number;
    digest: string;
}>>;
/**
 * Pull a model from Ollama
 */
export declare function pullLocalModel(config: LocalConfig, modelName: string): Promise<void>;
//# sourceMappingURL=local.d.ts.map