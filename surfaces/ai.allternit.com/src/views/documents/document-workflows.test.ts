import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordDocumentWorkflowIntent } from './document-workflows';

describe('document workflow capture', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    vi.stubGlobal('crypto', { randomUUID: () => `id-${Math.random()}` });
  });
  it('increments a stable host-specific intent instead of duplicating it', () => {
    expect(recordDocumentWorkflowIntent('word', 'Review this document').runCount).toBe(1);
    expect(recordDocumentWorkflowIntent('word', 'Review this document').runCount).toBe(2);
    expect(recordDocumentWorkflowIntent('excel', 'Review this document').runCount).toBe(1);
  });
});
