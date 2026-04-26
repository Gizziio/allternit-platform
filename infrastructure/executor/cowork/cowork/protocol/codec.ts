/**
 * @fileoverview Allternit Guest Agent Protocol - Encoding/Decoding Logic
 * 
 * Handles JSON serialization/deserialization of protocol messages
 * with validation and error handling.
 * 
 * @module codec.js
 */

import type { ProtocolMessage } from "./types.js";
import { isProtocolMessage } from "./types.js";
import { encodeFrame, decodeFrame, readFrame, writeFrame } from "./framing.js";
import type { Readable, Writable } from "node:stream";

/** Error codes for codec operations */
export enum CodecErrorCode {
  INVALID_JSON = "INVALID_JSON",
  INVALID_MESSAGE = "INVALID_MESSAGE",
  ENCODE_ERROR = "ENCODE_ERROR",
  DECODE_ERROR = "DECODE_ERROR",
  FRAME_ERROR = "FRAME_ERROR",
}

/**
 * Error thrown during encoding/decoding operations
 */
export class CodecError extends Error {
  constructor(
    public readonly code: CodecErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "CodecError";
    Error.captureStackTrace?.(this, CodecError);
  }
}

/**
 * Encode a protocol message to a framed buffer
 * @param message - Protocol message to encode
 * @returns Framed buffer ready for transmission
 * @throws {CodecError} If message is invalid or encoding fails
 */
export function encodeMessage(message: ProtocolMessage): Buffer {
  if (!isProtocolMessage(message)) {
    throw new CodecError(
      CodecErrorCode.INVALID_MESSAGE,
      "Invalid protocol message structure"
    );
  }

  try {
    const json = JSON.stringify(message);
    const payload = Buffer.from(json, "utf-8");
    return encodeFrame(payload);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw new CodecError(
      CodecErrorCode.ENCODE_ERROR,
      `Failed to encode message: ${error.message}`,
      error
    );
  }
}

/**
 * Decode a buffer to a protocol message
 * @param buffer - Raw payload buffer (without length prefix)
 * @returns Decoded protocol message
 * @throws {CodecError} If JSON is invalid or message structure is invalid
 */
export function decodeMessage(buffer: Buffer): ProtocolMessage {
  let parsed: unknown;

  try {
    const json = buffer.toString("utf-8");
    parsed = JSON.parse(json);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw new CodecError(
      CodecErrorCode.INVALID_JSON,
      `Invalid JSON: ${error.message}`,
      error
    );
  }

  if (!isProtocolMessage(parsed)) {
    throw new CodecError(
      CodecErrorCode.INVALID_MESSAGE,
      "Decoded value is not a valid protocol message"
    );
  }

  return parsed;
}

/**
 * Decode a framed message from a buffer
 * @param buffer - Buffer potentially containing a complete framed message
 * @returns Decoded message and remaining buffer, or null if incomplete
 * @throws {CodecError} If frame is invalid
 */
export interface DecodedMessage {
  /** Decoded protocol message */
  message: ProtocolMessage;
  /** Remaining buffer after this message */
  remaining: Buffer;
}

export function decodeFramedMessage(buffer: Buffer): DecodedMessage | null {
  const frameResult = decodeFrame(buffer);
  
  if (frameResult === null) {
    return null; // Incomplete frame
  }

  const message = decodeMessage(frameResult.payload);
  
  return {
    message,
    remaining: frameResult.remaining,
  };
}

/**
 * Read and decode a complete message from a readable stream
 * @param stream - Readable stream
 * @returns Promise resolving to decoded protocol message
 * @throws {CodecError} On read/decode failure
 */
export async function readMessage(stream: Readable): Promise<ProtocolMessage> {
  try {
    const payload = await readFrame(stream);
    return decodeMessage(payload);
  } catch (err) {
    if (err instanceof CodecError) {
      throw err;
    }
    // Wrap framing errors
    const error = err instanceof Error ? err : new Error(String(err));
    throw new CodecError(
      CodecErrorCode.FRAME_ERROR,
      `Failed to read message: ${error.message}`,
      error
    );
  }
}

/**
 * Encode and write a message to a writable stream
 * @param stream - Writable stream
 * @param message - Protocol message to send
 * @returns Promise that resolves when write completes
 * @throws {CodecError} On encode/write failure
 */
export async function writeMessage(
  stream: Writable,
  message: ProtocolMessage
): Promise<void> {
  const frame = encodeMessage(message);
  
  try {
    await writeFrame(stream, frame.subarray(4)); // writeFrame expects payload only
  } catch (err) {
    if (err instanceof CodecError) {
      throw err;
    }
    const error = err instanceof Error ? err : new Error(String(err));
    throw new CodecError(
      CodecErrorCode.FRAME_ERROR,
      `Failed to write message: ${error.message}`,
      error
    );
  }
}

/**
 * Create a message encoder function for a specific stream
 * @param stream - Target writable stream
 * @returns Function that encodes and sends messages
 */
export function createEncoder(stream: Writable) {
  return async (message: ProtocolMessage): Promise<void> => {
    await writeMessage(stream, message);
  };
}

/**
 * Create a message decoder that handles stream data events
 * @param stream - Source readable stream
 * @param onMessage - Callback for decoded messages
 * @param onError - Callback for decode errors
 * @returns Cleanup function to stop listening
 */
export function createDecoder(
  stream: Readable,
  onMessage: (message: ProtocolMessage) => void,
  onError?: (error: CodecError) => void
): () => void {
  let buffer = Buffer.alloc(0);

  const handleData = (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    // Process all complete messages
    while (buffer.length > 0) {
      try {
        const result = decodeFramedMessage(buffer);
        if (result === null) break; // Need more data

        buffer = Buffer.from(result.remaining);
        onMessage(result.message);
      } catch (err) {
        if (onError) {
          onError(err instanceof CodecError ? err : new CodecError(
            CodecErrorCode.DECODE_ERROR,
            String(err)
          ));
        }
        // Continue processing after error
        buffer = buffer.subarray(1); // Skip one byte and try again
      }
    }
  };

  const handleError = (err: Error) => {
    if (onError) {
      onError(new CodecError(CodecErrorCode.DECODE_ERROR, err.message, err));
    }
  };

  stream.on("data", handleData);
  stream.on("error", handleError);

  // Return cleanup function
  return () => {
    stream.off("data", handleData);
    stream.off("error", handleError);
  };
}

/**
 * Safely encode a message without throwing
 * @param message - Message to encode
 * @returns Encoded buffer or null on failure
 */
export function tryEncodeMessage(message: ProtocolMessage): Buffer | null {
  try {
    return encodeMessage(message);
  } catch {
    return null;
  }
}

/**
 * Safely decode a message without throwing
 * @param buffer - Buffer to decode
 * @returns Decoded message or null on failure
 */
export function tryDecodeMessage(buffer: Buffer): ProtocolMessage | null {
  try {
    return decodeMessage(buffer);
  } catch {
    return null;
  }
}

/**
 * Validate a protocol message without encoding
 * @param value - Value to validate
 * @returns Validation result with error details if invalid
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateMessage(value: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof value !== "object" || value === null) {
    return { valid: false, errors: ["Value must be an object"] };
  }

  const msg = value as Record<string, unknown>;

  if (typeof msg.id !== "string") {
    errors.push("Missing or invalid 'id' field (must be string)");
  }

  if (typeof msg.type !== "string") {
    errors.push("Missing or invalid 'type' field (must be string)");
  } else {
    const validTypes = [
      "execute",
      "file_read",
      "file_write",
      "execute_response",
      "file_read_response",
      "error",
      "stream_chunk",
      "stream_end",
    ];
    if (!validTypes.includes(msg.type)) {
      errors.push(`Invalid message type: ${msg.type}`);
    }
  }

  // Type-specific validation
  switch (msg.type) {
    case "execute":
      if (typeof msg.command !== "string") {
        errors.push("ExecuteRequest requires 'command' field");
      }
      break;
    case "file_read":
    case "file_write":
      if (typeof msg.path !== "string") {
        errors.push(`${msg.type} requires 'path' field`);
      }
      if (msg.type === "file_write" && typeof msg.content !== "string") {
        errors.push("FileWriteRequest requires 'content' field");
      }
      break;
    case "execute_response":
      if (typeof msg.exitCode !== "number") {
        errors.push("ExecuteResponse requires 'exitCode' field");
      }
      break;
    case "error":
      if (typeof msg.code !== "string") {
        errors.push("ErrorResponse requires 'code' field");
      }
      if (typeof msg.message !== "string") {
        errors.push("ErrorResponse requires 'message' field");
      }
      break;
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
