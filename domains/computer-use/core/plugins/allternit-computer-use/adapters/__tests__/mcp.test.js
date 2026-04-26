"use strict";

/**
 * Unit tests for the ACU MCP adapter.
 * Tests MCP tool-call routing and gateway fallback behavior.
 */

const { jest } = require("@jest/globals");

const mockFetch = jest.fn();
global.fetch = mockFetch;
global.crypto = { randomUUID: () => "test-uuid-mcp" };

// Mock the http module for fallback tests
jest.mock("../http", () => ({
  cu_extract: jest.fn().mockResolvedValue({ extracted_content: "mocked" }),
  cu_replay:  jest.fn().mockResolvedValue({ path: "/tmp/replay.jsonl" }),
  cu_navigate: jest.fn().mockResolvedValue({ status: "completed" }),
}));

const adapter = require("../mcp");
const httpMock = require("../http");

function mockMcpOk(data) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(""),
  });
}

function mockNetworkError() {
  return Promise.reject(new Error("ECONNREFUSED"));
}

beforeEach(() => {
  mockFetch.mockReset();
  jest.clearAllMocks();
});

describe("cu_screenshot via MCP", () => {
  it("calls /tools/call with tool name screenshot", async () => {
    mockFetch.mockReturnValueOnce(mockMcpOk({ content: [{ type: "text", text: "{}" }] }));
    await adapter.cu_screenshot({ session_id: "s1" });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/tools/call");
    const body = JSON.parse(opts.body);
    expect(body.name).toBe("screenshot");
    expect(body.arguments.session_id).toBe("s1");
  });
});

describe("gateway fallback", () => {
  it("falls back to http adapter when MCP unreachable", async () => {
    mockFetch.mockImplementationOnce(() => mockNetworkError());
    await adapter.cu_navigate({ session_id: "s2", url: "https://example.com" });
    expect(httpMock.cu_navigate).toHaveBeenCalled();
  });
});

describe("cu_extract", () => {
  it("always delegates to http adapter (calls /v1/extract)", async () => {
    await adapter.cu_extract({ session_id: "s", format: "text" });
    expect(httpMock.cu_extract).toHaveBeenCalledWith({ session_id: "s", format: "text" });
  });
});

describe("cu_replay", () => {
  it("always delegates to http adapter", async () => {
    await adapter.cu_replay({ recording_id: "rec-abc" });
    expect(httpMock.cu_replay).toHaveBeenCalledWith({ recording_id: "rec-abc" });
  });
});

describe("cu_record", () => {
  it("calls record_start for action=start", async () => {
    mockFetch.mockReturnValueOnce(mockMcpOk({ recording_id: "rec-1", path: "/tmp/r.jsonl" }));
    await adapter.cu_record({ session_id: "s", action: "start" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.name).toBe("record_start");
  });

  it("calls record_stop for action=stop", async () => {
    mockFetch.mockReturnValueOnce(mockMcpOk({ frames: 5, status: "stopped" }));
    await adapter.cu_record({ session_id: "s", action: "stop", recording_id: "rec-1" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.name).toBe("record_stop");
  });
});

describe("cu_execute_task", () => {
  it("calls execute_task MCP tool", async () => {
    mockFetch.mockReturnValueOnce(mockMcpOk({ success: true }));
    await adapter.cu_execute_task({ session_id: "s", task: "do X" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.name).toBe("execute_task");
    expect(body.arguments.task).toBe("do X");
  });
});
