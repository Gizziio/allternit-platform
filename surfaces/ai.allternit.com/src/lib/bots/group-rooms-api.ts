/**
 * Group Rooms API Client
 *
 * Thin client for the server-side group-room routes on the Rust allternit-api
 * (`cmd/allternit-api/src/group_rooms.rs`, mounted at `/api/group-rooms`).
 * Served only by the local gateway (:8013) — callers must gate on
 * `isRailsApiEnabled()` and fail closed, same as comrails-mail.store.
 *
 * @module group-rooms-api
 */

import { GATEWAY_BASE_URL, buildAuthHeaders } from '@/lib/agents/api-config';

const GROUP_ROOMS_BASE = `${GATEWAY_BASE_URL}/api/group-rooms`;

export interface GroupRoomProjectionDocument {
  /** Bounded message log (last 16, 1200 chars each — server enforces). */
  messages?: unknown[];
  /** Room members, when the client includes them for re-seed. */
  members?: unknown[];
  [key: string]: unknown;
}

export interface GroupRoomRecord {
  room_id: string;
  name: string;
  revision: number;
  tombstone: boolean;
  projection: GroupRoomProjectionDocument;
  updated_at: string;
}

export interface GroupRoomSummary {
  room_id: string;
  name: string;
  revision: number;
  tombstone: boolean;
  updated_at: string;
}

export interface GroupRoomHold {
  hold_id: string;
  room_id: string;
  member_id: string;
  kind: string;
  message_excerpt: string | null;
  created_at: string;
  resolved: boolean;
  resolved_at: string | null;
}

export interface PutProjectionInput {
  name?: string;
  projection: GroupRoomProjectionDocument;
  revision: number;
  expected_revision: number;
}

/** Error carrying the HTTP status + parsed `{ error, ... }` body. */
export class GroupRoomsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly body: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'GroupRoomsApiError';
  }
}

async function request<T>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const authHeaders = await buildAuthHeaders();
  const response = await fetch(`${GROUP_ROOMS_BASE}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    ...(options?.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const body = (data ?? {}) as Record<string, unknown>;
    const code = typeof body.error === 'string' ? body.error : `http_${response.status}`;
    throw new GroupRoomsApiError(response.status, code, body);
  }
  return data as T;
}

export const groupRoomsApi = {
  /** 404 when the room is tombstoned or absent. */
  getRoom: (roomId: string) =>
    request<GroupRoomRecord>(`/${encodeURIComponent(roomId)}`),

  listRooms: () => request<{ rooms: GroupRoomSummary[] }>(`/`),

  /** Rooms with revision > since_revision (includes tombstoned rooms). */
  changes: (sinceRevision: number) =>
    request<{ rooms: GroupRoomSummary[] }>(`/changes?since_revision=${sinceRevision}`),

  /** CAS write — 409 revision_conflict / room_tombstoned on mismatch. */
  putProjection: (roomId: string, input: PutProjectionInput) =>
    request<GroupRoomRecord>(`/${encodeURIComponent(roomId)}/projection`, {
      method: 'PUT',
      body: input,
    }),

  tombstone: (roomId: string) =>
    request<{ tombstoned: boolean }>(`/${encodeURIComponent(roomId)}/tombstone`, {
      method: 'POST',
    }),

  putWatermark: (roomId: string, memberId: string, lastSeenRevision: number) =>
    request<{ member_id: string; last_seen_revision: number }>(
      `/${encodeURIComponent(roomId)}/watermarks/${encodeURIComponent(memberId)}`,
      { method: 'PUT', body: { last_seen_revision: lastSeenRevision } },
    ),

  listWatermarks: (roomId: string) =>
    request<{ watermarks: Array<{ member_id: string; last_seen_revision: number }> }>(
      `/${encodeURIComponent(roomId)}/watermarks`,
    ),

  createHold: (
    roomId: string,
    input: { member_id: string; kind?: string; message_excerpt?: string },
  ) =>
    request<GroupRoomHold>(`/${encodeURIComponent(roomId)}/holds`, {
      method: 'POST',
      body: input,
    }),

  resolveHold: (roomId: string, holdId: string) =>
    request<{ resolved: boolean; found: boolean }>(
      `/${encodeURIComponent(roomId)}/holds/${encodeURIComponent(holdId)}/resolve`,
      { method: 'POST' },
    ),

  listHolds: (roomId: string, resolved?: boolean) =>
    request<{ holds: GroupRoomHold[] }>(
      `/${encodeURIComponent(roomId)}/holds${resolved === undefined ? '' : `?resolved=${resolved}`}`,
    ),
};
