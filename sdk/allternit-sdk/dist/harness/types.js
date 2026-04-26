/**
 * AllternitHarness Types
 * Core type definitions for the harness SDK
 */
/**
 * Error codes for harness operations
 */
export var HarnessErrorCode;
(function (HarnessErrorCode) {
    HarnessErrorCode["CONFIG_INVALID"] = "CONFIG_INVALID";
    HarnessErrorCode["MODE_UNSUPPORTED"] = "MODE_UNSUPPORTED";
    HarnessErrorCode["PROVIDER_NOT_FOUND"] = "PROVIDER_NOT_FOUND";
    HarnessErrorCode["API_ERROR"] = "API_ERROR";
    HarnessErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    HarnessErrorCode["TIMEOUT"] = "TIMEOUT";
    HarnessErrorCode["STREAM_ERROR"] = "STREAM_ERROR";
    HarnessErrorCode["AUTHENTICATION_ERROR"] = "AUTHENTICATION_ERROR";
    HarnessErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    HarnessErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(HarnessErrorCode || (HarnessErrorCode = {}));
/**
 * Harness-specific error class
 */
export class HarnessError extends Error {
    code;
    cause;
    constructor(code, message, cause) {
        super(message);
        this.name = 'HarnessError';
        this.code = code;
        this.cause = cause;
    }
}
