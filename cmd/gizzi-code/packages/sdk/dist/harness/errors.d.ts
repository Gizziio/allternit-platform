/**
 * Harness Error Types
 */
export declare enum HarnessErrorCode {
    CONFIG_INVALID = "CONFIG_INVALID",
    INVALID_CONFIG = "INVALID_CONFIG",
    PROVIDER_NOT_FOUND = "PROVIDER_NOT_FOUND",
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
    AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
    AUTH_ERROR = "AUTH_ERROR",
    RATE_LIMITED = "RATE_LIMITED",
    NETWORK_ERROR = "NETWORK_ERROR",
    STREAM_ERROR = "STREAM_ERROR",
    PROVIDER_ERROR = "PROVIDER_ERROR",
    TIMEOUT = "TIMEOUT",
    CANCELLED = "CANCELLED",
    UNKNOWN = "UNKNOWN"
}
export declare class HarnessError extends Error {
    name: string;
    code: HarnessErrorCode;
    cause?: unknown;
    constructor(message: string, code: HarnessErrorCode, cause?: unknown);
}
export { HarnessError as default };
//# sourceMappingURL=errors.d.ts.map