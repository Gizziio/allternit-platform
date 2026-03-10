/**
 * Base API Error class
 */
export class APIError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends APIError {
  constructor(message: string = 'Bad Request', code: string = 'BAD_REQUEST', details?: Record<string, any>) {
    super(message, 400, code, details);
    this.name = 'BadRequestError';
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends APIError {
  constructor(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED') {
    super(message, 401, code);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends APIError {
  constructor(message: string = 'Forbidden', code: string = 'FORBIDDEN') {
    super(message, 403, code);
    this.name = 'ForbiddenError';
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends APIError {
  constructor(message: string = 'Not Found', code: string = 'NOT_FOUND') {
    super(message, 404, code);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends APIError {
  constructor(message: string = 'Conflict', code: string = 'CONFLICT') {
    super(message, 409, code);
    this.name = 'ConflictError';
  }
}

/**
 * Validation Error (422)
 */
export class ValidationError extends APIError {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(
    message: string = 'Validation Failed',
    errors: Array<{ field: string; message: string }> = []
  ) {
    super(message, 422, 'VALIDATION_ERROR', { errors });
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Too Many Requests Error (429)
 */
export class TooManyRequestsError extends APIError {
  constructor(message: string = 'Too Many Requests', code: string = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, code);
    this.name = 'TooManyRequestsError';
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends APIError {
  constructor(message: string = 'Internal Server Error', code: string = 'INTERNAL_ERROR') {
    super(message, 500, code);
    this.name = 'InternalServerError';
  }
}

/**
 * Service Unavailable Error (503)
 */
export class ServiceUnavailableError extends APIError {
  constructor(message: string = 'Service Unavailable', code: string = 'SERVICE_UNAVAILABLE') {
    super(message, 503, code);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * SSH Connection Error
 */
export class SSHConnectionError extends APIError {
  constructor(message: string = 'SSH Connection Failed', details?: Record<string, any>) {
    super(message, 502, 'SSH_CONNECTION_ERROR', details);
    this.name = 'SSHConnectionError';
  }
}

/**
 * Cloud Provider Error
 */
export class CloudProviderError extends APIError {
  constructor(
    message: string = 'Cloud Provider Error',
    provider: string = 'unknown',
    details?: Record<string, any>
  ) {
    super(message, 502, 'CLOUD_PROVIDER_ERROR', { provider, ...details });
    this.name = 'CloudProviderError';
  }
}

/**
 * Docker Error
 */
export class DockerError extends APIError {
  constructor(message: string = 'Docker Operation Failed', details?: Record<string, any>) {
    super(message, 502, 'DOCKER_ERROR', details);
    this.name = 'DockerError';
  }
}

/**
 * Error handler for Fastify
 */
export function errorHandler(error: Error, _request: any, reply: any): void {
  if (error instanceof APIError) {
    reply.status(error.statusCode).send(error.toJSON());
    return;
  }

  // Handle validation errors (e.g., from Joi)
  if (error.name === 'ValidationError' && 'details' in error) {
    const validationError = error as any;
    const errors = validationError.details?.map((detail: any) => ({
      field: detail.path?.join('.') || 'unknown',
      message: detail.message,
    })) || [];

    reply.status(422).send({
      error: {
        message: 'Validation Failed',
        code: 'VALIDATION_ERROR',
        statusCode: 422,
        details: { errors },
      },
    });
    return;
  }

  // Default to internal server error
  reply.status(500).send({
    error: {
      message: config.server.isProduction ? 'Internal Server Error' : error.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      ...(config.server.isDevelopment && { stack: error.stack }),
    },
  });
}

import config from '../config';
