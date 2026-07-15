import type { EditorPackId } from './editor-packs';

export interface NativeDocumentSnapshot {
  surfaceId: string;
  kind: EditorPackId;
  title: string;
  revision: number;
  content: unknown;
}

export type NativeDocumentMutation =
  | { type: 'replace-document'; body: string; title?: string }
  | { type: 'insert-block'; block: unknown; index?: number }
  | { type: 'append-to-document'; body: string }
  | { type: 'set-cell'; row: number; column: number; value: string }
  | { type: 'set-cell-formula'; row: number; column: number; formula: string }
  | { type: 'replace-slide'; index: number; title?: string; body?: string }
  | { type: 'add-slide'; title: string; body: string }
  | { type: 'add-slide-block'; block: unknown }
  | { type: 'export-office'; format: 'docx' | 'xlsx' | 'pptx' | 'md' | 'csv' | 'altdeck' | 'altdoc' | 'altsheet' };

export interface NativeDocumentSurfaceAdapter {
  id: string;
  kind: EditorPackId;
  snapshot(): NativeDocumentSnapshot;
  apply(mutation: NativeDocumentMutation): Promise<{ revision: number; summary: string }> | { revision: number; summary: string };
}

let activeAdapter: NativeDocumentSurfaceAdapter | null = null;

export function registerNativeDocumentSurface(adapter: NativeDocumentSurfaceAdapter): () => void {
  activeAdapter = adapter;
  window.dispatchEvent(new CustomEvent('allternit:document-surface-changed', { detail: { id: adapter.id, kind: adapter.kind } }));
  return () => {
    if (activeAdapter?.id === adapter.id) activeAdapter = null;
    window.dispatchEvent(new CustomEvent('allternit:document-surface-changed', { detail: null }));
  };
}

export function getActiveNativeDocumentSurface(): NativeDocumentSurfaceAdapter | null {
  return activeAdapter;
}

let eventBridgeInstalled = false;
export function installNativeDocumentSurfaceBridge(): void {
  if (eventBridgeInstalled || typeof window === 'undefined') return;
  eventBridgeInstalled = true;
  window.addEventListener('allternit:document-operation', ((event: CustomEvent<{
    requestId: string;
    operation: 'snapshot' | 'apply';
    mutation?: NativeDocumentMutation;
    approved?: boolean;
  }>) => {
    const request = event.detail;
    const send = (ok: boolean, result: unknown) => {
      window.dispatchEvent(new CustomEvent('allternit:document-operation-result', { detail: { requestId: request.requestId, ok, result } }));
    };
    try {
      if (!activeAdapter) throw new Error('No native document surface is active.');
      if (request.operation === 'apply' && request.approved !== true) throw new Error('Approval required before modifying the active document.');
      const outcome = request.operation === 'snapshot'
        ? activeAdapter.snapshot()
        : request.mutation
          ? activeAdapter.apply(request.mutation)
          : (() => { throw new Error('A mutation is required for apply.'); })();
      Promise.resolve(outcome).then((value) => send(true, value), (error) => send(false, error instanceof Error ? error.message : String(error)));
    } catch (error) {
      send(false, error instanceof Error ? error.message : String(error));
    }
  }) as EventListener);
}
