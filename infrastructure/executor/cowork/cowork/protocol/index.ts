/**
 * @fileoverview Allternit Guest Agent Protocol
 * 
 * Protocol codec for serializing/deserializing messages between host and VM.
 * Uses length-prefixed JSON framing over reliable streams (VSOCK/VZVirtioSocket).
 * 
 * @example
 * ```typescript
 * // Client usage
 * import { ProtocolClient } from "./index";
 * 
 * const client = new ProtocolClient(connection);
 * const result = await client.execute({
 *   command: "ls -la",
 *   workingDir: "/workspace",
 * });
 * 
 * // Server usage
 * import { ProtocolServer } from "./index";
 * 
 * const server = new ProtocolServer(connection, {
 *   async execute(req) { ... },
 *   async fileRead(req) { ... },
 *   async fileWrite(req) { ... },
 * });
 * await server.start();
 * ```
 * 
 * @module allternit-guest-agent-protocol
 */

// ============================================================================
// Types
// ============================================================================

export type {
  ExecuteRequest,
  FileReadRequest,
  FileWriteRequest,
  ExecuteResponse,
  FileReadResponse,
  ErrorResponse,
  StreamChunk,
  StreamEnd,
  ProtocolRequest,
  ProtocolResponse,
  ProtocolMessage,
  MessageType,
} from "./types.js";

export {
  isProtocolMessage,
  isExecuteRequest,
  isFileReadRequest,
  isFileWriteRequest,
  isExecuteResponse,
  isFileReadResponse,
  isErrorResponse,
  isStreamChunk,
  isStreamEnd,
  isRequest,
  isResponse,
} from "./types.js";

// ============================================================================
// Framing
// ============================================================================

export {
  encodeFrame,
  decodeFrame,
  readFrame,
  writeFrame,
  FramingStream,
  FramingError,
  FramingErrorCode,
  MAX_MESSAGE_SIZE,
  LENGTH_PREFIX_SIZE,
} from "./framing.js";

// ============================================================================
// Codec
// ============================================================================

export {
  encodeMessage,
  decodeMessage,
  decodeFramedMessage,
  readMessage,
  writeMessage,
  createEncoder,
  createDecoder,
  tryEncodeMessage,
  tryDecodeMessage,
  validateMessage,
  CodecError,
  CodecErrorCode,
} from "./codec.js";

export type { DecodedFrame } from "./framing.js";
export type { DecodedMessage, ValidationResult } from "./codec.js";

// ============================================================================
// Client
// ============================================================================

export {
  ProtocolClient,
  ProtocolClientError,
  DEFAULT_TIMEOUT,
  MAX_CONCURRENT_REQUESTS,
  ClientErrorCode,
} from "./client.js";

export type { VMConnection, StreamHandlers } from "./client.js";

// ============================================================================
// Server
// ============================================================================

export {
  ProtocolServer,
  ProtocolServerError,
  createServer,
  ServerErrorCode,
} from "./server.js";

export type {
  RequestHandlers,
  ProtocolServerOptions,
} from "./server.js";

// ============================================================================
// Version
// ============================================================================

/** Protocol version (semver) */
export const PROTOCOL_VERSION = "1.0.0";

/** Protocol name */
export const PROTOCOL_NAME = "allternit-guest-agent-protocol";
