/**
 * Groq Provider
 * Groq Cloud API integration (ultra-fast inference)
 */
import { StreamRequest, HarnessStreamChunk } from '../../harness/types.js';
export interface GroqConfig {
    apiKey: string;
    baseURL?: string;
}
export declare class AllternitGroq {
    private config;
    private baseURL;
    constructor(config: GroqConfig);
    stream(request: StreamRequest): AsyncGenerator<HarnessStreamChunk>;
    complete(request: StreamRequest): Promise<{
        content: string;
    }>;
}
export default AllternitGroq;
