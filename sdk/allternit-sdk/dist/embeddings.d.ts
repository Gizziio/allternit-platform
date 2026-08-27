import type { HarnessConfig } from './harness/types.js';
export interface EmbeddingsCreateRequest {
    model: string;
    input: string | string[];
}
export interface Embedding {
    object: 'embedding';
    embedding: number[];
    index: number;
}
export interface EmbeddingsResponse {
    object: 'list';
    data: Embedding[];
    model: string;
    usage?: {
        prompt_tokens: number;
        total_tokens: number;
    };
}
/** OpenAI-compatible embeddings client using the harness auth configuration. */
export declare class AllternitEmbeddings {
    private readonly config;
    constructor(config: HarnessConfig);
    create(request: EmbeddingsCreateRequest): Promise<EmbeddingsResponse>;
}
