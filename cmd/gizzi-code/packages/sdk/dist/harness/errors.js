/**
 * Harness Error Types
 */
export var HarnessErrorCode;
(function (HarnessErrorCode) {
    HarnessErrorCode["CONFIG_INVALID"] = "CONFIG_INVALID";
    HarnessErrorCode["INVALID_CONFIG"] = "INVALID_CONFIG";
    HarnessErrorCode["PROVIDER_NOT_FOUND"] = "PROVIDER_NOT_FOUND";
    HarnessErrorCode["MODEL_NOT_FOUND"] = "MODEL_NOT_FOUND";
    HarnessErrorCode["AUTHENTICATION_FAILED"] = "AUTHENTICATION_FAILED";
    HarnessErrorCode["AUTH_ERROR"] = "AUTH_ERROR";
    HarnessErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    HarnessErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    HarnessErrorCode["STREAM_ERROR"] = "STREAM_ERROR";
    HarnessErrorCode["PROVIDER_ERROR"] = "PROVIDER_ERROR";
    HarnessErrorCode["TIMEOUT"] = "TIMEOUT";
    HarnessErrorCode["CANCELLED"] = "CANCELLED";
    HarnessErrorCode["UNKNOWN"] = "UNKNOWN";
})(HarnessErrorCode || (HarnessErrorCode = {}));
export class HarnessError extends Error {
    name = 'HarnessError';
    code;
    cause;
    constructor(message, code, cause) {
        super(message);
        this.name = 'HarnessError';
        this.code = code;
        this.cause = cause;
    }
}
// Re-export for convenience
export { HarnessError as default };
//# sourceMappingURL=errors.js.map