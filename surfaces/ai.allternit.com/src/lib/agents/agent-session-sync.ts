/**
 * Agent-sessions `/sync` event contract.
 *
 * Source of truth is the data-plane transform, not the web store:
 *   - `cmd/allternit-api/src/agent_session_routes.rs` `transform_bus_event`
 *   - gizzi-code in-process mirror `cmd/gizzi-code/.../agent-compat.ts`
 *
 * Cloud-api `GET /api/v1/agent-sessions/sync` is a verbatim relay of that
 * stream (auth → default node → outbound WS). It must not reshape events.
 *
 * Wire types (SSE `data:` JSON):
 *   created        — transformSession fields + `type: "created"`
 *   updated        — `{ type, session_id, name, description, active, tags, metadata }`
 *   deleted        — `{ type, session_id }`
 *   message_added  — transformMessage fields + `type` + `session_id`
 *   permission_asked / permission_replied / question_asked
 *   part_updated / part_delta / part_removed
 *
 * `Last-Event-ID` (header) and `?since=` (query, gizzi + 8013) replay from the
 * bus cursor on reconnect.
 */

import type { BackendMessage, BackendSession } from "./native-agent-api";

export interface AgentSessionUpdatePatch {
  name?: string | null;
  description?: string | null;
  active?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export type AgentSessionSyncEvent =
  | { kind: "created"; session: BackendSession }
  | { kind: "updated"; sessionId: string; patch: AgentSessionUpdatePatch }
  | { kind: "deleted"; sessionId: string }
  | { kind: "message_added"; sessionId: string; message: BackendMessage }
  | { kind: "permission_asked"; sessionId: string | null; payload: Record<string, unknown> }
  | { kind: "permission_replied"; sessionId: string | null; payload: Record<string, unknown> }
  | { kind: "question_asked"; sessionId: string | null; payload: Record<string, unknown> }
  | { kind: "part_updated"; sessionId: string | null; payload: Record<string, unknown> }
  | { kind: "part_delta"; sessionId: string | null; payload: Record<string, unknown> }
  | { kind: "part_removed"; sessionId: string | null; payload: Record<string, unknown> };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringField(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function asBackendSession(obj: Record<string, unknown>): BackendSession | null {
  const id = stringField(obj, "id");
  if (!id) return null;
  const createdAt = typeof obj.created_at === "string" ? obj.created_at : new Date(0).toISOString();
  const updatedAt = typeof obj.updated_at === "string" ? obj.updated_at : createdAt;
  return {
    id,
    name: typeof obj.name === "string" ? obj.name : undefined,
    description: typeof obj.description === "string" ? obj.description : undefined,
    created_at: createdAt,
    updated_at: updatedAt,
    last_accessed: typeof obj.last_accessed === "string" ? obj.last_accessed : undefined,
    message_count: typeof obj.message_count === "number" ? obj.message_count : 0,
    active: typeof obj.active === "boolean" ? obj.active : undefined,
    tags: Array.isArray(obj.tags)
      ? obj.tags.filter((tag): tag is string => typeof tag === "string")
      : undefined,
    metadata: asRecord(obj.metadata) ?? undefined,
  };
}

function asBackendMessage(obj: Record<string, unknown>): BackendMessage | null {
  const id = stringField(obj, "id");
  const role = stringField(obj, "role");
  if (!id || !role) return null;
  return {
    id,
    role,
    content: typeof obj.content === "string" ? obj.content : "",
    thinking: typeof obj.thinking === "string" ? obj.thinking : undefined,
    timestamp: typeof obj.timestamp === "string" ? obj.timestamp : new Date(0).toISOString(),
    metadata: asRecord(obj.metadata) ?? undefined,
  };
}

function nestedPayload(obj: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(obj.payload);
}

/**
 * Parse one `/sync` SSE JSON payload into the service contract.
 * Also accepts the historical `{ type: "session.created", payload }` envelope
 * so a leftover producer cannot silently drop events, but tests pin the
 * service shape as canonical.
 */
export function parseAgentSessionSyncEvent(data: unknown): AgentSessionSyncEvent | null {
  const obj = asRecord(data);
  if (!obj) return null;
  const type = typeof obj.type === "string" ? obj.type : "";
  const payload = nestedPayload(obj);

  switch (type) {
    case "created": {
      const session = asBackendSession(obj);
      return session ? { kind: "created", session } : null;
    }
    case "session.created": {
      const session = asBackendSession(asRecord(payload?.session) ?? payload ?? {});
      return session ? { kind: "created", session } : null;
    }
    case "updated": {
      const sessionId = stringField(obj, "session_id", "sessionId");
      if (!sessionId) return null;
      return {
        kind: "updated",
        sessionId,
        patch: {
          name: typeof obj.name === "string" || obj.name === null ? (obj.name as string | null) : undefined,
          description:
            typeof obj.description === "string" || obj.description === null
              ? (obj.description as string | null)
              : undefined,
          active: typeof obj.active === "boolean" ? obj.active : undefined,
          tags: Array.isArray(obj.tags)
            ? obj.tags.filter((tag): tag is string => typeof tag === "string")
            : undefined,
          metadata: asRecord(obj.metadata) ?? undefined,
        },
      };
    }
    case "session.updated": {
      const nested = asRecord(payload?.session) ?? payload;
      if (!nested) return null;
      const session = asBackendSession(nested);
      const sessionId = session?.id ?? stringField(nested, "session_id", "sessionId", "id");
      if (!sessionId) return null;
      return {
        kind: "updated",
        sessionId,
        patch: {
          name: session?.name,
          description: session?.description ?? null,
          active: session?.active,
          tags: session?.tags,
          metadata: session?.metadata,
        },
      };
    }
    case "deleted": {
      const sessionId = stringField(obj, "session_id", "sessionId");
      return sessionId ? { kind: "deleted", sessionId } : null;
    }
    case "session.deleted": {
      const sessionId =
        stringField(payload ?? {}, "sessionId", "session_id") ?? stringField(obj, "session_id", "sessionId");
      return sessionId ? { kind: "deleted", sessionId } : null;
    }
    case "message_added": {
      const sessionId = stringField(obj, "session_id", "sessionId");
      const message = asBackendMessage(obj);
      return sessionId && message ? { kind: "message_added", sessionId, message } : null;
    }
    case "message.added": {
      const sessionId = stringField(payload ?? {}, "sessionId", "session_id");
      const message = asBackendMessage(asRecord(payload?.message) ?? {});
      return sessionId && message ? { kind: "message_added", sessionId, message } : null;
    }
    case "permission_asked":
    case "permission.asked":
      return {
        kind: "permission_asked",
        sessionId: stringField(obj, "session_id", "sessionId", "sessionID"),
        payload: obj,
      };
    case "permission_replied":
    case "permission.replied":
      return {
        kind: "permission_replied",
        sessionId: stringField(obj, "session_id", "sessionId", "sessionID"),
        payload: obj,
      };
    case "question_asked":
    case "question.asked":
      return {
        kind: "question_asked",
        sessionId: stringField(obj, "session_id", "sessionId", "sessionID"),
        payload: obj,
      };
    case "part_updated":
      return {
        kind: "part_updated",
        sessionId: stringField(obj, "session_id", "sessionId"),
        payload: obj,
      };
    case "part_delta":
      return {
        kind: "part_delta",
        sessionId: stringField(obj, "session_id", "sessionId"),
        payload: obj,
      };
    case "part_removed":
      return {
        kind: "part_removed",
        sessionId: stringField(obj, "session_id", "sessionId"),
        payload: obj,
      };
    default:
      return null;
  }
}

export function originSurfaceOf(metadata?: Record<string, unknown>): string | undefined {
  const value = metadata?.originSurface ?? metadata?.origin_surface;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
