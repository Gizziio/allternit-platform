/**
 * @fileoverview Allternit Guest Agent Protocol - Message Type Definitions
 * 
 * Protocol for communication between host and VM via VSOCK/VZVirtioSocket.
 * All messages use JSON encoding with length-prefixed framing.
 * 
 * @module types.js
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request to execute a command in the VM
 */
export interface ExecuteRequest {
  /** Unique request identifier (UUID) */
  id: string;
  /** Message type discriminator */
  type: "execute";
  /** Shell command to execute */
  command: string;
  /** Working directory for command execution */
  workingDir?: string;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Request to read a file from the VM
 */
export interface FileReadRequest {
  /** Unique request identifier (UUID) */
  id: string;
  /** Message type discriminator */
  type: "file_read";
  /** Absolute path to the file */
  path: string;
}

/**
 * Request to write a file to the VM
 */
export interface FileWriteRequest {
  /** Unique request identifier (UUID) */
  id: string;
  /** Message type discriminator */
  type: "file_write";
  /** Absolute path to the file */
  path: string;
  /** Base64-encoded file content */
  content: string;
  /** File permissions (octal, e.g., 0o644) */
  mode?: number;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response for execute request
 */
export interface ExecuteResponse {
  /** Matches the request ID */
  id: string;
  /** Message type discriminator */
  type: "execute_response";
  /** Command exit code (0 = success) */
  exitCode: number;
  /** Base64-encoded stdout output */
  stdout: string;
  /** Base64-encoded stderr output */
  stderr: string;
  /** Execution duration in milliseconds */
  duration: number;
}

/**
 * Response for file read request
 */
export interface FileReadResponse {
  /** Matches the request ID */
  id: string;
  /** Message type discriminator */
  type: "file_read_response";
  /** Base64-encoded file content */
  content: string;
  /** Whether the file exists */
  exists: boolean;
}

/**
 * Generic error response
 */
export interface ErrorResponse {
  /** Matches the request ID */
  id: string;
  /** Message type discriminator */
  type: "error";
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Chunk of streaming output (stdout or stderr)
 */
export interface StreamChunk {
  /** Matches the request ID */
  id: string;
  /** Message type discriminator */
  type: "stream_chunk";
  /** Which stream this chunk belongs to */
  stream: "stdout" | "stderr";
  /** Base64-encoded chunk data */
  data: string;
}

/**
 * Signals end of streaming output
 */
export interface StreamEnd {
  /** Matches the request ID */
  id: string;
  /** Message type discriminator */
  type: "stream_end";
  /** Command exit code */
  exitCode: number;
}

// ============================================================================
// Union Types
// ============================================================================

/** All possible request message types */
export type ProtocolRequest = ExecuteRequest | FileReadRequest | FileWriteRequest;

/** All possible response message types */
export type ProtocolResponse = ExecuteResponse | FileReadResponse | ErrorResponse | StreamChunk | StreamEnd;

/** All possible protocol message types */
export type ProtocolMessage = ProtocolRequest | ProtocolResponse;

/** Message type discriminator values */
export type MessageType = ProtocolMessage["type"];

// ============================================================================
// Type Guards
// ============================================================================

const MESSAGE_TYPES = [
  "execute",
  "file_read",
  "file_write",
  "execute_response",
  "file_read_response",
  "error",
  "stream_chunk",
  "stream_end",
] as const;

/**
 * Check if a value is a valid ProtocolMessage
 * @param value - Value to check
 * @returns True if value is a valid ProtocolMessage
 */
export function isProtocolMessage(value: unknown): value is ProtocolMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const msg = value as Record<string, unknown>;

  // Must have id and type
  if (typeof msg.id !== "string" || typeof msg.type !== "string") {
    return false;
  }

  // Type must be a known message type
  if (!MESSAGE_TYPES.includes(msg.type as (typeof MESSAGE_TYPES)[number])) {
    return false;
  }

  return true;
}

/**
 * Type guard for ExecuteRequest
 * @param msg - Message to check
 * @returns True if msg is an ExecuteRequest
 */
export function isExecuteRequest(msg: ProtocolMessage): msg is ExecuteRequest {
  return msg.type === "execute" && typeof (msg as ExecuteRequest).command === "string";
}

/**
 * Type guard for FileReadRequest
 * @param msg - Message to check
 * @returns True if msg is a FileReadRequest
 */
export function isFileReadRequest(msg: ProtocolMessage): msg is FileReadRequest {
  return msg.type === "file_read" && typeof (msg as FileReadRequest).path === "string";
}

/**
 * Type guard for FileWriteRequest
 * @param msg - Message to check
 * @returns True if msg is a FileWriteRequest
 */
export function isFileWriteRequest(msg: ProtocolMessage): msg is FileWriteRequest {
  return msg.type === "file_write" && typeof (msg as FileWriteRequest).path === "string";
}

/**
 * Type guard for ExecuteResponse
 * @param msg - Message to check
 * @returns True if msg is an ExecuteResponse
 */
export function isExecuteResponse(msg: ProtocolMessage): msg is ExecuteResponse {
  return msg.type === "execute_response" && typeof (msg as ExecuteResponse).exitCode === "number";
}

/**
 * Type guard for FileReadResponse
 * @param msg - Message to check
 * @returns True if msg is a FileReadResponse
 */
export function isFileReadResponse(msg: ProtocolMessage): msg is FileReadResponse {
  return msg.type === "file_read_response" && typeof (msg as FileReadResponse).exists === "boolean";
}

/**
 * Type guard for ErrorResponse
 * @param msg - Message to check
 * @returns True if msg is an ErrorResponse
 */
export function isErrorResponse(msg: ProtocolMessage): msg is ErrorResponse {
  return msg.type === "error" && typeof (msg as ErrorResponse).code === "string";
}

/**
 * Type guard for StreamChunk
 * @param msg - Message to check
 * @returns True if msg is a StreamChunk
 */
export function isStreamChunk(msg: ProtocolMessage): msg is StreamChunk {
  return msg.type === "stream_chunk" && ["stdout", "stderr"].includes((msg as StreamChunk).stream);
}

/**
 * Type guard for StreamEnd
 * @param msg - Message to check
 * @returns True if msg is a StreamEnd
 */
export function isStreamEnd(msg: ProtocolMessage): msg is StreamEnd {
  return msg.type === "stream_end" && typeof (msg as StreamEnd).exitCode === "number";
}

/**
 * Check if message is a request type
 * @param msg - Message to check
 * @returns True if msg is a request
 */
export function isRequest(msg: ProtocolMessage): msg is ProtocolRequest {
  return msg.type === "execute" || msg.type === "file_read" || msg.type === "file_write";
}

/**
 * Check if message is a response type
 * @param msg - Message to check
 * @returns True if msg is a response
 */
export function isResponse(msg: ProtocolMessage): msg is ProtocolResponse {
  return (
    msg.type === "execute_response" ||
    msg.type === "file_read_response" ||
    msg.type === "error" ||
    msg.type === "stream_chunk" ||
    msg.type === "stream_end"
  );
}
