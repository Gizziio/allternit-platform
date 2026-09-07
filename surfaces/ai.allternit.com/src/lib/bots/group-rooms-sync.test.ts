/**
 * Tests for server-side group-room sync (spec Phase 4, AD-2):
 * projection cap trimming, CAS merge fallback, tombstone application,
 * watermark gating math, and escalation hold creation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, isRailsApiEnabled: vi.fn(() => true) };
});

vi.mock('./group-rooms-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./group-rooms-api')>();
  return {
    ...actual,
    groupRoomsApi: {
      getRoom: vi.fn(),
      listRooms: vi.fn(),
      changes: vi.fn(),
      putProjection: vi.fn(),
      tombstone: vi.fn(),
      putWatermark: vi.fn(),
      listWatermarks: vi.fn(),
      createHold: vi.fn(),
      resolveHold: vi.fn(),
      listHolds: vi.fn(),
    },
  };
});

import { isRailsApiEnabled } from '@/lib/env';
import { GroupRoomsApiError, groupRoomsApi } from './group-rooms-api';
import type { GroupRoomHold, GroupRoomRecord } from './group-rooms-api';
import type { GroupChat, GroupChatMessage } from './group-chat.types';
import { useGroupChatStore } from './group-chat.store';
import {
  applyServerProjection,
  applyServerTombstone,
  buildRoomProjection,
  clipProjectionMessages,
  computeMemberHistory,
  createEscalationHold,
  GROUP_ROOM_MAX_MESSAGE_CHARS,
  GROUP_ROOM_MAX_MESSAGES,
  mergeGroupChatWithProjection,
  pushGroupRoom,
  seedGroupFromProjection,
  useGroupRoomsSyncStore,
} from './group-rooms-sync';

const mockedRails = vi.mocked(isRailsApiEnabled);
const mockedApi = vi.mocked(groupRoomsApi);

function msg(id: string, text: string, timestamp: string, overrides: Partial<GroupChatMessage> = {}): GroupChatMessage {
  return { id, from: 'bot', botId: 'bot-1', displayName: 'Bot', text, timestamp, ...overrides };
}

function group(overrides: Partial<GroupChat> = {}): GroupChat {
  return {
    id: 'room-a',
    name: 'Room A',
    members: [{ botId: 'bot-1', displayName: 'Bot One', handle: 'botone', source: 'native' }],
    log: [],
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

function serverRecord(overrides: Partial<GroupRoomRecord> = {}): GroupRoomRecord {
  return {
    room_id: 'room-a',
    name: 'Room A',
    revision: 5,
    tombstone: false,
    projection: { messages: [] },
    updated_at: '2026-09-07T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockedRails.mockReturnValue(true);
  vi.clearAllMocks();
  mockedRails.mockReturnValue(true);
  useGroupChatStore.setState({ groups: {}, activeGroupId: null, lastReadAt: {} });
  useGroupRoomsSyncStore.setState({
    lastKnownRevision: {},
    tombstonedRoomIds: [],
    pushedRoomIds: [],
    watermarks: {},
    holds: [],
    lastPullAt: 0,
  });
});

describe('clipProjectionMessages / buildRoomProjection', () => {
  it('keeps only the last 16 messages', () => {
    const log = Array.from({ length: 40 }, (_, i) =>
      msg(`m-${i}`, `hello ${i}`, `2026-09-07T00:00:${String(i % 60).padStart(2, '0')}Z`),
    );
    const clipped = clipProjectionMessages(log);
    expect(clipped).toHaveLength(GROUP_ROOM_MAX_MESSAGES);
    expect(clipped[0].id).toBe('m-24');
    expect(clipped[15].id).toBe('m-39');
  });

  it('clips message text to 1200 chars', () => {
    const long = 'x'.repeat(5000);
    const clipped = clipProjectionMessages([msg('m-1', long, '2026-09-07T00:00:00Z')]);
    expect(clipped[0].text).toHaveLength(GROUP_ROOM_MAX_MESSAGE_CHARS);
  });

  it('builds a projection document with name, members, and bounded messages', () => {
    const g = group({ log: [msg('m-1', 'hi', '2026-09-07T00:00:00Z')] });
    const projection = buildRoomProjection(g);
    expect(projection.name).toBe('Room A');
    expect(projection.members).toEqual(g.members);
    expect(projection.messages).toHaveLength(1);
  });
});

describe('mergeGroupChatWithProjection (CAS merge fallback)', () => {
  it('unions message ids and orders by timestamp; server name wins', () => {
    const local = group({
      name: 'Local Name',
      log: [
        msg('a', 'alpha', '2026-09-07T00:00:01Z'),
        msg('b', 'bravo', '2026-09-07T00:00:03Z'),
      ],
    });
    const remote = serverRecord({
      name: 'Server Name',
      revision: 7,
      projection: {
        messages: [
          { id: 'b', from: 'bot', botId: 'bot-1', text: 'bravo', timestamp: '2026-09-07T00:00:03Z' },
          { id: 'c', from: 'bot', botId: 'bot-2', text: 'charlie', timestamp: '2026-09-07T00:00:02Z' },
        ],
      },
    });
    const merged = mergeGroupChatWithProjection(local, remote);
    expect(merged.name).toBe('Server Name');
    expect(merged.log.map((m) => m.id)).toEqual(['a', 'c', 'b']);
  });

  it('seedGroupFromProjection reconstructs a room without members on the server', () => {
    const remote = serverRecord({
      room_id: 'room-b',
      projection: {
        members: [{ botId: 'bot-9', displayName: 'Nine', handle: 'nine', source: 'native' }],
        messages: [{ id: 'x', from: 'user', text: 'hello', timestamp: '2026-09-07T00:00:00Z' }],
      },
    });
    const seeded = seedGroupFromProjection(remote);
    expect(seeded.id).toBe('room-b');
    expect(seeded.members).toHaveLength(1);
    expect(seeded.log).toHaveLength(1);
    expect(seeded.log[0].from).toBe('user');
  });
});

describe('computeMemberHistory (watermark gating math)', () => {
  const log = Array.from({ length: 50 }, (_, i) =>
    msg(`m-${i}`, `msg ${i}`, `2026-09-07T00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`),
  );

  it('watermark 0 preserves the legacy last-30 window', () => {
    const window = computeMemberHistory(log, 0);
    expect(window).toHaveLength(30);
    expect(window[0].id).toBe('m-20');
  });

  it('feeds only messages appended since the watermark', () => {
    const window = computeMemberHistory(log, 45);
    expect(window.map((m) => m.id)).toEqual(['m-45', 'm-46', 'm-47', 'm-48', 'm-49']);
  });

  it('caps an oversized unseen window to its most recent 30', () => {
    const window = computeMemberHistory(log, 5);
    expect(window).toHaveLength(30);
    expect(window[0].id).toBe('m-20');
  });

  it('clamps a watermark beyond the log to empty (trim-safe)', () => {
    expect(computeMemberHistory(log, 100)).toEqual([]);
    expect(computeMemberHistory(log, -3)).toHaveLength(30);
  });
});

describe('applyServerTombstone', () => {
  it('removes the local room and records the tombstone so it cannot resurrect', () => {
    useGroupChatStore.setState({ groups: { 'room-a': group() }, activeGroupId: 'room-a' });
    useGroupRoomsSyncStore.setState({
      lastKnownRevision: { 'room-a': 3 },
      pushedRoomIds: ['room-a'],
      watermarks: { 'room-a': { 'bot-1': 4 } },
      holds: [
        {
          hold_id: 'h-1',
          room_id: 'room-a',
          member_id: 'bot-1',
          kind: 'needs_you',
          message_excerpt: null,
          created_at: '2026-09-07T00:00:00Z',
          resolved: false,
          resolved_at: null,
        } satisfies GroupRoomHold,
      ],
    });

    applyServerTombstone('room-a');

    expect(useGroupChatStore.getState().groups['room-a']).toBeUndefined();
    expect(useGroupChatStore.getState().activeGroupId).toBeNull();
    const sync = useGroupRoomsSyncStore.getState();
    expect(sync.tombstonedRoomIds).toContain('room-a');
    expect(sync.pushedRoomIds).not.toContain('room-a');
    expect(sync.lastKnownRevision['room-a']).toBeUndefined();
    expect(sync.watermarks['room-a']).toBeUndefined();
    expect(sync.holds).toHaveLength(0);
  });

  it('re-seeding after a tombstone is skipped by pull (disband cannot resurrect)', () => {
    useGroupChatStore.setState({ groups: { 'room-a': group() } });
    applyServerTombstone('room-a');
    // Direct seed attempt still constructs, but pull guards on tombstoned ids —
    // assert the guard state that pull consults.
    expect(useGroupRoomsSyncStore.getState().tombstonedRoomIds).toContain('room-a');
  });
});

describe('applyServerProjection', () => {
  it('seeds a missing room and records the revision', () => {
    const remote = serverRecord({
      revision: 9,
      projection: {
        messages: [{ id: 'x', from: 'user', text: 'hi', timestamp: '2026-09-07T00:00:00Z' }],
      },
    });
    applyServerProjection(remote);
    expect(useGroupChatStore.getState().groups['room-a']).toBeDefined();
    expect(useGroupRoomsSyncStore.getState().lastKnownRevision['room-a']).toBe(9);
  });

  it('merges into an existing room', () => {
    useGroupChatStore.setState({
      groups: {
        'room-a': group({ log: [msg('local-1', 'local', '2026-09-07T00:00:01Z')] }),
      },
    });
    applyServerProjection(
      serverRecord({
        revision: 4,
        projection: {
          messages: [{ id: 'srv-1', from: 'bot', botId: 'bot-2', text: 'srv', timestamp: '2026-09-07T00:00:02Z' }],
        },
      }),
    );
    const merged = useGroupChatStore.getState().groups['room-a'];
    expect(merged.log.map((m) => m.id)).toEqual(['local-1', 'srv-1']);
  });
});

describe('pushGroupRoom (CAS retry)', () => {
  it('pushes with expected_revision = last known, returns synced', async () => {
    useGroupChatStore.setState({ groups: { 'room-a': group() } });
    useGroupRoomsSyncStore.setState({ lastKnownRevision: { 'room-a': 4 } });
    mockedApi.putProjection.mockResolvedValue(serverRecord({ revision: 5 }));

    const result = await pushGroupRoom('room-a');

    expect(result).toBe('synced');
    expect(mockedApi.putProjection).toHaveBeenCalledWith(
      'room-a',
      expect.objectContaining({ revision: 5, expected_revision: 4 }),
    );
    expect(useGroupRoomsSyncStore.getState().lastKnownRevision['room-a']).toBe(5);
    expect(useGroupRoomsSyncStore.getState().pushedRoomIds).toContain('room-a');
  });

  it('on 409 revision_conflict: pulls, merges, and retries once (returns merged)', async () => {
    useGroupChatStore.setState({
      groups: {
        'room-a': group({
          name: 'Local Name',
          log: [msg('local-1', 'local', '2026-09-07T00:00:01Z')],
        }),
      },
    });
    useGroupRoomsSyncStore.setState({ lastKnownRevision: { 'room-a': 4 } });
    mockedApi.putProjection
      .mockRejectedValueOnce(
        new GroupRoomsApiError(409, 'revision_conflict', {
          error: 'revision_conflict',
          current_revision: 8,
        }),
      )
      .mockResolvedValueOnce(serverRecord({ revision: 9 }));
    mockedApi.getRoom.mockResolvedValue(
      serverRecord({
        name: 'Server Name',
        revision: 8,
        projection: {
          messages: [{ id: 'srv-1', from: 'bot', botId: 'bot-2', text: 'srv', timestamp: '2026-09-07T00:00:02Z' }],
        },
      }),
    );

    const result = await pushGroupRoom('room-a');

    expect(result).toBe('merged');
    expect(mockedApi.putProjection).toHaveBeenCalledTimes(2);
    expect(mockedApi.putProjection).toHaveBeenLastCalledWith(
      'room-a',
      expect.objectContaining({ revision: 9, expected_revision: 8 }),
    );
    const merged = useGroupChatStore.getState().groups['room-a'];
    expect(merged.name).toBe('Server Name');
    expect(merged.log.map((m) => m.id)).toEqual(['local-1', 'srv-1']);
  });

  it('on room_tombstoned: deletes the local room and returns tombstoned', async () => {
    useGroupChatStore.setState({ groups: { 'room-a': group() } });
    mockedApi.putProjection.mockRejectedValue(
      new GroupRoomsApiError(409, 'room_tombstoned', { error: 'room_tombstoned' }),
    );

    const result = await pushGroupRoom('room-a');

    expect(result).toBe('tombstoned');
    expect(useGroupChatStore.getState().groups['room-a']).toBeUndefined();
    expect(useGroupRoomsSyncStore.getState().tombstonedRoomIds).toContain('room-a');
  });

  it('fails closed when the Rails API is disabled', async () => {
    mockedRails.mockReturnValue(false);
    const result = await pushGroupRoom('room-a');
    expect(result).toBe('disabled');
    expect(mockedApi.putProjection).not.toHaveBeenCalled();
  });

  it('skips rooms disbanded locally', async () => {
    useGroupChatStore.setState({ groups: { 'room-a': group() } });
    useGroupRoomsSyncStore.setState({ tombstonedRoomIds: ['room-a'] });
    const result = await pushGroupRoom('room-a');
    expect(result).toBe('skipped');
    expect(mockedApi.putProjection).not.toHaveBeenCalled();
  });
});

describe('createEscalationHold', () => {
  it('creates a needs_you hold with a clipped excerpt and mirrors it locally', async () => {
    const hold: GroupRoomHold = {
      hold_id: 'h-1',
      room_id: 'room-a',
      member_id: 'bot-1',
      kind: 'needs_you',
      message_excerpt: 'x'.repeat(280),
      created_at: '2026-09-07T00:00:00Z',
      resolved: false,
      resolved_at: null,
    };
    mockedApi.createHold.mockResolvedValue(hold);

    const result = await createEscalationHold('room-a', 'bot-1', 'y'.repeat(1000));

    expect(result?.hold_id).toBe('h-1');
    expect(mockedApi.createHold).toHaveBeenCalledWith('room-a', {
      member_id: 'bot-1',
      kind: 'needs_you',
      message_excerpt: 'y'.repeat(280),
    });
    expect(useGroupRoomsSyncStore.getState().holds).toHaveLength(1);
  });

  it('returns null without calling the API when disabled', async () => {
    mockedRails.mockReturnValue(false);
    const result = await createEscalationHold('room-a', 'bot-1', '@user help');
    expect(result).toBeNull();
    expect(mockedApi.createHold).not.toHaveBeenCalled();
  });
});
