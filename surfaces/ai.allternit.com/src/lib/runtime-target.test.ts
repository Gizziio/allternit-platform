import { afterEach, describe, expect, it } from 'vitest';
import { ACTIVE_RUNTIME_ID_KEY, applyRuntimeIdFromSearch } from './runtime-target';

describe('applyRuntimeIdFromSearch', () => {
  afterEach(() => {
    window.localStorage.removeItem(ACTIVE_RUNTIME_ID_KEY);
  });

  it('stores a QR runtime id from the query string', () => {
    const id = applyRuntimeIdFromSearch('?runtime=rt_7ba52550d5c34cbd900cf6bf9e1b517d');
    expect(id).toBe('rt_7ba52550d5c34cbd900cf6bf9e1b517d');
  });

  it('ignores non-runtime query values', () => {
    expect(applyRuntimeIdFromSearch('?runtime=local-test')).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_RUNTIME_ID_KEY)).toBeNull();
  });
});
