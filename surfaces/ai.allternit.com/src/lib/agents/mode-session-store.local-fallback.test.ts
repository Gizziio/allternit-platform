import { describe, expect, it, vi, beforeEach } from "vitest";

const envMocks = vi.hoisted(() => ({
  isAgentSessionsApiEnabled: vi.fn(() => true),
  isDesktopOperatorShell: vi.fn(() => true),
  getCloudApiBaseUrl: vi.fn(() => "https://api.example.test"),
}));

vi.mock("@/lib/agents/api-config", () => ({
  buildAuthHeaders: async () => ({ Authorization: "Bearer test" }),
  gizziBaseUrl: () => "http://127.0.0.1:4096",
}));

vi.mock("@/lib/runtime-target", () => ({
  getActiveRuntimeId: () => undefined,
  getRuntimeExecutionTarget: () => "local",
}));

vi.mock("@/lib/env", () => ({
  env: () => undefined,
  envFlag: () => false,
  isAgentSessionsApiEnabled: () => envMocks.isAgentSessionsApiEnabled(),
  isDesktopOperatorShell: () => envMocks.isDesktopOperatorShell(),
  getCloudApiBaseUrl: () => envMocks.getCloudApiBaseUrl(),
}));

vi.mock("@/lib/agents/agent.store", () => ({
  useAgentStore: { getState: () => ({ agents: [] }) },
}));

vi.mock("@/lib/agents/memory-client", () => ({
  memoryClient: { recall: async () => [] },
}));

vi.mock("@/lib/agents/agent-session-sync", () => ({
  originSurfaceOf: () => "chat",
  parseAgentSessionSyncEvent: () => null,
}));

vi.mock("@/lib/canvas/canvas-artifact-events", () => ({
  emitArtifact: vi.fn(),
}));

vi.mock("@/lib/computers-api", () => ({
  deleteComputer: vi.fn(),
}));

vi.mock("@/lib/bots/bot-runtime-env", () => ({
  buildBotRuntimeEnv: vi.fn(),
}));

vi.mock("@/lib/bots/bot-memory-context", () => ({
  recallBotMemories: vi.fn(),
}));

vi.mock("@/lib/agents/provider-routing", () => ({
  resolveModelSelection: vi.fn(),
  resolveProviderRouting: vi.fn(),
}));

import {
  createModeSessionStore,
  shouldRetainPersistedSession,
} from "@/lib/agents/mode-session-store";

function makeSessionApi(overrides: Record<string, unknown> = {}) {
  return {
    listSessions: vi.fn(async () => ({ sessions: [] })),
    getSession: vi.fn(),
    createSession: vi.fn(async () => ({
      id: "ses_backend1",
      name: "Bot Chat",
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    updateSession: vi.fn(),
    deleteSession: vi.fn(async () => {}),
    getMessages: vi.fn(async () => []),
    ...overrides,
  };
}

describe("shouldRetainPersistedSession", () => {
  it("retains backend sessions", () => {
    expect(shouldRetainPersistedSession({ id: "ses_abc", metadata: {} })).toBe(true);
  });

  it("retains temp sessions with a real local mode (executionPersistence local + agentModeId)", () => {
    expect(
      shouldRetainPersistedSession({
        id: "temp-123",
        metadata: { executionPersistence: "local", agentModeId: "code" },
      }),
    ).toBe(true);
  });

  it("drops temp sessions with no local marker (plain optimistic leftovers)", () => {
    expect(shouldRetainPersistedSession({ id: "temp-123", metadata: {} })).toBe(false);
  });

  it("drops zombie temp sessions: executionPersistence local but no agentModeId (legacy bot sessions)", () => {
    expect(
      shouldRetainPersistedSession({
        id: "temp-123",
        metadata: { executionPersistence: "local", isBot: true },
      }),
    ).toBe(false);
  });
});

describe("createModeSessionStore bot session fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMocks.isAgentSessionsApiEnabled.mockReturnValue(true);
  });

  it("creates a backend session and returns the real id when the API succeeds", async () => {
    const store = createModeSessionStore({
      name: "test-chat",
      storageKey: "test-chat-store",
      originSurface: "chat",
      sessionApi: makeSessionApi() as never,
    });
    const id = await store.getState().createSession({
      name: "Gizzi",
      sessionMode: "agent",
      agentId: "bot-1",
      metadata: { isBot: true, agentId: "bot-1" },
    });
    expect(id).toBe("ses_backend1");
    expect(store.getState().sessions.some((s) => s.id === "ses_backend1")).toBe(true);
    expect(store.getState().sessions.some((s) => s.id.startsWith("temp-"))).toBe(false);
  });

  it("does NOT retain a zombie temp session when a bot create fails without a local mode", async () => {
    const failingApi = makeSessionApi({
      createSession: vi.fn(async () => {
        throw new Error("backend down");
      }),
    });
    const store = createModeSessionStore({
      name: "test-chat",
      storageKey: "test-chat-store",
      originSurface: "chat",
      sessionApi: failingApi as never,
    });
    await expect(
      store.getState().createSession({
        name: "Gizzi",
        sessionMode: "agent",
        agentId: "bot-1",
        metadata: { isBot: true, agentId: "bot-1" },
      }),
    ).rejects.toThrow("backend down");
    // The optimistic temp session must not linger: it has no executable mode.
    expect(store.getState().sessions).toHaveLength(0);
  });

  it("still falls back to a local session when a real mode id exists", async () => {
    const failingApi = makeSessionApi({
      createSession: vi.fn(async () => {
        throw new Error("backend down");
      }),
    });
    const store = createModeSessionStore({
      name: "test-code",
      storageKey: "test-code-store",
      originSurface: "code",
      sessionApi: failingApi as never,
    });
    const id = await store.getState().createSession({
      name: "Code",
      sessionMode: "agent",
      metadata: {},
    });
    expect(id.startsWith("temp-")).toBe(true);
    const session = store.getState().sessions.find((s) => s.id === id);
    expect(session?.metadata.executionPersistence).toBe("local");
    expect(session?.metadata.agentModeId).toBe("code");
  });
});
