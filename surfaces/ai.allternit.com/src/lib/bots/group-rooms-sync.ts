/**
 * Group Rooms Sync
 *
 * Server-side persistence & sync for bot group rooms (BOT_TEAMMATES_SPEC
 * Phase 4, AD-2). The local zustand group-chat store stays the source of
 * truth for live turns; this layer mirrors a bounded projection to the Rust
 * API so rooms survive reloads and cross-surface usage.
 *
 * Semantics (mirroring Hermes' group-chat.ts):
 * - Bounded projection: last 16 messages, 1200 chars/message, ≤48KB total
 *   (client clips; the server enforces the same caps at write).
 * - CAS pushes: PUT carries `expected_revision`; a 409 revision_conflict
 *   triggers pull → merge (log is append-only: union of message ids, ordered
 *   by timestamp; name/revision: higher revision wins) → one retry.
 * - Tombstones: disband is final. Server tombstones apply locally (room
 *   deleted, id recorded so a later pull can't resurrect it); local disband
 *   tombstones the server room. Writes to a tombstoned room are rejected.
 * - Re-seed: pull `changes?since=N`; rooms the server has but the local
 *   store lacks are recreated from the projection.
 * - Per-member watermarks: the turn runner feeds each member only messages
 *   appended since its watermark (local index into the room log), bumped
 *   after each member turn; mirrored to the API when enabled.
 * - Needs-you escalations: member replies that @user create a server hold,
 *   surfaced in the Inbox pane.
 *
 * Everything is gated on the Rails/API env flag and fails closed, same as
 * comrails-mail.store.
 *
 * @module group-rooms-sync
 */

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { isRailsApiEnabled } from '@/lib/env';
import { createModuleLogger } from '@/lib/logger';
import {
  GroupRoomsApiError,
  groupRoomsApi,
  type GroupRoomHold,
  type GroupRoomProjectionDocument,
  type GroupRoomRecord,
} from './group-rooms-api';
import type { GroupChat, GroupChatMember, GroupChatMessage } from './group-chat.types';
import { useGroupChatStore } from './group-chat.store';

const logger = createModuleLogger('GroupRoomsSync');

// Projection caps — keep in sync with cmd/allternit-api/src/group_rooms.rs.
export const GROUP_ROOM_MAX_MESSAGES = 16;
export const GROUP_ROOM_MAX_MESSAGE_CHARS = 1200;
export const GROUP_ROOM_MAX_PROJECTION_BYTES = 48 * 1024;

/** Member history window cap — matches group-chat-turn-runner's MAX_HISTORY_MESSAGES. */
export const MEMBER_HISTORY_MAX_MESSAGES = 30;

// ---------------------------------------------------------------------------
// Sync store (persisted): server-side bookkeeping per room.
// ---------------------------------------------------------------------------

export interface GroupRoomsSyncState {
  /** Last server revision observed per room (0 = unknown). */
  lastKnownRevision: Record<string, number>;
  /** Room ids disbanded on either side — never re-seeded, never pushed. */
  tombstonedRoomIds: string[];
  /** Room ids that exist (or existed) on the server — drives disband detection. */
  pushedRoomIds: string[];
  /** Per-member read positions: roomId → memberId → index into the room log. */
  watermarks: Record<string, Record<string, number>>;
  /** Unresolved holds mirrored from the API for the Inbox pane. */
  holds: GroupRoomHold[];
  lastPullAt: number;
}

/** In-memory fallback for environments where localStorage throws (jsdom). */
const memoryStorage = (() => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } satisfies StateStorage;
})();

const safeStorage = createJSONStorage(() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // jsdom / restricted environments — fall back to memory.
  }
  return memoryStorage;
});

export const useGroupRoomsSyncStore = create<GroupRoomsSyncState>()(
  persist(
    (set) => ({
      lastKnownRevision: {},
      tombstonedRoomIds: [],
      pushedRoomIds: [],
      watermarks: {},
      holds: [],
      lastPullAt: 0,
    }),
    {
      name: 'allternit-group-rooms-sync',
      storage: safeStorage,
      partialize: (state) => ({
        lastKnownRevision: state.lastKnownRevision,
        tombstonedRoomIds: state.tombstonedRoomIds,
        pushedRoomIds: state.pushedRoomIds,
        watermarks: state.watermarks,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested).
// ---------------------------------------------------------------------------

/** Clip a message log to the bounded projection caps. */
export function clipProjectionMessages(
  messages: GroupChatMessage[],
): GroupChatMessage[] {
  return messages
    .slice(-GROUP_ROOM_MAX_MESSAGES)
    .map((m) =>
      m.text.length > GROUP_ROOM_MAX_MESSAGE_CHARS
        ? { ...m, text: m.text.slice(0, GROUP_ROOM_MAX_MESSAGE_CHARS) }
        : m,
    );
}

/** Build the bounded projection document pushed to the API. */
export function buildRoomProjection(group: GroupChat): GroupRoomProjectionDocument {
  return {
    name: group.name,
    members: group.members,
    messages: clipProjectionMessages(group.log),
  };
}

function normalizeMessages(raw: unknown): GroupChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: GroupChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    if (typeof m.id !== 'string' || typeof m.text !== 'string') continue;
    out.push({
      id: m.id,
      from: m.from === 'bot' ? 'bot' : 'user',
      ...(typeof m.botId === 'string' ? { botId: m.botId } : {}),
      ...(typeof m.displayName === 'string' ? { displayName: m.displayName } : {}),
      text: m.text,
      timestamp: typeof m.timestamp === 'string' ? m.timestamp : new Date(0).toISOString(),
    });
  }
  return out;
}

/**
 * Merge a server projection into a local room. The log is append-only on
 * both sides, so the merge is the union of message ids ordered by
 * timestamp; name follows the higher revision (the server record is only
 * merged after a CAS conflict, which means its revision is ahead).
 */
export function mergeGroupChatWithProjection(
  local: GroupChat,
  remote: GroupRoomRecord,
): GroupChat {
  const byId = new Map<string, GroupChatMessage>();
  for (const m of normalizeMessages(remote.projection.messages)) byId.set(m.id, m);
  for (const m of local.log) byId.set(m.id, m);
  const log = [...byId.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const updatedAt =
    remote.updated_at > local.updatedAt ? remote.updated_at : local.updatedAt;
  return { ...local, name: remote.name, log, updatedAt };
}

/** Reconstruct a local room from a server record (re-seed path). */
export function seedGroupFromProjection(remote: GroupRoomRecord): GroupChat {
  const members = Array.isArray(remote.projection.members)
    ? (remote.projection.members as GroupChatMember[])
    : [];
  return {
    id: remote.room_id,
    name: remote.name,
    members,
    log: normalizeMessages(remote.projection.messages),
    createdAt: remote.updated_at,
    updatedAt: remote.updated_at,
  };
}

/**
 * Watermark gating math: the history window for a member is the room log
 * entries appended since its watermark, capped at the most recent
 * `maxMessages` of that window. A watermark of 0 (or beyond the log, after
 * a trim) preserves the legacy "last maxMessages" behavior.
 */
export function computeMemberHistory(
  log: GroupChatMessage[],
  watermarkIndex: number,
  maxMessages: number = MEMBER_HISTORY_MAX_MESSAGES,
): GroupChatMessage[] {
  const start = Math.max(0, Math.min(Math.floor(watermarkIndex), log.length));
  return log.slice(start).slice(-maxMessages);
}

// ---------------------------------------------------------------------------
// Local store application (tombstones / merges / seeds).
// ---------------------------------------------------------------------------

/** Guard: set while applying a server tombstone so the disband watcher
 *  doesn't echo it back to the API. */
let applyingServerTombstone = false;

export function applyServerTombstone(roomId: string): void {
  applyingServerTombstone = true;
  try {
    useGroupChatStore.setState((state) => {
      if (!state.groups[roomId]) return state;
      const groups = { ...state.groups };
      delete groups[roomId];
      const lastReadAt = { ...state.lastReadAt };
      delete lastReadAt[roomId];
      return {
        groups,
        lastReadAt,
        activeGroupId: state.activeGroupId === roomId ? null : state.activeGroupId,
      };
    });
  } finally {
    applyingServerTombstone = false;
  }
  useGroupRoomsSyncStore.setState((s) => {
    const lastKnownRevision = { ...s.lastKnownRevision };
    delete lastKnownRevision[roomId];
    const watermarks = { ...s.watermarks };
    delete watermarks[roomId];
    return {
      tombstonedRoomIds: s.tombstonedRoomIds.includes(roomId)
        ? s.tombstonedRoomIds
        : [...s.tombstonedRoomIds, roomId],
      pushedRoomIds: s.pushedRoomIds.filter((id) => id !== roomId),
      lastKnownRevision,
      watermarks,
      holds: s.holds.filter((h) => h.room_id !== roomId),
    };
  });
}

/** Merge a server record into the local store (seed when absent). */
export function applyServerProjection(remote: GroupRoomRecord): void {
  useGroupChatStore.setState((state) => {
    const existing = state.groups[remote.room_id];
    if (!existing) {
      return {
        groups: {
          ...state.groups,
          [remote.room_id]: seedGroupFromProjection(remote),
        },
      };
    }
    return {
      groups: {
        ...state.groups,
        [remote.room_id]: mergeGroupChatWithProjection(existing, remote),
      },
    };
  });
  useGroupRoomsSyncStore.setState((s) => ({
    lastKnownRevision: {
      ...s.lastKnownRevision,
      [remote.room_id]: remote.revision,
    },
  }));
}

// ---------------------------------------------------------------------------
// Push / pull.
// ---------------------------------------------------------------------------

export type PushResult = 'synced' | 'merged' | 'disabled' | 'tombstoned' | 'skipped';

/**
 * Push a local room to the API with CAS retry. On 409 revision_conflict:
 * pull the fresh record, merge (append-only union; server name wins), and
 * retry exactly once. A tombstoned server room deletes the local copy —
 * disband can't resurrect.
 */
export async function pushGroupRoom(roomId: string): Promise<PushResult> {
  if (!isRailsApiEnabled()) return 'disabled';
  const sync = useGroupRoomsSyncStore.getState();
  if (sync.tombstonedRoomIds.includes(roomId)) return 'skipped';
  const group = useGroupChatStore.getState().groups[roomId];
  if (!group) return 'skipped';

  let expected = sync.lastKnownRevision[roomId] ?? 0;
  let projection = buildRoomProjection(group);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const record = await groupRoomsApi.putProjection(roomId, {
        name: group.name,
        projection,
        revision: expected + 1,
        expected_revision: expected,
      });
      useGroupRoomsSyncStore.setState((s) => ({
        lastKnownRevision: { ...s.lastKnownRevision, [roomId]: record.revision },
        pushedRoomIds: s.pushedRoomIds.includes(roomId)
          ? s.pushedRoomIds
          : [...s.pushedRoomIds, roomId],
      }));
      return attempt === 0 ? 'synced' : 'merged';
    } catch (err) {
      if (err instanceof GroupRoomsApiError && err.code === 'revision_conflict') {
        const remote = await groupRoomsApi.getRoom(roomId).catch(() => null);
        if (!remote) {
          // Room vanished server-side (or raced tombstone→delete); recreate.
          expected = 0;
          continue;
        }
        applyServerProjection(remote);
        const merged = useGroupChatStore.getState().groups[roomId];
        if (!merged) return 'skipped';
        projection = buildRoomProjection(merged);
        expected = remote.revision;
        continue;
      }
      if (err instanceof GroupRoomsApiError && err.code === 'room_tombstoned') {
        applyServerTombstone(roomId);
        return 'tombstoned';
      }
      logger.warn({ roomId, err }, 'group-rooms: push failed');
      return 'skipped';
    }
  }
  return 'skipped';
}

/**
 * Incremental pull: fetch rooms changed since the highest revision we've
 * seen, apply tombstones, merge updated rooms, re-seed missing ones, then
 * push local rooms the server doesn't know about yet.
 */
export async function pullGroupRoomChanges(): Promise<void> {
  if (!isRailsApiEnabled()) return;
  const sync = useGroupRoomsSyncStore.getState();
  const since = Math.max(0, ...Object.values(sync.lastKnownRevision));

  let changed: Array<{ room_id: string; revision: number; tombstone: boolean }> = [];
  try {
    const res = await groupRoomsApi.changes(since);
    changed = res.rooms;
  } catch (err) {
    logger.warn({ err }, 'group-rooms: changes pull failed');
    return;
  }

  for (const summary of changed) {
    if (summary.tombstone) {
      applyServerTombstone(summary.room_id);
      continue;
    }
    const known = useGroupRoomsSyncStore.getState().lastKnownRevision[summary.room_id] ?? 0;
    const localExists = Boolean(useGroupChatStore.getState().groups[summary.room_id]);
    if (!localExists && useGroupRoomsSyncStore.getState().tombstonedRoomIds.includes(summary.room_id)) {
      continue; // Disbanded here — the server copy must not resurrect it.
    }
    if (localExists && known >= summary.revision) continue;
    try {
      const full = await groupRoomsApi.getRoom(summary.room_id);
      applyServerProjection(full);
    } catch (err) {
      logger.warn({ roomId: summary.room_id, err }, 'group-rooms: room pull failed');
    }
  }

  // Push rooms created locally while offline / not yet known to the server.
  const localIds = Object.keys(useGroupChatStore.getState().groups);
  const pushed = new Set(useGroupRoomsSyncStore.getState().pushedRoomIds);
  const tombstoned = new Set(useGroupRoomsSyncStore.getState().tombstonedRoomIds);
  for (const roomId of localIds) {
    if (pushed.has(roomId) || tombstoned.has(roomId)) continue;
    await pushGroupRoom(roomId);
  }

  useGroupRoomsSyncStore.setState({ lastPullAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Watermarks (per-member read positions).
// ---------------------------------------------------------------------------

/** Read position (index into the room log) for a member; 0 = unseen. */
export function getMemberWatermarkIndex(roomId: string, memberId: string): number {
  return useGroupRoomsSyncStore.getState().watermarks[roomId]?.[memberId] ?? 0;
}

/** Bump a member's watermark to the current log length, after its turn. */
export function bumpMemberWatermark(roomId: string, memberId: string): void {
  const logLength = useGroupChatStore.getState().groups[roomId]?.log.length ?? 0;
  useGroupRoomsSyncStore.setState((s) => ({
    watermarks: {
      ...s.watermarks,
      [roomId]: { ...s.watermarks[roomId], [memberId]: logLength },
    },
  }));
  // Mirror to the API (read position = last observed server revision).
  if (isRailsApiEnabled()) {
    const revision = useGroupRoomsSyncStore.getState().lastKnownRevision[roomId];
    if (revision) {
      void groupRoomsApi.putWatermark(roomId, memberId, revision).catch(() => {
        /* local watermark already bumped */
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Escalations (needs-you holds).
// ---------------------------------------------------------------------------

/** Create a server hold for a member reply that escalated @user. */
export async function createEscalationHold(
  roomId: string,
  memberId: string,
  excerpt: string,
): Promise<GroupRoomHold | null> {
  if (!isRailsApiEnabled()) return null;
  try {
    const hold = await groupRoomsApi.createHold(roomId, {
      member_id: memberId,
      kind: 'needs_you',
      message_excerpt: excerpt.slice(0, 280),
    });
    useGroupRoomsSyncStore.setState((s) => ({ holds: [...s.holds, hold] }));
    return hold;
  } catch (err) {
    logger.warn({ roomId, memberId, err }, 'group-rooms: hold creation failed');
    return null;
  }
}

/** Resolve a hold — call after the room view was opened (fire-and-forget). */
export async function resolveGroupRoomHold(roomId: string, holdId: string): Promise<void> {
  useGroupRoomsSyncStore.setState((s) => ({
    holds: s.holds.map((h) => (h.hold_id === holdId ? { ...h, resolved: true } : h)),
  }));
  if (!isRailsApiEnabled()) return;
  await groupRoomsApi.resolveHold(roomId, holdId).catch(() => {
    /* stays unresolved server-side; next refresh retries the view */
  });
}

/** Refresh the unresolved-holds mirror for all known rooms (Inbox pane). */
export async function refreshGroupEscalations(): Promise<GroupRoomHold[]> {
  if (!isRailsApiEnabled()) return [];
  const sync = useGroupRoomsSyncStore.getState();
  const roomIds = new Set<string>([
    ...Object.keys(useGroupChatStore.getState().groups),
    ...sync.pushedRoomIds,
  ]);
  const byId = new Map<string, GroupRoomHold>();
  for (const roomId of roomIds) {
    try {
      const res = await groupRoomsApi.listHolds(roomId, false);
      for (const hold of res.holds) byId.set(hold.hold_id, hold);
    } catch {
      // Room may have been tombstoned server-side; ignore.
    }
  }
  const holds = [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
  useGroupRoomsSyncStore.setState({ holds });
  return holds;
}

// ---------------------------------------------------------------------------
// Sync lifecycle: focus/reconnect pulls + local-disband tombstoning.
// ---------------------------------------------------------------------------

let syncStarted = false;

/**
 * Start background sync: initial pull, pull on window focus / reconnect,
 * and tombstone the server room when a known room is disbanded locally.
 * Idempotent; returns a cleanup function.
 */
export function startGroupRoomsSync(): () => void {
  if (syncStarted || typeof window === 'undefined') return () => {};
  syncStarted = true;
  if (!isRailsApiEnabled()) return () => {};

  const onReconnect = () => {
    void pullGroupRoomChanges();
  };
  window.addEventListener('focus', onReconnect);
  window.addEventListener('online', onReconnect);

  // Disband detection: a pushed room disappearing locally → tombstone API.
  let prevIds = new Set(Object.keys(useGroupChatStore.getState().groups));
  const unsubscribe = useGroupChatStore.subscribe((state) => {
    if (applyingServerTombstone) {
      prevIds = new Set(Object.keys(state.groups));
      return;
    }
    const ids = new Set(Object.keys(state.groups));
    for (const roomId of prevIds) {
      if (ids.has(roomId)) continue;
      const sync = useGroupRoomsSyncStore.getState();
      const knownServerSide =
        sync.pushedRoomIds.includes(roomId) || (sync.lastKnownRevision[roomId] ?? 0) > 0;
      if (!knownServerSide) continue;
      void groupRoomsApi
        .tombstone(roomId)
        .then(() => {
          useGroupRoomsSyncStore.setState((s) => ({
            tombstonedRoomIds: s.tombstonedRoomIds.includes(roomId)
              ? s.tombstonedRoomIds
              : [...s.tombstonedRoomIds, roomId],
            pushedRoomIds: s.pushedRoomIds.filter((id) => id !== roomId),
            holds: s.holds.filter((h) => h.room_id !== roomId),
          }));
        })
        .catch((err) => {
          logger.warn({ roomId, err }, 'group-rooms: tombstone failed');
        });
    }
    prevIds = ids;
  });

  void pullGroupRoomChanges();

  return () => {
    syncStarted = false;
    window.removeEventListener('focus', onReconnect);
    window.removeEventListener('online', onReconnect);
    unsubscribe();
  };
}
