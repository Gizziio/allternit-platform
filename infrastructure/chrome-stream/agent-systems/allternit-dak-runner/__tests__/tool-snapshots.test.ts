/**
 * Tool Snapshots Integration Tests
 * 
 * Tests for content-addressed storage and deterministic replay.
 */

import { SnapshotStore } from '../src/snapshots/store';
import { ReplayEngine, withSnapshots } from '../src/snapshots/replay';
import { Snapshot } from '../src/snapshots/types';

describe('Tool Snapshots Integration', () => {
  let store: SnapshotStore;
  
  beforeEach(async () => {
    store = new SnapshotStore({
      storage_dir: '.allternit/test-snapshots',
      max_snapshots: 100,
      compression: false,
      ttl_seconds: 3600
    });
    await store.initialize();
  });

  afterEach(async () => {
    await store.clear();
  });

  describe('Content-Addressed Storage', () => {
    it('should store and retrieve snapshots', async () => {
      const snapshot = await store.store({
        content: JSON.stringify({ result: 'test' }),
        content_size_bytes: 20,
        content_type: 'json',
        metadata: {
          snapshot_id: 'snap_001',
          tool_name: 'test_tool',
          request: { query: 'test' },
          request_hash: '',
          session_id: 'sess_001',
          captured_at: new Date().toISOString(),
          duration_ms: 100,
          encoding: 'utf-8'
        }
      });

      expect(snapshot.snapshot_hash).toBeTruthy();

      const retrieved = await store.get(snapshot.snapshot_hash);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toBe(snapshot.content);
    });

    it('should deduplicate identical content', async () => {
      const snapshotData = {
        content: JSON.stringify({ result: 'test' }),
        content_size_bytes: 20,
        content_type: 'json' as const,
        metadata: {
          snapshot_id: 'snap_001',
          tool_name: 'test_tool',
          request: { query: 'test' },
          request_hash: '',
          session_id: 'sess_001',
          captured_at: new Date().toISOString(),
          duration_ms: 100,
          encoding: 'utf-8' as const
        }
      };

      const snapshot1 = await store.store(snapshotData);
      const snapshot2 = await store.store(snapshotData);

      expect(snapshot1.snapshot_hash).toBe(snapshot2.snapshot_hash);
    });

    it('should find snapshots by request', async () => {
      const request = { query: 'find_me', param: 123 };
      
      await store.store({
        content: JSON.stringify({ result: 'found' }),
        content_size_bytes: 20,
        content_type: 'json',
        metadata: {
          snapshot_id: 'snap_001',
          tool_name: 'search_tool',
          request,
          request_hash: '',
          session_id: 'sess_001',
          captured_at: new Date().toISOString(),
          duration_ms: 100,
          encoding: 'utf-8'
        }
      });

      const found = await store.findByRequest(request);
      expect(found).toHaveLength(1);
      expect(JSON.parse(found[0].content).result).toBe('found');
    });
  });

  describe('Replay Engine', () => {
    it('should return cached result on hit', async () => {
      const engine = new ReplayEngine(store, {
        match_strategy: 'exact',
        fallback_to_live: true,
        record_on_miss: true
      });

      // Pre-populate store
      await store.store({
        content: JSON.stringify({ cached: true }),
        content_size_bytes: 20,
        content_type: 'json',
        metadata: {
          snapshot_id: 'snap_001',
          tool_name: 'test_tool',
          request: { input: 'test' },
          request_hash: '',
          session_id: 'sess_001',
          captured_at: new Date().toISOString(),
          duration_ms: 50,
          encoding: 'utf-8'
        }
      });

      let liveCalled = false;
      const result = await engine.execute(
        'test_tool',
        { input: 'test' },
        async () => {
          liveCalled = true;
          return { cached: false };
        },
        { session_id: 'sess_001' }
      );

      expect(result.status).toBe('hit');
      expect(result.source).toBe('snapshot');
      expect(liveCalled).toBe(false);
    });

    it('should call live and record on miss', async () => {
      const engine = new ReplayEngine(store, {
        match_strategy: 'exact',
        fallback_to_live: true,
        record_on_miss: true
      });

      let liveCalled = false;
      const result = await engine.execute(
        'test_tool',
        { input: 'new_request' },
        async () => {
          liveCalled = true;
          return { fresh: true };
        },
        { session_id: 'sess_001' }
      );

      expect(result.status).toBe('miss');
      expect(result.source).toBe('live');
      expect(liveCalled).toBe(true);
      expect(result.new_snapshot).toBeDefined();
    });

    it('should track statistics', async () => {
      const engine = new ReplayEngine(store, {
        match_strategy: 'exact',
        fallback_to_live: true,
        record_on_miss: true
      });

      // Miss
      await engine.execute('tool', { id: 1 }, async () => ({ result: 1 }), { session_id: 's1' });
      
      // Hit
      await engine.execute('tool', { id: 1 }, async () => ({ result: 1 }), { session_id: 's1' });
      
      // Another miss
      await engine.execute('tool', { id: 2 }, async () => ({ result: 2 }), { session_id: 's1' });

      const stats = engine.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hit_rate).toBe(1/3);
    });
  });

  describe('Matching Strategies', () => {
    it('should use exact matching by default', async () => {
      await store.store({
        content: JSON.stringify({ result: 'exact' }),
        content_size_bytes: 20,
        content_type: 'json',
        metadata: {
          snapshot_id: 'snap_001',
          tool_name: 'test_tool',
          request: { a: 1, b: 2 },
          request_hash: '',
          session_id: 'sess_001',
          captured_at: new Date().toISOString(),
          duration_ms: 100,
          encoding: 'utf-8'
        }
      });

      const engine = new ReplayEngine(store);

      // Same request - should hit
      const hit = await engine.execute('test_tool', { a: 1, b: 2 }, async () => ({}), { session_id: 's1' });
      expect(hit.status).toBe('hit');

      // Different request - should miss
      const miss = await engine.execute('test_tool', { a: 1, b: 3 }, async () => ({}), { session_id: 's1' });
      expect(miss.status).toBe('miss');
    });

    it('should support fuzzy matching', async () => {
      await store.store({
        content: JSON.stringify({ result: 'fuzzy' }),
        content_size_bytes: 20,
        content_type: 'json',
        metadata: {
          snapshot_id: 'snap_001',
          tool_name: 'test_tool',
          request: { query: 'test', timestamp: 1234567890 },
          request_hash: '',
          session_id: 'sess_001',
          captured_at: new Date().toISOString(),
          duration_ms: 100,
          encoding: 'utf-8'
        }
      });

      const engine = new ReplayEngine(store, {
        match_strategy: 'fuzzy',
        fallback_to_live: false,
        record_on_miss: false
      });

      // Different timestamp should still match with fuzzy
      const result = await engine.execute(
        'test_tool',
        { query: 'test', timestamp: 9999999999 },
        async () => ({}),
        { session_id: 's1' }
      );

      expect(result.status).toBe('hit');
    });
  });

  describe('withSnapshots Wrapper', () => {
    it('should wrap tools transparently', async () => {
      const liveTool = jest.fn().mockResolvedValue({ wrapped: true });
      
      const wrapped = withSnapshots('wrapped_tool', liveTool, store);
      
      // First call - miss, should call live
      const result1 = await wrapped({ input: 'test' }, { session_id: 's1' });
      expect(result1).toEqual({ wrapped: true });
      expect(liveTool).toHaveBeenCalledTimes(1);

      // Second call - hit, should not call live
      const result2 = await wrapped({ input: 'test' }, { session_id: 's1' });
      expect(result2).toEqual({ wrapped: true });
      expect(liveTool).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('Retention Policy', () => {
    it('should enforce max snapshots limit', async () => {
      const smallStore = new SnapshotStore({
        storage_dir: '.allternit/test-snapshots-small',
        max_snapshots: 5,
        compression: false,
        ttl_seconds: 0
      });
      await smallStore.initialize();

      // Store 10 snapshots
      for (let i = 0; i < 10; i++) {
        await smallStore.store({
          content: JSON.stringify({ index: i }),
          content_size_bytes: 20,
          content_type: 'json',
          metadata: {
            snapshot_id: `snap_${i}`,
            tool_name: 'test_tool',
            request: { index: i },
            request_hash: '',
            session_id: 'sess_001',
            captured_at: new Date(Date.now() - i * 1000).toISOString(),
            duration_ms: 100,
            encoding: 'utf-8'
          }
        });
      }

      const stats = await smallStore.getStats();
      expect(stats.total_snapshots).toBeLessThanOrEqual(5);

      await smallStore.clear();
    });
  });
});
