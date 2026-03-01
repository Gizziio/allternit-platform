/**
 * File Tools Tests
 * 
 * Tests for:
 * - read_file: Read file contents with offset/limit
 * - write_file: Write/append file contents
 * - search_code: Search codebase with various patterns
 * - list_directory: List directory contents
 * - delete_file: Delete files
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeReadFile,
  executeWriteFile,
  executeSearchCode,
  executeListDirectory,
  executeDeleteFile,
  READ_FILE_DEFINITION,
  WRITE_FILE_DEFINITION,
  SEARCH_CODE_DEFINITION,
  LIST_DIRECTORY_DEFINITION,
  DELETE_FILE_DEFINITION,
  type SearchResult,
  type FileEntry,
} from "./file-tools";
import type { ToolExecutionContext } from "./index";

// Mock fetch for API calls
global.fetch = vi.fn();

describe("File Tools", () => {
  const mockContext: ToolExecutionContext = {
    sessionId: "test-session",
    toolCallId: "test-call-1",
    timestamp: Date.now(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("read_file", () => {
    it("should read a file from API", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          path: "src/test.ts",
          content: "line 1\nline 2\nline 3\nline 4\nline 5",
          totalLines: 5,
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeReadFile(mockContext, {
        path: "src/test.ts",
      });

      expect(result.result).toBeDefined();
      expect(result.result.path).toBe("src/test.ts");
      expect(result.result.content).toContain("line 1");
      expect(result.result.totalLines).toBe(5);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/files/read?"),
        expect.any(Object)
      );
    });

    it("should read file with offset and limit", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          path: "src/test.ts",
          content: "line 2\nline 3",
          totalLines: 5,
          offset: 1,
          limit: 2,
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeReadFile(mockContext, {
        path: "src/test.ts",
        offset: 1,
        limit: 2,
      });

      expect(result.result.content).toBe("line 2\nline 3");
      expect(result.result.offset).toBe(1);
      expect(result.result.limit).toBe(2);
    });

    it("should return error for non-existent file (404)", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeReadFile(mockContext, {
        path: "nonexistent.ts",
      });

      expect(result.error).toBeDefined();
      expect(result.result).toBeNull();
    });

    it("should handle API errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

      const result = await executeReadFile(mockContext, {
        path: "test.ts",
      });

      expect(result.error).toBeDefined();
      expect(result.result).toBeNull();
    });
  });

  describe("write_file", () => {
    it("should write a new file via API", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          path: "src/new.ts",
          bytesWritten: 19,
          operation: "write",
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeWriteFile(mockContext, {
        path: "src/new.ts",
        content: "export const x = 1;",
      });

      expect(result.result).toBeDefined();
      expect(result.result.path).toBe("src/new.ts");
      expect(result.result.bytesWritten).toBe(19);
      expect(result.result.operation).toBe("write");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/files/write"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("src/new.ts"),
        })
      );
    });

    it("should append to existing file", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          path: "src/existing.ts",
          bytesWritten: 18,
          operation: "append",
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeWriteFile(mockContext, {
        path: "src/existing.ts",
        content: "\nappended content",
        append: true,
      });

      expect(result.result.operation).toBe("append");
    });

    it("should handle write errors", async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: "Forbidden",
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeWriteFile(mockContext, {
        path: "readonly.ts",
        content: "test",
      });

      expect(result.error).toBeDefined();
    });
  });

  describe("search_code", () => {
    it("should search for text via API", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          query: "helper",
          results: [
            {
              file: "src/utils.ts",
              line: 1,
              column: 17,
              content: "export function helper() { return 1; }",
              context: ["export function helper() { return 1; }"],
              matchType: "text",
            },
          ],
          totalResults: 1,
          searchType: "text",
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeSearchCode(mockContext, {
        query: "helper",
        type: "text",
      });

      expect(result.result.results.length).toBeGreaterThan(0);
      expect(result.result.results.some((r: SearchResult) => r.content.includes("helper"))).toBe(true);
    });

    it("should search with regex pattern", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          query: "export (function|const)",
          results: [
            { file: "src/utils.ts", line: 1, column: 1, content: "export function helper()", context: [], matchType: "regex" },
            { file: "src/utils.ts", line: 2, column: 1, content: "export const x = 2", context: [], matchType: "regex" },
          ],
          totalResults: 2,
          searchType: "regex",
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeSearchCode(mockContext, {
        query: "export (function|const)",
        type: "regex",
      });

      expect(result.result.results.length).toBe(2);
    });

    it("should handle search errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Search failed"));

      const result = await executeSearchCode(mockContext, {
        query: "test",
        type: "text",
      });

      expect(result.error).toBeDefined();
    });
  });

  describe("list_directory", () => {
    it("should list files via API", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          path: "src",
          entries: [
            { name: "components", type: "directory" },
            { name: "utils.ts", type: "file", size: 1024 },
            { name: "main.ts", type: "file", size: 2048 },
          ],
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeListDirectory(mockContext, {
        path: "src",
      });

      expect(result.result).toBeDefined();
      expect(result.result.path).toBe("src");
      expect(Array.isArray(result.result.entries)).toBe(true);
      expect(result.result.entries.length).toBe(3);
    });

    it("should list recursively when requested", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          path: "src",
          entries: [
            { name: "components", type: "directory" },
            { name: "components/Button.tsx", type: "file", size: 1024 },
            { name: "utils.ts", type: "file", size: 512 },
          ],
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeListDirectory(mockContext, {
        path: "src",
        recursive: true,
      });

      expect(result.result.entries.length).toBeGreaterThanOrEqual(1);
    });

    it("should return error for non-existent directory", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeListDirectory(mockContext, {
        path: "nonexistent",
      });

      expect(result.error).toBeDefined();
    });
  });

  describe("delete_file", () => {
    it("should delete a file via API", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeDeleteFile(mockContext, {
        path: "old-file.ts",
      });

      expect(result.result).toBeDefined();
      expect(result.result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/files/delete?"),
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should return error for non-existent file", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeDeleteFile(mockContext, {
        path: "nonexistent.ts",
      });

      expect(result.error).toBeDefined();
    });
  });

  describe("Tool Definitions", () => {
    it("should have correct read_file definition", () => {
      expect(READ_FILE_DEFINITION.name).toBe("read_file");
      expect(READ_FILE_DEFINITION.parameters.properties.path).toBeDefined();
      expect(READ_FILE_DEFINITION.parameters.properties.offset).toBeDefined();
      expect(READ_FILE_DEFINITION.parameters.properties.limit).toBeDefined();
      expect(READ_FILE_DEFINITION.parameters.required).toContain("path");
    });

    it("should have correct write_file definition", () => {
      expect(WRITE_FILE_DEFINITION.name).toBe("write_file");
      expect(WRITE_FILE_DEFINITION.parameters.properties.path).toBeDefined();
      expect(WRITE_FILE_DEFINITION.parameters.properties.content).toBeDefined();
      expect(WRITE_FILE_DEFINITION.parameters.properties.append).toBeDefined();
      expect(WRITE_FILE_DEFINITION.parameters.required).toContain("path");
      expect(WRITE_FILE_DEFINITION.parameters.required).toContain("content");
    });

    it("should have correct search_code definition", () => {
      expect(SEARCH_CODE_DEFINITION.name).toBe("search_code");
      expect(SEARCH_CODE_DEFINITION.parameters.properties.query).toBeDefined();
      expect(SEARCH_CODE_DEFINITION.parameters.properties.type).toBeDefined();
      expect(SEARCH_CODE_DEFINITION.parameters.properties.glob).toBeDefined();
      expect(SEARCH_CODE_DEFINITION.parameters.properties.caseSensitive).toBeDefined();
      expect(SEARCH_CODE_DEFINITION.parameters.properties.maxResults).toBeDefined();
    });

    it("should have correct list_directory definition", () => {
      expect(LIST_DIRECTORY_DEFINITION.name).toBe("list_directory");
      expect(LIST_DIRECTORY_DEFINITION.parameters.properties.path).toBeDefined();
      expect(LIST_DIRECTORY_DEFINITION.parameters.properties.includeDetails).toBeDefined();
      expect(LIST_DIRECTORY_DEFINITION.parameters.properties.recursive).toBeDefined();
    });

    it("should have correct delete_file definition", () => {
      expect(DELETE_FILE_DEFINITION.name).toBe("delete_file");
      expect(DELETE_FILE_DEFINITION.parameters.properties.path).toBeDefined();
      expect(DELETE_FILE_DEFINITION.parameters.required).toContain("path");
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

      const result = await executeReadFile(mockContext, {
        path: "test.ts",
      });

      expect(result.error).toBeDefined();
      expect(result.result).toBeNull();
    });

    it("should handle API returning non-JSON", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await executeReadFile(mockContext, {
        path: "test.ts",
      });

      expect(result.error).toBeDefined();
    });
  });
});
