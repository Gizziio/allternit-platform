/**
 * @fileoverview A2R Guest Agent Protocol - Message Framing
 * 
 * Implements length-prefixed framing for reliable stream transport.
 * 
 * Message Format:
 * ┌───────────────────┬─────────────────────────────────────┐
 * │ Length (4 bytes)  │ Payload (N bytes, JSON)             │
 * │ Little-endian     │ UTF-8 encoded                       │
 * └───────────────────┴─────────────────────────────────────┘
 * 
 * @module framing.js
 */

import type { Readable, Writable } from "node:stream";
import { EventEmitter } from "node:events";

/** Maximum allowed message size (16 MB) */
export const MAX_MESSAGE_SIZE = 16 * 1024 * 1024;

/** Size of the length prefix in bytes */
export const LENGTH_PREFIX_SIZE = 4;

/** Error codes for framing operations */
export enum FramingErrorCode {
  MESSAGE_TOO_LARGE = "MESSAGE_TOO_LARGE",
  INVALID_LENGTH = "INVALID_LENGTH",
  INCOMPLETE_READ = "INCOMPLETE_READ",
  WRITE_ERROR = "WRITE_ERROR",
  STREAM_CLOSED = "STREAM_CLOSED",
}

/**
 * Error thrown during framing operations
 */
export class FramingError extends Error {
  constructor(
    public readonly code: FramingErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "FramingError";
    Error.captureStackTrace?.(this, FramingError);
  }
}

/**
 * Encode a message payload with length prefix
 * @param data - Raw payload buffer
 * @returns Buffer with length prefix + payload
 * @throws {FramingError} If message exceeds maximum size
 */
export function encodeFrame(data: Buffer): Buffer {
  if (data.length > MAX_MESSAGE_SIZE) {
    throw new FramingError(
      FramingErrorCode.MESSAGE_TOO_LARGE,
      `Message size ${data.length} exceeds maximum ${MAX_MESSAGE_SIZE}`
    );
  }

  const frame = Buffer.allocUnsafe(LENGTH_PREFIX_SIZE + data.length);
  frame.writeUInt32LE(data.length, 0);
  data.copy(frame, LENGTH_PREFIX_SIZE);

  return frame;
}

/**
 * Decode a frame from a buffer
 * @param buffer - Buffer containing at least one complete frame
 * @returns Decoded frame result with payload and remaining buffer
 * @throws {FramingError} If length is invalid or buffer too small
 */
export interface DecodedFrame {
  /** Decoded payload */
  payload: Buffer;
  /** Remaining buffer after this frame */
  remaining: Buffer;
}

export function decodeFrame(buffer: Buffer): DecodedFrame | null {
  if (buffer.length < LENGTH_PREFIX_SIZE) {
    return null; // Need more data
  }

  const length = buffer.readUInt32LE(0);

  if (length > MAX_MESSAGE_SIZE) {
    throw new FramingError(
      FramingErrorCode.INVALID_LENGTH,
      `Invalid message length: ${length} (max: ${MAX_MESSAGE_SIZE})`
    );
  }

  const totalLength = LENGTH_PREFIX_SIZE + length;

  if (buffer.length < totalLength) {
    return null; // Need more data
  }

  const payload = buffer.subarray(LENGTH_PREFIX_SIZE, totalLength);
  const remaining = buffer.subarray(totalLength);

  return { payload, remaining };
}

/**
 * Write a framed message to a writable stream
 * @param stream - Writable stream
 * @param data - Payload to write
 * @returns Promise that resolves when write completes
 * @throws {FramingError} On write failure or stream closure
 */
export function writeFrame(stream: Writable, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (stream.destroyed || stream.writableEnded) {
      reject(new FramingError(FramingErrorCode.STREAM_CLOSED, "Stream is closed"));
      return;
    }

    const frame = encodeFrame(data);

    const onError = (err: Error) => {
      cleanup();
      reject(new FramingError(FramingErrorCode.WRITE_ERROR, err.message, err));
    };

    const onClose = () => {
      cleanup();
      reject(new FramingError(FramingErrorCode.STREAM_CLOSED, "Stream closed during write"));
    };

    const cleanup = () => {
      stream.off("error", onError);
      stream.off("close", onClose);
    };

    stream.once("error", onError);
    stream.once("close", onClose);

    const canContinue = stream.write(frame, (err) => {
      cleanup();
      if (err) {
        reject(new FramingError(FramingErrorCode.WRITE_ERROR, err.message, err));
      } else {
        resolve();
      }
    });

    if (!canContinue) {
      // Backpressure - wait for drain
      stream.once("drain", () => {
        cleanup();
        resolve();
      });
    } else {
      // Write completed immediately
      cleanup();
      resolve();
    }
  });
}

/**
 * Read a complete frame from a readable stream
 * @param stream - Readable stream
 * @returns Promise resolving to the payload buffer
 * @throws {FramingError} On read failure, timeout, or invalid frame
 */
export function readFrame(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let expectedLength: number | null = null;

    const cleanup = () => {
      stream.off("data", onData);
      stream.off("end", onEnd);
      stream.off("error", onError);
      stream.off("close", onClose);
    };

    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      // Try to parse length if we haven't yet
      if (expectedLength === null && buffer.length >= LENGTH_PREFIX_SIZE) {
        expectedLength = buffer.readUInt32LE(0);

        if (expectedLength > MAX_MESSAGE_SIZE) {
          cleanup();
          reject(
            new FramingError(
              FramingErrorCode.INVALID_LENGTH,
              `Invalid message length: ${expectedLength}`
            )
          );
          return;
        }
      }

      // Check if we have a complete frame
      if (expectedLength !== null) {
        const totalLength = LENGTH_PREFIX_SIZE + expectedLength;

        if (buffer.length >= totalLength) {
          const payload = buffer.subarray(LENGTH_PREFIX_SIZE, totalLength);
          
          // Push remaining data back if any (shouldn't happen with proper framing)
          const remaining = buffer.subarray(totalLength);
          if (remaining.length > 0) {
            // Use setImmediate to avoid recursion issues
            setImmediate(() => {
              stream.unshift(remaining);
            });
          }

          cleanup();
          resolve(payload);
        }
      }
    };

    const onEnd = () => {
      cleanup();
      if (expectedLength === null) {
        reject(new FramingError(FramingErrorCode.INCOMPLETE_READ, "Stream ended before frame length received"));
      } else {
        reject(
          new FramingError(
            FramingErrorCode.INCOMPLETE_READ,
            `Stream ended with incomplete frame (expected ${expectedLength}, got ${buffer.length - LENGTH_PREFIX_SIZE})`
          )
        );
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(new FramingError(FramingErrorCode.INCOMPLETE_READ, err.message, err));
    };

    const onClose = () => {
      cleanup();
      reject(new FramingError(FramingErrorCode.STREAM_CLOSED, "Stream closed unexpectedly"));
    };

    stream.on("data", onData);
    stream.once("end", onEnd);
    stream.once("error", onError);
    stream.once("close", onClose);
  });
}

/**
 * Framing stream handler - manages frame parsing from a stream
 * Emits 'message' events for each complete frame received
 */
export class FramingStream extends EventEmitter {
  private buffer = Buffer.alloc(0);
  private isClosed = false;

  constructor(private stream: Readable) {
    super();
    this.attach();
  }

  private attach(): void {
    this.stream.on("data", (chunk: Buffer) => this.handleData(chunk));
    this.stream.on("end", () => this.handleEnd());
    this.stream.on("error", (err: Error) => this.handleError(err));
    this.stream.on("close", () => this.handleClose());
  }

  private handleData(chunk: Buffer): void {
    if (this.isClosed) return;

    this.buffer = Buffer.concat([this.buffer, chunk]);

    // Process all complete frames in buffer
    while (this.buffer.length >= LENGTH_PREFIX_SIZE) {
      try {
        const result = decodeFrame(this.buffer);
        if (result === null) break; // Need more data

        this.buffer = Buffer.from(result.remaining);
        this.emit("message", result.payload);
      } catch (err) {
        this.emit("error", err);
        this.close();
        return;
      }
    }

    // Prevent buffer from growing unbounded
    if (this.buffer.length > MAX_MESSAGE_SIZE * 2) {
      this.emit(
        "error",
        new FramingError(
          FramingErrorCode.MESSAGE_TOO_LARGE,
          "Buffer overflow - no valid frame found"
        )
      );
      this.close();
    }
  }

  private handleEnd(): void {
    if (this.isClosed) return;
    
    if (this.buffer.length > 0) {
      this.emit(
        "error",
        new FramingError(
          FramingErrorCode.INCOMPLETE_READ,
          `Stream ended with ${this.buffer.length} unprocessed bytes`
        )
      );
    }
    
    this.emit("end");
    this.close();
  }

  private handleError(err: Error): void {
    if (this.isClosed) return;
    this.emit("error", err);
    this.close();
  }

  private handleClose(): void {
    if (this.isClosed) return;
    this.emit("close");
    this.close();
  }

  /**
   * Close the framing stream and detach from source
   */
  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    this.removeAllListeners();
  }

  /**
   * Check if the framing stream is closed
   */
  get closed(): boolean {
    return this.isClosed;
  }
}
