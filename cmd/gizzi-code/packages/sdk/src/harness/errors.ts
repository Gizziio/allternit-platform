/**
 * Harness Error Types
 */

export type HarnessErrorCode =
  | 'CONFIG_INVALID'
  | 'PROVIDER_NOT_FOUND'
  | 'MODEL_NOT_FOUND'
  | 'AUTHENTICATION_FAILED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'STREAM_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'UNKNOWN';

export class HarnessError extends Error {
  code: HarnessErrorCode;
  cause?: unknown;
  
  constructor(
    message: string,
    code: HarnessErrorCode,
    cause?: unknown
  ) {
    super(message);
    this.name = 'HarnessError';
    this.code = code;
    this.cause = cause;
  }
}

// Re-export for convenience
export { HarnessError as default };
