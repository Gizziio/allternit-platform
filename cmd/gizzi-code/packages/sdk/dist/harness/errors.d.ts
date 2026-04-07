/**
 * Harness Error Types
 */
export type HarnessErrorCode = 'CONFIG_INVALID' | 'PROVIDER_NOT_FOUND' | 'MODEL_NOT_FOUND' | 'AUTHENTICATION_FAILED' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'STREAM_ERROR' | 'TIMEOUT' | 'CANCELLED' | 'UNKNOWN';
export declare class HarnessError extends Error {
    code: HarnessErrorCode;
    cause?: unknown;
    constructor(message: string, code: HarnessErrorCode, cause?: unknown);
}
//# sourceMappingURL=errors.d.ts.map