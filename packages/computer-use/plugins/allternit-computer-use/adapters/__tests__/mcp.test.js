"use strict";

/**
 * Unit tests for the ACU MCP adapter.
 * Tests tool registration against a mocked MCP server.
 */

const { jest } = require("@jest/globals");

const mockFetch = jest.fn();
global.fetch = mockFetch;

const { register } = require("../mcp");

function mockOk(data) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

function createMockServer() {
  return {
    tools: [],
    registerTool(tool) {
      this.tools.push(tool);
    },
    findTool(name) {
      return this.tools.find((t) => t.name === name);
    },
  };
}

describe("register", () => {
  it("registers expected tools", () => {
    const server = createMockServer();
    register(server, { gateway_url: "http://gw.test" });
    const names = server.tools.map((t) => t.name);
    expect(names).toContain("cu_automate");
    expect(names).toContain("cu_screenshot");
    expect(names).toContain("cu_extract");
    expect(names).toContain("cu_record");
    expect(names).toContain("cu_replay");
  });

  describe("cu_automate handler", () => {
    it("POSTs to /v1/computer-use/execute", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ status: "completed" }));
      const server = createMockServer();
      register(server, { gateway_url: "http://gw.test" });
      const tool = server.findTool("cu_automate");
      await tool.handler({ task: "do X", scope: "desktop" });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("http://gw.test/v1/computer-use/execute");
      const body = JSON.parse(opts.body);
      expect(body.task).toBe("do X");
      expect(body.target_scope).toBe("desktop");
    });
  });

  describe("cu_screenshot handler", () => {
    it("POSTs to /v1/screenshot", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ status: "completed" }));
      const server = createMockServer();
      register(server, { gateway_url: "http://gw.test" });
      const tool = server.findTool("cu_screenshot");
      await tool.handler({ session_id: "s1", annotate: true });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.session_id).toBe("s1");
      expect(body.annotate).toBe(true);
    });
  });

  describe("cu_extract handler", () => {
    it("POSTs to /v1/inspect with target and strategy", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ status: "completed" }));
      const server = createMockServer();
      register(server, { gateway_url: "http://gw.test" });
      const tool = server.findTool("cu_extract");
      await tool.handler({ session_id: "s1", what: "prices", strategy: "selector", format: "json" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.target).toBe("prices");
      expect(body.parameters.strategy).toBe("selector");
      expect(body.parameters.format).toBe("json");
    });
  });

  describe("cu_record handler", () => {
    it("POSTs to /v1/computer-use/record", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ recording_id: "rec-1" }));
      const server = createMockServer();
      register(server, { gateway_url: "http://gw.test" });
      const tool = server.findTool("cu_record");
      await tool.handler({ action: "start", session_id: "s1", name: "run" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.action).toBe("start");
      expect(body.name).toBe("run");
    });
  });

  describe("cu_replay handler", () => {
    it("POSTs to /v1/computer-use/replay", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ status: "completed" }));
      const server = createMockServer();
      register(server, { gateway_url: "http://gw.test" });
      const tool = server.findTool("cu_replay");
      await tool.handler({ recording_id: "rec-1", export_gif: true, speed: 2 });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.recording_id).toBe("rec-1");
      expect(body.export_gif).toBe(true);
      expect(body.speed).toBe(2);
    });
  });
});
