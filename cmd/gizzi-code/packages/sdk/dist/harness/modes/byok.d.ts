/**
 * BYOK Mode (Bring Your Own Key)
 * Routes requests to appropriate provider using user's API keys
 */
import type { BYOKConfig, StreamRequest, HarnessStreamChunk } from '../types';
/**
 * Stream from BYOK mode - routes to appropriate provider based on request.provider
 */
export declare function streamFromBYOK(config: BYOKConfig, request: StreamRequest): AsyncGenerator<HarnessStreamChunk>;
//# sourceMappingURL=byok.d.ts.map