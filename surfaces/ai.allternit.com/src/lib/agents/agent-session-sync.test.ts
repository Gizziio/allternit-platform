import { describe, expect, it } from "vitest";
import { originSurfaceOf, parseAgentSessionSyncEvent } from "./agent-session-sync";

/** Fixtures match `transform_bus_event` in agent_session_routes.rs. */
const CREATED = {
  type: "created",
  id: "ses_1",
  name: "New Session",
  description: null,
  created_at: "2026-09-10T00:00:00Z",
  updated_at: "2026-09-10T00:00:00Z",
  last_accessed: "2026-09-10T00:00:00Z",
  message_count: 0,
  active: true,
  tags: [],
  metadata: { originSurface: "chat", agentId: "agt_1" },
};

const UPDATED = {
  type: "updated",
  session_id: "ses_1",
  name: "Renamed",
  description: null,
  active: true,
  tags: [],
  metadata: { originSurface: "chat", directory: "/tmp" },
};

const DELETED = { type: "deleted", session_id: "ses_1" };

const MESSAGE_ADDED = {
  type: "message_added",
  session_id: "ses_1",
  id: "msg_1",
  role: "assistant",
  content: "hello",
  thinking: null,
  timestamp: "2026-09-10T00:00:01Z",
  metadata: { parts: [] },
};

describe("parseAgentSessionSyncEvent — service contract", () => {
  it("maps created (session fields at top level, not payload.session)", () => {
    const event = parseAgentSessionSyncEvent(CREATED);
    expect(event).toEqual({
      kind: "created",
      session: {
        id: "ses_1",
        name: "New Session",
        description: undefined,
        created_at: "2026-09-10T00:00:00Z",
        updated_at: "2026-09-10T00:00:00Z",
        last_accessed: "2026-09-10T00:00:00Z",
        message_count: 0,
        active: true,
        tags: [],
        metadata: { originSurface: "chat", agentId: "agt_1" },
      },
    });
    expect(originSurfaceOf(event && event.kind === "created" ? event.session.metadata : undefined)).toBe(
      "chat",
    );
  });

  it("does not treat the historical session.created envelope as the service default", () => {
    const invented = {
      type: "session.created",
      payload: { session: CREATED },
    };
    const event = parseAgentSessionSyncEvent(invented);
    expect(event?.kind).toBe("created");
    if (event?.kind === "created") expect(event.session.id).toBe("ses_1");
    expect(parseAgentSessionSyncEvent(CREATED)?.kind).toBe("created");
    expect(parseAgentSessionSyncEvent({ type: "session.created" })).toBeNull();
  });

  it("maps updated by session_id + patch, not payload.session", () => {
    const event = parseAgentSessionSyncEvent(UPDATED);
    expect(event).toEqual({
      kind: "updated",
      sessionId: "ses_1",
      patch: {
        name: "Renamed",
        description: null,
        active: true,
        tags: [],
        metadata: { originSurface: "chat", directory: "/tmp" },
      },
    });
  });

  it("maps deleted by session_id", () => {
    expect(parseAgentSessionSyncEvent(DELETED)).toEqual({ kind: "deleted", sessionId: "ses_1" });
  });

  it("maps message_added with top-level message fields", () => {
    const event = parseAgentSessionSyncEvent(MESSAGE_ADDED);
    expect(event?.kind).toBe("message_added");
    if (event?.kind === "message_added") {
      expect(event.sessionId).toBe("ses_1");
      expect(event.message).toMatchObject({ id: "msg_1", role: "assistant", content: "hello" });
    }
  });

  it("maps permission_asked / question_asked from the node feed", () => {
    const permission = parseAgentSessionSyncEvent({
      type: "permission_asked",
      request_id: "req_1",
      session_id: "ses_1",
      permission: "edit",
    });
    expect(permission).toMatchObject({ kind: "permission_asked", sessionId: "ses_1" });
    const question = parseAgentSessionSyncEvent({
      type: "question_asked",
      request_id: "q_1",
      session_id: "ses_1",
      questions: [{ text: "ok?" }],
    });
    expect(question).toMatchObject({ kind: "question_asked", sessionId: "ses_1" });
  });

  it("returns null for unknown types and non-objects", () => {
    expect(parseAgentSessionSyncEvent(null)).toBeNull();
    expect(parseAgentSessionSyncEvent("data: x")).toBeNull();
    expect(parseAgentSessionSyncEvent({ type: "snapshot" })).toBeNull();
  });
});
