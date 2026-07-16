"use strict";

/**
 * Unit tests for the ACU HTTP adapter.
 * All HTTP calls are mocked — no real gateway required.
 */

// Mock global fetch before requiring the module
const mockFetch = jest.fn();
global.fetch = mockFetch;

const { ComputerUseHttpAdapter } = require("../http");

function mockOk(data) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function mockError(status, body = "error") {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ detail: body }),
    text: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("ComputerUseHttpAdapter", () => {
  it("uses default gateway URL", () => {
    const adapter = new ComputerUseHttpAdapter();
    expect(adapter.gatewayUrl).toBe("http://localhost:8760");
  });

  it("strips trailing slash from gateway URL", () => {
    const adapter = new ComputerUseHttpAdapter({ gateway_url: "http://gw.example.com/" });
    expect(adapter.gatewayUrl).toBe("http://gw.example.com");
  });

  describe("execute", () => {
    it("POSTs to /v1/computer-use/execute with options", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ status: "completed", result: { steps: [] } }));
      const adapter = new ComputerUseHttpAdapter();
      const res = await adapter.execute({
        task: "do something",
        scope: "browser",
        approval_policy: "never",
      });
      expect(res.ok).toBe(true);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/v1/computer-use/execute");
      const body = JSON.parse(opts.body);
      expect(body.mode).toBe("intent");
      expect(body.task).toBe("do something");
      expect(body.target_scope).toBe("browser");
      expect(body.options.approval_policy).toBe("never");
    });
  });

  describe("screenshot", () => {
    it("POSTs to /v1/screenshot", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ status: "completed", artifacts: [] }));
      const adapter = new ComputerUseHttpAdapter();
      const res = await adapter.screenshot("sess-1", true);
      expect(res.ok).toBe(true);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/v1/screenshot");
      const body = JSON.parse(opts.body);
      expect(body.session_id).toBe("sess-1");
      expect(body.annotate).toBe(true);
    });
  });

  describe("navigate", () => {
    it("POSTs to /v1/navigate", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ status: "completed" }));
      const adapter = new ComputerUseHttpAdapter();
      const res = await adapter.navigate("sess-1", "https://example.com");
      expect(res.ok).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.session_id).toBe("sess-1");
      expect(body.url).toBe("https://example.com");
    });
  });

  describe("extract", () => {
    it("POSTs to /v1/inspect with strategy and format", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ status: "completed" }));
      const adapter = new ComputerUseHttpAdapter();
      const res = await adapter.inspect("sess-1", "prices", "selector");
      expect(res.ok).toBe(true);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/v1/inspect");
      const body = JSON.parse(opts.body);
      expect(body.session_id).toBe("sess-1");
      expect(body.target).toBe("prices");
      expect(body.parameters.strategy).toBe("selector");
    });
  });

  describe("record", () => {
    it("POSTs to /v1/computer-use/record", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ recording_id: "rec-abc", status: "recording" }));
      const adapter = new ComputerUseHttpAdapter();
      const res = await adapter.record({ action: "start", session_id: "s", name: "my-run" });
      expect(res.ok).toBe(true);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/v1/computer-use/record");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.action).toBe("start");
      expect(body.name).toBe("my-run");
    });
  });

  describe("sessions", () => {
    it("lists sessions via GET", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ sessions: [] }));
      const adapter = new ComputerUseHttpAdapter();
      const res = await adapter.listSessions();
      expect(res.ok).toBe(true);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/v1/computer-use/sessions");
    });

    it("creates a session via POST", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ session_id: "sess-1" }));
      const adapter = new ComputerUseHttpAdapter();
      const res = await adapter.createSession();
      expect(res.ok).toBe(true);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/v1/computer-use/sessions");
      expect(opts.method).toBe("POST");
    });

    it("deletes a session via DELETE", async () => {
      mockFetch.mockReturnValueOnce(mockOk({ status: "closed" }));
      const adapter = new ComputerUseHttpAdapter();
      const res = await adapter.deleteSession("sess-1");
      expect(res.ok).toBe(true);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/v1/computer-use/sessions/sess-1");
      expect(opts.method).toBe("DELETE");
    });
  });

  describe("error handling", () => {
    it("returns { ok: false, error } on HTTP error", async () => {
      mockFetch.mockReturnValueOnce(mockError(500, "Internal Server Error"));
      const adapter = new ComputerUseHttpAdapter();
      const res = await adapter.screenshot("s");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("500");
    });

    it("returns { ok: false, error } on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const adapter = new ComputerUseHttpAdapter();
      const res = await adapter.health();
      expect(res.ok).toBe(false);
      expect(res.error).toBe("ECONNREFUSED");
    });
  });
});
