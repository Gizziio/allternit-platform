// ============================================================================
// Browser-workflow verify API — typed client tests (mocked gateway)
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integration/computer-use-engine", () => ({
  getPlatformComputerUseBaseUrl: () => "http://127.0.0.1:8760",
}));

vi.mock("@/lib/cloud-api", () => ({
  cloudApiUrl: (path: string) => `https://api.allternit.com${path}`,
}));

import {
  WorkflowsApiError,
  checkVerifyReceipt,
  createFabricWorkflowsFetch,
  getVerifyResult,
  getWorkflowSpecDetail,
  isTerminalVerifyStatus,
  listWorkflowSpecs,
  pollVerifyUntilTerminal,
  startWorkflowVerify,
} from "./browser-skills-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SPEC_SUMMARY = {
  skill_id: "skill_a",
  source: "/skills/skill_a.json",
  valid: true,
  error: null,
  workflowId: "wf-a",
  title: "Checkout flow",
  provider: "playwright",
  stepCount: 3,
  hasNetworkTrace: true,
  networkTraceEntries: 2,
};

const SPEC_DETAIL = {
  workflowId: "wf-a",
  title: "Checkout flow",
  provider: "playwright",
  inputCount: 0,
  steps: [
    { id: "s1", kind: "type", target: "#name", reason: "fill name" },
    { id: "s3", kind: "click", target: "#submit", reason: "submit" },
  ],
  stepCount: 2,
  safety: { requiresApprovalFor: [], redactionCount: 0 },
  networkTrace: {
    version: 1,
    entries: [
      {
        method: "GET",
        host: "example.test",
        pathTemplate: "/form",
        payloadKeysHash: null,
        verifiable: true,
      },
    ],
  },
};

const VERIFY_RESULT = {
  verify_id: "verify-abc",
  status: "completed",
  mode: "target",
  workflow_id: "wf-a",
  target_url: "http://127.0.0.1:8734/form",
  network: { status: "pass", deviations: [] },
  a11y: { status: "unverifiable" },
  workflow_status: "completed",
  approvals: ["workflow.pause"],
  receipt_id: "rcpt-abc",
  receipt_hash: "deadbeef",
};

describe("listWorkflowSpecs", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse({ specs: [SPEC_SUMMARY], count: 1, skills_dir: "/skills" }),
    ));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lists distilled spec summaries from the gateway", async () => {
    const specs = await listWorkflowSpecs();
    expect(specs).toHaveLength(1);
    expect(specs[0].hasNetworkTrace).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://127.0.0.1:8760/v1/browser-skills",
      expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/json" }) }),
    );
  });

  it("surfaces gateway errors as WorkflowsApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ detail: "boom" }, 503)));
    await expect(listWorkflowSpecs()).rejects.toMatchObject({
      name: "WorkflowsApiError",
      status: 503,
      message: "boom",
    });
  });
});

describe("getWorkflowSpecDetail", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the distilled spec incl. the NetworkTrace", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ workflow: SPEC_DETAIL })));
    const detail = await getWorkflowSpecDetail("skill_a");
    expect(detail.networkTrace?.entries[0].pathTemplate).toBe("/form");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://127.0.0.1:8760/v1/browser-skills/skill_a",
      expect.anything(),
    );
  });
});

describe("startWorkflowVerify", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts the canned self-check with an empty body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse({ verify_id: "verify-abc", status: "running", mode: "canned", poll: "/v1/browser-skills/verify/verify-abc" }),
    ));
    const start = await startWorkflowVerify({});
    expect(start.verify_id).toBe("verify-abc");
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({});
  });

  it("sends skill id and target url for target verifies", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse({ verify_id: "verify-abc", status: "running" }),
    ));
    await startWorkflowVerify({ skillId: "skill_a", targetUrl: "http://127.0.0.1:8734/form" });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      skill_id: "skill_a",
      target_url: "http://127.0.0.1:8734/form",
    });
  });
});

describe("pollVerifyUntilTerminal", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("polls until a terminal status", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      return jsonResponse({
        ...VERIFY_RESULT,
        status: calls < 3 ? "running" : "completed",
      });
    }));
    const final = await pollVerifyUntilTerminal("verify-abc", { intervalMs: 0 });
    expect(final.status).toBe("completed");
    expect(calls).toBe(3);
  });

  it("isTerminalVerifyStatus treats completed/failed as terminal", () => {
    expect(isTerminalVerifyStatus("completed")).toBe(true);
    expect(isTerminalVerifyStatus("failed")).toBe(true);
    expect(isTerminalVerifyStatus("running")).toBe(false);
  });
});

describe("receipt check", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the recomputed-hash comparison", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse({
        verify_id: "verify-abc",
        receipt_id: "rcpt-abc",
        valid: true,
        stored_hash: "deadbeef",
        recomputed_hash: "deadbeef",
        tampered: false,
      }),
    ));
    const check = await checkVerifyReceipt("verify-abc");
    expect(check.valid).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://127.0.0.1:8760/v1/browser-skills/verify/verify-abc/receipt/check",
      expect.anything(),
    );
  });
});

describe("getVerifyResult", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches the verdict", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(VERIFY_RESULT)));
    const result = await getVerifyResult("verify-abc");
    expect(result.network?.status).toBe("pass");
  });

  it("throws WorkflowsApiError on 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ detail: "not found" }, 404)));
    await expect(getVerifyResult("verify-nope")).rejects.toBeInstanceOf(WorkflowsApiError);
  });
});

describe("createFabricWorkflowsFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("relays /v1/browser-skills through the runtime-devices proxy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ specs: [] })));
    const transport = createFabricWorkflowsFetch("rt_1", async () => "tok");
    await listWorkflowSpecs({ fetch: transport });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "https://api.allternit.com/api/v1/runtime-devices/rt_1/proxy",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      }),
    );
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      method: "GET",
      path: "/v1/browser-skills",
      body: "",
      bodyEncoding: "utf8",
    });
  });
});
