/**
 * Tests for SQLite Store
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import { MemoryStore } from './sqlite-store.js';

describe('MemoryStore', () => {
  let store: MemoryStore;
  const testDbPath = '/tmp/test-memory.db';

  beforeEach(async () => {
    // Clean up any existing test database
    try {
      await fs.unlink(testDbPath);
    } catch {
      // Ignore if doesn't exist
    }
    
    store = new MemoryStore(testDbPath);
  });

  afterEach(() => {
    store.close();
  });

  afterAll(async () => {
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch {
      // Ignore
    }
  });

  describe('Memory Operations', () => {
    it('should create a memory', () => {
      const memory = store.createMemory({
        content: 'Test content',
        summary: 'Test summary',
        entities: ['entity1'],
        topics: ['topic1'],
        importance: 'medium',
        status: 'raw',
        source: 'test',
        sourceType: 'text',
        metadata: {},
      });

      expect(memory.id).toBeDefined();
      expect(memory.content).toBe('Test content');
      expect(memory.summary).toBe('Test summary');
    });

    it('should get a memory by ID', () => {
      const created = store.createMemory({
        content: 'Test content',
        summary: 'Test summary',
        entities: ['entity1'],
        topics: ['topic1'],
        importance: 'high',
        status: 'raw',
        source: 'test',
        sourceType: 'text',
        metadata: {},
      });

      const retrieved = store.getMemory(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.importance).toBe('high');
    });

    it('should return undefined for non-existent memory', () => {
      const retrieved = store.getMemory('non-existent-id');
      expect(retrieved).toBeUndefined();
    });

    it('should update a memory', () => {
      const created = store.createMemory({
        content: 'Test content',
        summary: 'Test summary',
        entities: ['entity1'],
        topics: ['topic1'],
        importance: 'medium',
        status: 'raw',
        source: 'test',
        sourceType: 'text',
        metadata: {},
      });

      const updated = store.updateMemory(created.id, {
        importance: 'critical',
        status: 'processed',
      });

      expect(updated?.importance).toBe('critical');
      expect(updated?.status).toBe('processed');
    });

    it('should delete a memory', () => {
      const created = store.createMemory({
        content: 'Test content',
        summary: 'Test summary',
        entities: ['entity1'],
        topics: ['topic1'],
        importance: 'medium',
        status: 'raw',
        source: 'test',
        sourceType: 'text',
        metadata: {},
      });

      const deleted = store.deleteMemory(created.id);
      expect(deleted).toBe(true);

      const retrieved = store.getMemory(created.id);
      expect(retrieved).toBeUndefined();
    });

    it('should get memories by status', () => {
      store.createMemory({
        content: 'Raw content',
        summary: 'Raw summary',
        entities: [],
        topics: [],
        importance: 'medium',
        status: 'raw',
        source: 'test',
        sourceType: 'text',
        metadata: {},
      });

      store.createMemory({
        content: 'Processed content',
        summary: 'Processed summary',
        entities: [],
        topics: [],
        importance: 'medium',
        status: 'processed',
        source: 'test',
        sourceType: 'text',
        metadata: {},
      });

      const rawMemories = store.getMemoriesByStatus('raw');
      expect(rawMemories.length).toBe(1);
      expect(rawMemories[0].status).toBe('raw');
    });

    it('should get memory count', () => {
      store.createMemory({
        content: 'Content 1',
        summary: 'Summary 1',
        entities: [],
        topics: [],
        importance: 'medium',
        status: 'raw',
        source: 'test',
        sourceType: 'text',
        metadata: {},
      });

      store.createMemory({
        content: 'Content 2',
        summary: 'Summary 2',
        entities: [],
        topics: [],
        importance: 'medium',
        status: 'raw',
        source: 'test',
        sourceType: 'text',
        metadata: {},
      });

      expect(store.getMemoryCount()).toBe(2);
    });
  });

  describe('Insight Operations', () => {
    it('should create an insight', () => {
      const insight = store.createInsight({
        title: 'Test Insight',
        content: 'Insight content',
        memoryIds: ['mem1', 'mem2'],
        topics: ['topic1'],
        confidence: 0.8,
      });

      expect(insight.id).toBeDefined();
      expect(insight.title).toBe('Test Insight');
      expect(insight.confidence).toBe(0.8);
    });

    it('should get all insights', () => {
      store.createInsight({
        title: 'Insight 1',
        content: 'Content 1',
        memoryIds: ['mem1'],
        topics: ['topic1'],
        confidence: 0.7,
      });

      store.createInsight({
        title: 'Insight 2',
        content: 'Content 2',
        memoryIds: ['mem2'],
        topics: ['topic2'],
        confidence: 0.9,
      });

      const insights = store.getAllInsights();
      expect(insights.length).toBe(2);
    });

    it('should update an insight', () => {
      const created = store.createInsight({
        title: 'Test Insight',
        content: 'Insight content',
        memoryIds: ['mem1'],
        topics: ['topic1'],
        confidence: 0.5,
      });

      const updated = store.updateInsight(created.id, {
        confidence: 0.95,
        title: 'Updated Title',
      });

      expect(updated?.confidence).toBe(0.95);
      expect(updated?.title).toBe('Updated Title');
    });

    it('should delete an insight', () => {
      const created = store.createInsight({
        title: 'Test Insight',
        content: 'Insight content',
        memoryIds: ['mem1'],
        topics: ['topic1'],
        confidence: 0.5,
      });

      const deleted = store.deleteInsight(created.id);
      expect(deleted).toBe(true);

      const retrieved = store.getInsight(created.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Connection Operations', () => {
    it('should create a connection', () => {
      const connection = store.createConnection({
        memoryIds: ['mem1', 'mem2'],
        relationship: 'related to',
        strength: 0.8,
      });

      expect(connection.id).toBeDefined();
      expect(connection.memoryIds).toEqual(['mem1', 'mem2']);
      expect(connection.strength).toBe(0.8);
    });

    it('should get connections for a memory', () => {
      store.createConnection({
        memoryIds: ['mem1', 'mem2'],
        relationship: 'related to',
        strength: 0.8,
      });

      store.createConnection({
        memoryIds: ['mem1', 'mem3'],
        relationship: 'contradicts',
        strength: 0.6,
      });

      const connections = store.getConnectionsForMemory('mem1');
      expect(connections.length).toBe(2);
    });
  });

  describe('Search Operations', () => {
    it('should search memories by content', () => {
      store.createMemory({
        content: 'This is about TypeScript programming',
        summary: 'TypeScript discussion',
        entities: ['TypeScript'],
        topics: ['programming'],
        importance: 'medium',
        status: 'raw',
        source: 'test',
        sourceType: 'text',
        metadata: {},
      });

      store.createMemory({
        content: 'This is about Python programming',
        summary: 'Python discussion',
        entities: ['Python'],
        topics: ['programming'],
        importance: 'medium',
        status: 'raw',
        source: 'test',
        sourceType: 'text',
        metadata: {},
      });

      const results = store.searchMemories('TypeScript');
      expect(results.length).toBe(1);
      expect(results[0].content).toContain('TypeScript');
    });

    it('should search insights', () => {
      store.createInsight({
        title: 'Architecture Pattern',
        content: 'Microservices architecture is beneficial for scalability',
        memoryIds: ['mem1'],
        topics: ['architecture'],
        confidence: 0.8,
      });

      const results = store.searchInsights('microservices');
      expect(results.length).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should get database statistics', () => {
      store.createMemory({
        content: 'Content 1',
        summary: 'Summary 1',
        entities: [],
        topics: [],
        importance: 'raw',
        status: 'raw',
        source: 'test',
        sourceType: 'text',
        metadata: {},
      });

      store.createMemory({
        content: 'Content 2',
        summary: 'Summary 2',
        entities: [],
        topics: [],
        importance: 'medium',
        status: 'processed',
        source: 'test',
        sourceType: 'text',
        metadata: {},
      });

      store.createInsight({
        title: 'Insight',
        content: 'Insight content',
        memoryIds: ['mem1'],
        topics: ['topic'],
        confidence: 0.5,
      });

      const stats = store.getStats();

      expect(stats.memoryCount).toBe(2);
      expect(stats.insightCount).toBe(1);
      expect(stats.statusBreakdown.raw).toBe(1);
      expect(stats.statusBreakdown.processed).toBe(1);
    });
  });
});
