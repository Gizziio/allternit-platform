/**
 * Tests for useRustStreamAdapter.injectArtifact.
 *
 * Validates that calling injectArtifact:
 *  1. Appends a complete, well-shaped assistant message
 *  2. Correctly orders parts (optional text intro + artifact)
 *  3. Sets currentAssistantId to the injected message's id
 *  4. Is additive — existing messages are preserved
 *  5. Produces unique message ids across multiple calls
 */

import { act, renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  useRustStreamAdapter,
  type ArtifactUIPart,
  type ChatMessage,
} from './rust-stream-adapter';

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixture
// ─────────────────────────────────────────────────────────────────────────────

const KANBAN_ARTIFACT: ArtifactUIPart = {
  type: 'artifact',
  artifactId: 'tmpl-kanban-001',
  kind: 'html',
  content: '<!DOCTYPE html><html><body>kanban</body></html>',
  title: 'Kanban Board',
};

// ─────────────────────────────────────────────────────────────────────────────
// injectArtifact
// ─────────────────────────────────────────────────────────────────────────────

describe('injectArtifact', () => {
  it('appends exactly one new message to an empty list', () => {
    const { result } = renderHook(() => useRustStreamAdapter());
    expect(result.current.messages).toHaveLength(0);

    act(() => { result.current.injectArtifact(KANBAN_ARTIFACT); });

    expect(result.current.messages).toHaveLength(1);
  });

  it('injected message has role "assistant"', () => {
    const { result } = renderHook(() => useRustStreamAdapter());

    act(() => { result.current.injectArtifact(KANBAN_ARTIFACT); });

    expect(result.current.messages[0].role).toBe('assistant');
  });

  it('injected message has metadata status "complete"', () => {
    const { result } = renderHook(() => useRustStreamAdapter());

    act(() => { result.current.injectArtifact(KANBAN_ARTIFACT); });

    expect(result.current.messages[0].metadata?.status).toBe('complete');
  });

  it('without intro: content has exactly 1 part — the artifact', () => {
    const { result } = renderHook(() => useRustStreamAdapter());

    act(() => { result.current.injectArtifact(KANBAN_ARTIFACT); });

    const parts = result.current.messages[0].content as ArtifactUIPart[];
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: 'artifact',
      artifactId: 'tmpl-kanban-001',
      kind: 'html',
      title: 'Kanban Board',
    });
  });

  it('with intro: first part is text, second is artifact', () => {
    const { result } = renderHook(() => useRustStreamAdapter());

    act(() => { result.current.injectArtifact(KANBAN_ARTIFACT, 'Here is your Kanban template!'); });

    const parts = result.current.messages[0].content as Array<{ type: string; [k: string]: unknown }>;
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ type: 'text', text: 'Here is your Kanban template!' });
    expect(parts[1]).toMatchObject({ type: 'artifact', artifactId: 'tmpl-kanban-001' });
  });

  it('sets currentAssistantId to the injected message id', () => {
    const { result } = renderHook(() => useRustStreamAdapter());

    act(() => { result.current.injectArtifact(KANBAN_ARTIFACT); });

    expect(result.current.currentAssistantId).toBe(result.current.messages[0].id);
  });

  it('each call produces a message with a unique id', () => {
    const { result } = renderHook(() => useRustStreamAdapter());

    act(() => {
      result.current.injectArtifact(KANBAN_ARTIFACT);
      result.current.injectArtifact({ ...KANBAN_ARTIFACT, artifactId: 'tmpl-kanban-002' });
    });

    const ids = result.current.messages.map((m: ChatMessage) => m.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('preserves existing messages — does not overwrite', () => {
    const existingUser: ChatMessage = {
      id: 'user-msg-1',
      role: 'user',
      content: [{ type: 'text', text: 'Hello' }] as ChatMessage['content'],
      createdAt: new Date(),
      metadata: { status: 'complete' },
    };
    const { result } = renderHook(() =>
      useRustStreamAdapter({ initialMessages: [existingUser] })
    );

    act(() => { result.current.injectArtifact(KANBAN_ARTIFACT); });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].id).toBe('user-msg-1');
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[1].role).toBe('assistant');
  });

  it('second inject updates currentAssistantId to the latest message', () => {
    const { result } = renderHook(() => useRustStreamAdapter());

    act(() => { result.current.injectArtifact(KANBAN_ARTIFACT); });
    const firstId = result.current.messages[0].id;

    act(() => { result.current.injectArtifact({ ...KANBAN_ARTIFACT, artifactId: 'tmpl-kanban-002' }); });
    const secondId = result.current.messages[1].id;

    expect(result.current.currentAssistantId).toBe(secondId);
    expect(result.current.currentAssistantId).not.toBe(firstId);
  });

  it('injected message has a createdAt Date', () => {
    const { result } = renderHook(() => useRustStreamAdapter());
    const before = new Date();

    act(() => { result.current.injectArtifact(KANBAN_ARTIFACT); });

    const after = new Date();
    const ts = result.current.messages[0].createdAt;
    expect(ts).toBeInstanceOf(Date);
    expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
