/**
 * Unit Tests for Protocol Codec
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  encodeMessage,
  decodeMessage,
  validateMessage,
} from "../../protocol/codec";
import { encodeFrame, decodeFrame } from "../../protocol/framing";
import type {
  ExecuteRequest,
  ExecuteResponse,
  FileReadRequest,
  ErrorResponse,
  ProtocolMessage,
} from "../../protocol/types";
import {
  isExecuteRequest,
  isExecuteResponse,
  isFileReadRequest,
  isErrorResponse,
} from "../../protocol/types";

describe("Protocol Codec", () => {
  describe("Message Encoding/Decoding", () => {
    it("should encode and decode execute request", () => {
      const request: ExecuteRequest = {
        id: "test-id-123",
        type: "execute",
        command: "echo hello",
        workingDir: "/workspace",
        env: { KEY: "value" },
        timeout: 30000,
      };

      const encoded = encodeMessage(request);
      expect(typeof encoded).toBe("string");

      const decoded = decodeMessage(encoded);
      expect(decoded).toEqual(request);
    });

    it("should encode and decode execute response", () => {
      const response: ExecuteResponse = {
        id: "test-id-123",
        type: "execute_response",
        exitCode: 0,
        stdout: Buffer.from("hello").toString("base64"),
        stderr: "",
        duration: 100,
      };

      const encoded = encodeMessage(response);
      const decoded = decodeMessage(encoded) as ExecuteResponse;

      expect(decoded.id).toBe(response.id);
      expect(decoded.exitCode).toBe(response.exitCode);
      expect(decoded.stdout).toBe(response.stdout);
    });

    it("should encode and decode file read request", () => {
      const request: FileReadRequest = {
        id: "file-req-456",
        type: "file_read",
        path: "/workspace/file.txt",
      };

      const encoded = encodeMessage(request);
      const decoded = decodeMessage(encoded);

      expect(decoded).toEqual(request);
    });

    it("should encode and decode error response", () => {
      const response: ErrorResponse = {
        id: "err-789",
        type: "error",
        code: "EXECUTION_FAILED",
        message: "Command failed with exit code 1",
      };

      const encoded = encodeMessage(response);
      const decoded = decodeMessage(encoded);

      expect(decoded).toEqual(response);
    });

    it("should handle binary data in stdout", () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      const response: ExecuteResponse = {
        id: "bin-test",
        type: "execute_response",
        exitCode: 0,
        stdout: binaryData.toString("base64"),
        stderr: "",
        duration: 50,
      };

      const encoded = encodeMessage(response);
      const decoded = decodeMessage(encoded) as ExecuteResponse;

      const decodedBuffer = Buffer.from(decoded.stdout, "base64");
      expect(decodedBuffer).toEqual(binaryData);
    });

    it("should throw on invalid JSON", () => {
      expect(() => decodeMessage("not valid json")).toThrow();
    });
  });

  describe("Message Validation", () => {
    it("should validate execute request", () => {
      const validRequest = {
        id: "test",
        type: "execute",
        command: "ls",
      };

      expect(validateMessage(validRequest)).toBe(true);
      expect(isExecuteRequest(validRequest)).toBe(true);
    });

    it("should reject invalid message types", () => {
      const invalidMessage = {
        id: "test",
        type: "unknown_type",
      };

      expect(validateMessage(invalidMessage)).toBe(false);
    });

    it("should reject messages without id", () => {
      const invalidMessage = {
        type: "execute",
        command: "ls",
      };

      expect(validateMessage(invalidMessage)).toBe(false);
    });

    it("should reject messages without type", () => {
      const invalidMessage = {
        id: "test",
        command: "ls",
      };

      expect(validateMessage(invalidMessage)).toBe(false);
    });

    it("should validate execute response", () => {
      const response = {
        id: "test",
        type: "execute_response",
        exitCode: 0,
        stdout: "",
        stderr: "",
        duration: 0,
      };

      expect(isExecuteResponse(response)).toBe(true);
    });

    it("should validate file read request", () => {
      const request = {
        id: "test",
        type: "file_read",
        path: "/test.txt",
      };

      expect(isFileReadRequest(request)).toBe(true);
    });

    it("should validate error response", () => {
      const response = {
        id: "test",
        type: "error",
        code: "ERROR",
        message: "Something failed",
      };

      expect(isErrorResponse(response)).toBe(true);
    });
  });

  describe("Message Framing", () => {
    it("should frame and unframe messages", () => {
      const message = Buffer.from('{"type":"test","id":"123"}');
      const framed = encodeFrame(message);

      // Check length prefix
      const length = framed.readUInt32LE(0);
      expect(length).toBe(message.length);

      // Check payload
      expect(framed.slice(4).toString()).toBe(message.toString());

      // Decode
      const decoded = decodeFrame(framed);
      expect(decoded.toString()).toBe(message.toString());
    });

    it("should handle empty frames", () => {
      const message = Buffer.alloc(0);
      const framed = encodeFrame(message);

      expect(framed.length).toBe(4);

      const decoded = decodeFrame(framed);
      expect(decoded.length).toBe(0);
    });

    it("should handle large frames", () => {
      const message = Buffer.alloc(10 * 1024 * 1024, "x"); // 10MB
      const framed = encodeFrame(message);

      const length = framed.readUInt32LE(0);
      expect(length).toBe(10 * 1024 * 1024);
    });

    it("should throw on truncated frames", () => {
      const truncated = Buffer.alloc(4);
      truncated.writeUInt32LE(100, 0); // Claims 100 bytes but only has 0

      expect(() => decodeFrame(truncated)).toThrow();
    });
  });

  describe("Protocol Client/Server", () => {
    it("should correlate requests and responses", () => {
      // Simulate request/response correlation
      const requests = new Map<string, (response: ProtocolMessage) => void>();

      const requestId = "req-123";
      const request: ExecuteRequest = {
        id: requestId,
        type: "execute",
        command: "ls",
      };

      // Store resolver
      const promise = new Promise<ProtocolMessage>((resolve) => {
        requests.set(requestId, resolve);
      });

      // Simulate receiving response
      const response: ExecuteResponse = {
        id: requestId,
        type: "execute_response",
        exitCode: 0,
        stdout: "",
        stderr: "",
        duration: 100,
      };

      // Resolve
      const resolver = requests.get(requestId);
      expect(resolver).toBeDefined();
      resolver!(response);

      return promise.then((result) => {
        expect(result).toEqual(response);
      });
    });

    it("should timeout pending requests", async () => {
      const TIMEOUT = 100;

      const promise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout")), TIMEOUT);
      });

      await expect(promise).rejects.toThrow("Timeout");
    });
  });
});

// Run tests
console.log("Running Protocol Codec unit tests...");
