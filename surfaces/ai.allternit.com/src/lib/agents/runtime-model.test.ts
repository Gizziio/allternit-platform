import { describe, it, expect } from 'vitest';
import { isVirtualPlatformModelRef, LOCAL_DEFAULT_RUNTIME_MODEL } from './runtime-model';

describe('isVirtualPlatformModelRef', () => {
  it('treats allternit/* and auto/* as virtual catalog ids', () => {
    expect(isVirtualPlatformModelRef('allternit/kimi-k3')).toBe(true);
    expect(isVirtualPlatformModelRef('auto/default')).toBe(true);
    expect(isVirtualPlatformModelRef('kimi-cli/kimi-k3')).toBe(false);
    expect(isVirtualPlatformModelRef('codex-cli/codex-latest')).toBe(false);
    expect(isVirtualPlatformModelRef(null)).toBe(false);
  });
});

describe('LOCAL_DEFAULT_RUNTIME_MODEL', () => {
  it('is a real provider/model pair, not the virtual allternit catalog', () => {
    expect(LOCAL_DEFAULT_RUNTIME_MODEL.includes('/')).toBe(true);
    expect(isVirtualPlatformModelRef(LOCAL_DEFAULT_RUNTIME_MODEL)).toBe(false);
  });
});
