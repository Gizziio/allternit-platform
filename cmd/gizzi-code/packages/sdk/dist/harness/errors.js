/**
 * Harness Error Types
 */
export class HarnessError extends Error {
    code;
    cause;
    constructor(message, code, cause) {
        super(message);
        this.name = 'HarnessError';
        this.code = code;
        this.cause = cause;
    }
}
//# sourceMappingURL=errors.js.map