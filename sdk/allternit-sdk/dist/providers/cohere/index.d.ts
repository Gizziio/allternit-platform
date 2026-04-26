/**
 * Cohere Provider
 * Cohere AI API integration
 */
import { StreamRequest, HarnessStreamChunk } from '../../harness/types.js';
export interface CohereConfig {
    apiKey: string;
    baseURL?: string;
}
export declare class AllternitCohere {
    private config;
    private baseURL;
    constructor(config: CohereConfig);
    stream(request: StreamRequest): AsyncGenerator<HarnessStreamChunk>;
    complete(request: StreamRequest): Promise<{
        content: string;
    }>;
}
export default AllternitCohere;
