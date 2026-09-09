// ============================================================================
// Session Replay API — typed client tests (mocked gateway)
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integration/computer-use-engine", () => ({
  getPlatformComputerUseBaseUrl: () => "http://127.0.0.1:8760",
}));

import {
  RecordingDetailUnavailableError,
  RecordingsApiError,
  WorkflowNotCompiledError,
  getRecordingDetail,
  getRunStatus,
  isTerminalRunStatus,
  listRecordings,
  parseRecordingJsonl,
  pollRunUntilTerminal,
  replayRecording,
  resolveRunApproval,
  runCompiledWorkflow,
} from "./recordings";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const MANIFEST_LINE = JSON.stringify({
  recording_id: "rec-1",
  task: "Log in and check out",
  session_id: "sess-1",
  run_id: "run-1",
  started_at: "2026-09-08T10:00:00Z",
  total_steps: 2,
  status: "completed",
  gif_path: "/tmp/rec-1.gif",
});

const STEP_LINES = [
  JSON.stringify({
    recording_id: "rec-1",
    step: 1,
    timestamp: "2026-09-08T10:00:01Z",
    action_type: "click",
    action_target: "button#login",
    action_params: { x: 10, y: 20 },
    reasoning: "Login required first",
    action_succeeded: true,
    risk_level: "low",
  }),
  JSON.stringify({
    recording_id: "rec-1",
    step: 2,
    timestamp: "2026-09-08T10:00:02Z",
    action_type: "type",
    action_target: "input#email",
    action_params: { text: "a@b.c" },
    reasoning: "Enter email",
    action_succeeded: false,
    risk_level: "medium",
  }),
];

describe("parseRecordingJsonl", () => {
  it("parses manifest and steps from JSONL text", () => {
    const detail = parseRecordingJsonl([MANIFEST_LINE, ...STEP_LINES].join("\n"));
    expect(detail.manifest.recording_id).toBe("rec-1");
    expect(detail.manifest.total_steps).toBe(2);
    expect(detail.steps).toHaveLength(2);
    expect(detail.steps[0].action_type).toBe("click");
    expect(detail.steps[1].action_succeeded).toBe(false);
    expect(detail.steps[1].risk_level).toBe("medium");
    expect(detail.gifUrl).toBeNull();
  });

  it("throws a RecordingsApiError on empty input", () => {
    expect(() => parseRecordingJsonl("")).toThrow(RecordingsApiError);
  });
});

describe("listRecordings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the recordings array", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        recordings: [
          {
            recording_id: "rec-1",
            task: "t",
            status: "completed",
            started_at: "2026-09-08T10:00:00Z",
            total_steps: 2,
            path: "/x/rec-1.jsonl",
          },
        ],
      }),
    );
    const recordings = await listRecordings();
    expect(recordings).toHaveLength(1);
    expect(recordings[0].recording_id).toBe("rec-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8760/v1/computer-use/recordings",
      expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/json" }) }),
    );
  });

  it("surfaces gateway errors with status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: "ActionRecorder not available" }, 503));
    await expect(listRecordings()).rejects.toMatchObject({
      status: 503,
      message: "ActionRecorder not available",
    });
  });
});

describe("getRecordingDetail", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("URL", Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:fake-gif"),
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the detail endpoint when present and serves the GIF", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        manifest: { recording_id: "rec-1", task: "t", total_steps: 1, status: "completed" },
        steps: [{ step: 1, action_type: "click", action_target: "b" }],
        gif_url: "http://gateway/v1/computer-use/recordings/rec-1/gif",
      }),
    );

    const detail = await getRecordingDetail("rec-1");
    expect(detail.steps).toHaveLength(1);
    expect(detail.steps[0].action_type).toBe("click");
    expect(detail.gifUrl).toBe("http://gateway/v1/computer-use/recordings/rec-1/gif");
    // No GIF probe: gif_url came straight from the detail payload.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the JSONL file route when the detail endpoint 404s", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: "Not Found" }, 404))
      .mockResolvedValueOnce(new Response([MANIFEST_LINE, ...STEP_LINES].join("\n"), { status: 200 }))
      .mockResolvedValueOnce(new Response("GIF89a", { status: 200 }));

    const detail = await getRecordingDetail("rec-1");
    expect(detail.manifest.recording_id).toBe("rec-1");
    expect(detail.steps).toHaveLength(2);
    expect(detail.steps[0].action_type).toBe("click");
    expect(detail.gifUrl).toBe("blob:fake-gif");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "http://127.0.0.1:8760/v1/computer-use/recordings/rec-1/file",
    );
  });

  it("probes the GIF route when the detail endpoint omits gif_url", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          manifest: { recording_id: "rec-1", total_steps: 0, status: "completed" },
          steps: [],
        }),
      )
      .mockResolvedValueOnce(new Response("GIF89a", { status: 200 }));

    const detail = await getRecordingDetail("rec-1");
    expect(detail.gifUrl).toBe("blob:fake-gif");
  });

  it("throws RecordingDetailUnavailableError when neither route exists", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: "Not Found" }, 404))
      .mockResolvedValueOnce(jsonResponse({ detail: "Not Found" }, 404));

    await expect(getRecordingDetail("rec-1")).rejects.toBeInstanceOf(
      RecordingDetailUnavailableError,
    );
  });
});

describe("replayRecording", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the recording id and deviation threshold", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ run_id: "replay-abc", status: "running" }));
    const ref = await replayRecording("rec-1", 0.1);
    expect(ref.run_id).toBe("replay-abc");
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8760/v1/computer-use/replay");
    expect(JSON.parse(String(init?.body))).toEqual({
      recording_id: "rec-1",
      deviation_threshold: 0.1,
    });
  });
});

describe("runCompiledWorkflow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the skill id to /v1/browser-skills/run", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ run_id: "wf-abc", status: "running" }));
    const ref = await runCompiledWorkflow("skill_rec_1");
    expect(ref.run_id).toBe("wf-abc");
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8760/v1/browser-skills/run");
    expect(JSON.parse(String(init?.body))).toEqual({ skill_id: "skill_rec_1" });
  });

  it("maps 404 to WorkflowNotCompiledError with a compile-first hint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: "Skill 'skill_rec_1' not found" }, 404));
    const error = await runCompiledWorkflow("skill_rec_1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WorkflowNotCompiledError);
    expect((error as Error).message).toMatch(/Compile this recording first/);
  });
});

describe("getRunStatus / resolveRunApproval", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes the run status payload", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ run_id: "run-1", status: "awaiting_approval", completed: false }),
    );
    const status = await getRunStatus("run-1");
    expect(status.status).toBe("awaiting_approval");
    expect(status.completed).toBe(false);
  });

  it("POSTs the approval decision", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ run_id: "run-1", status: "running" }));
    await resolveRunApproval("run-1", "approve");
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8760/v1/computer-use/runs/run-1/approve");
    expect(JSON.parse(String(init?.body))).toEqual({ decision: "approve" });
  });
});

describe("pollRunUntilTerminal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("polls until a terminal status and reports each update", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ run_id: "r", status: "running", completed: false }))
      .mockResolvedValueOnce(jsonResponse({ run_id: "r", status: "awaiting_approval", completed: false }))
      .mockResolvedValueOnce(jsonResponse({ run_id: "r", status: "completed", completed: true }));

    const updates: string[] = [];
    const pollPromise = pollRunUntilTerminal("r", {
      intervalMs: 1000,
      onUpdate: (s) => updates.push(s.status),
    });
    await vi.runAllTimersAsync();
    const final = await pollPromise;

    expect(final.status).toBe("completed");
    expect(updates).toEqual(["running", "awaiting_approval", "completed"]);
  });
});

describe("isTerminalRunStatus", () => {
  it("treats completed/failed/cancelled as terminal", () => {
    expect(isTerminalRunStatus("completed")).toBe(true);
    expect(isTerminalRunStatus("failed")).toBe(true);
    expect(isTerminalRunStatus("cancelled")).toBe(true);
    expect(isTerminalRunStatus("running")).toBe(false);
    expect(isTerminalRunStatus("awaiting_approval")).toBe(false);
  });
});
