/**
 * Subprocess Mode
 * Spawns external CLI tools as AI backends
 */
import type { SubprocessConfig, StreamRequest, HarnessStreamChunk, Message } from '../types';
/**
 * Stream from subprocess CLI tool
 */
export declare function streamFromSubprocess(config: SubprocessConfig, request: StreamRequest): AsyncGenerator<HarnessStreamChunk>;
/**
 * Execute subprocess without streaming (for non-streaming API)
 */
export declare function executeSubprocess(config: SubprocessConfig, messages: Message[], signal?: AbortSignal): Promise<{
    content: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}>;
//# sourceMappingURL=subprocess.d.ts.map