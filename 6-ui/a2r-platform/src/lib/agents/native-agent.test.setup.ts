// ============================================================================
// Native Agent Store Test Setup
// Shared mocks and utilities for native agent tests
// ============================================================================

import { vi } from 'vitest';

// Mock API_BASE_URL
vi.mock('./api-config', () => ({
  API_BASE_URL: 'http://localhost:3001',
}));

// Mock EventSource
export class MockEventSource {
  static instances: MockEventSource[] = [];
  static readonly CONNECTING: 0 = 0;
  static readonly OPEN: 1 = 1;
  static readonly CLOSED: 2 = 2;

  onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  readyState = 0;
  url = '';
  withCredentials = false;
  readonly CONNECTING: 0 = 0;
  readonly OPEN: 1 = 1;
  readonly CLOSED: 2 = 2;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockEventSource.CONNECTING;
    MockEventSource.instances.push(this);
    
    // Simulate connection open
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      this.onopen?.(new Event('open'));
    }, 0);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }

  // Helper method for tests to simulate messages
  simulateMessage(data: unknown) {
    const event = new MessageEvent('message', {
      data: JSON.stringify(data),
    });
    this.onmessage?.(event);
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

// Replace global EventSource
global.EventSource = MockEventSource as unknown as typeof EventSource;

// Mock fetch
export const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock ReadableStream for streaming tests
export class MockReadableStream {
  private chunks: Uint8Array[] = [];
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  constructor(chunks?: Uint8Array[]) {
    if (chunks) {
      this.chunks = chunks;
    }
  }

  getReader() {
    let index = 0;
    return {
      read: async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
        if (index < this.chunks.length) {
          const chunk = this.chunks[index++];
          return { done: false, value: chunk };
        }
        return { done: true, value: undefined };
      },
      cancel: vi.fn(),
      releaseLock: vi.fn(),
      closed: Promise.resolve(undefined),
    };
  }

  addChunk(chunk: Uint8Array) {
    this.chunks.push(chunk);
  }
}

// Helper to encode SSE data
export function encodeSSE(data: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// Mock Date.now for deterministic IDs
let mockNow = 1704067200000; // 2024-01-01 00:00:00 UTC
const MOCK_ISO_STRING = '2024-01-01T00:00:00.000Z';

export function setMockNow(value: number) {
  mockNow = value;
}

export function advanceMockNow(ms: number) {
  mockNow += ms;
}

export function getMockNow() {
  return mockNow;
}

vi.spyOn(Date, 'now').mockImplementation(() => mockNow);
vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => MOCK_ISO_STRING);

// Reset all mocks between tests
export function resetMocks() {
  mockFetch.mockReset();
  setMockNow(1704067200000);
  MockEventSource.instances = [];
}

// Test data factories
export function createMockSession(overrides?: Partial<NativeSession>): NativeSession {
  const id = `session-${Date.now()}`;
  const now = new Date().toISOString();
  return {
    id,
    name: 'Test Session',
    description: undefined,
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
    messageCount: 0,
    isActive: true,
    tags: [],
    metadata: {},
    ...overrides,
  };
}

// Backend session shape (for mocking API responses)
export function createMockBackendSession(overrides?: Record<string, unknown>): Record<string, unknown> {
  const id = `session-${Date.now()}`;
  const now = new Date().toISOString();
  return {
    id,
    name: 'Test Session',
    created_at: now,
    updated_at: now,
    last_accessed: now,
    message_count: 0,
    active: true,
    tags: [],
    metadata: {},
    ...overrides,
  };
}

export function createMockMessage(overrides?: Partial<NativeMessage>): NativeMessage {
  return {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: 'Test message',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockTool(overrides?: Partial<Tool>): Tool {
  return {
    id: `tool-${Date.now()}`,
    name: 'test_tool',
    description: 'A test tool',
    parameters: { type: 'object', properties: {} },
    isEnabled: true,
    category: 'test',
    ...overrides,
  };
}

export function createMockCanvas(overrides?: Partial<Canvas>): Canvas {
  const id = `canvas-${Date.now()}`;
  const now = new Date().toISOString();
  return {
    id,
    sessionId: `session-${Date.now()}`,
    content: 'Test content',
    type: 'code',
    language: 'typescript',
    createdAt: now,
    updatedAt: now,
    metadata: {},
    ...overrides,
  };
}

// Import types after mocking
import type { 
  NativeSession, 
  NativeMessage, 
  Tool, 
  Canvas,
  StreamEvent 
} from './native-agent.store';
