import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeDocumentSurfaceAdapter } from './document-surface';

describe('document-surface', () => {
  let listeners: Record<string, EventListener[]> = {};
  let dispatched: CustomEvent[] = [];

  async function loadModule() {
    vi.resetModules();
    return import('./document-surface');
  }

  beforeEach(() => {
    listeners = {};
    dispatched = [];
    vi.stubGlobal('window', {
      addEventListener: (type: string, handler: EventListener) => {
        listeners[type] = listeners[type] ?? [];
        listeners[type].push(handler);
      },
      dispatchEvent: (event: Event) => {
        dispatched.push(event as CustomEvent);
        const handlers = listeners[event.type] ?? [];
        handlers.forEach((handler) => handler(event));
        return true;
      },
    });
  });

  function emitOperation(detail: { requestId: string; operation: 'snapshot' | 'apply'; mutation?: unknown; approved?: boolean }) {
    const event = new CustomEvent('allternit:document-operation', { detail });
    listeners['allternit:document-operation']?.forEach((handler) => handler(event));
  }

  function lastResult() {
    const event = dispatched.find((e) => e.type === 'allternit:document-operation-result');
    return event?.detail;
  }

  it('registers and unregisters the active surface', async () => {
    const { registerNativeDocumentSurface, getActiveNativeDocumentSurface } = await loadModule();
    const adapter: NativeDocumentSurfaceAdapter = {
      id: 'doc-1',
      kind: 'documents',
      snapshot: () => ({ surfaceId: 'doc-1', kind: 'documents', title: 'T', revision: 1, content: {} }),
      apply: vi.fn().mockResolvedValue({ revision: 2, summary: 'ok' }),
    };

    const unregister = registerNativeDocumentSurface(adapter);
    expect(getActiveNativeDocumentSurface()).toBe(adapter);

    const changed = dispatched.find((e) => e.type === 'allternit:document-surface-changed');
    expect(changed?.detail).toEqual({ id: 'doc-1', kind: 'documents' });

    unregister();
    expect(getActiveNativeDocumentSurface()).toBeNull();
  });

  it('returns a snapshot through the event bridge', async () => {
    const { registerNativeDocumentSurface, installNativeDocumentSurfaceBridge } = await loadModule();
    const adapter: NativeDocumentSurfaceAdapter = {
      id: 'doc-1',
      kind: 'documents',
      snapshot: () => ({ surfaceId: 'doc-1', kind: 'documents', title: 'Snapshot', revision: 5, content: { body: 'hi' } }),
      apply: vi.fn(),
    };
    registerNativeDocumentSurface(adapter);
    installNativeDocumentSurfaceBridge();

    emitOperation({ requestId: 'r1', operation: 'snapshot' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lastResult()).toEqual({ requestId: 'r1', ok: true, result: adapter.snapshot() });
  });

  it('applies an approved mutation through the event bridge', async () => {
    const { registerNativeDocumentSurface, installNativeDocumentSurfaceBridge } = await loadModule();
    const adapter: NativeDocumentSurfaceAdapter = {
      id: 'sheet-1',
      kind: 'sheets',
      snapshot: () => ({ surfaceId: 'sheet-1', kind: 'sheets', title: 'Sheet', revision: 1, content: {} }),
      apply: vi.fn().mockResolvedValue({ revision: 2, summary: 'Cell updated.' }),
    };
    registerNativeDocumentSurface(adapter);
    installNativeDocumentSurfaceBridge();

    emitOperation({
      requestId: 'r2',
      operation: 'apply',
      approved: true,
      mutation: { type: 'set-cell', row: 0, column: 0, value: '42' },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(adapter.apply).toHaveBeenCalledWith({ type: 'set-cell', row: 0, column: 0, value: '42' });
    expect(lastResult()).toEqual({ requestId: 'r2', ok: true, result: { revision: 2, summary: 'Cell updated.' } });
  });

  it('rejects apply without approval', async () => {
    const { registerNativeDocumentSurface, installNativeDocumentSurfaceBridge } = await loadModule();
    const adapter: NativeDocumentSurfaceAdapter = {
      id: 'doc-1',
      kind: 'documents',
      snapshot: () => ({ surfaceId: 'doc-1', kind: 'documents', title: 'T', revision: 1, content: {} }),
      apply: vi.fn(),
    };
    registerNativeDocumentSurface(adapter);
    installNativeDocumentSurfaceBridge();

    emitOperation({ requestId: 'r3', operation: 'apply', approved: false, mutation: { type: 'append-to-document', body: 'x' } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(adapter.apply).not.toHaveBeenCalled();
    expect(lastResult()).toEqual({ requestId: 'r3', ok: false, result: 'Approval required before modifying the active document.' });
  });

  it('reports when no surface is active', async () => {
    const { installNativeDocumentSurfaceBridge } = await loadModule();
    installNativeDocumentSurfaceBridge();
    emitOperation({ requestId: 'r4', operation: 'snapshot' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lastResult()).toEqual({ requestId: 'r4', ok: false, result: 'No native document surface is active.' });
  });
});
