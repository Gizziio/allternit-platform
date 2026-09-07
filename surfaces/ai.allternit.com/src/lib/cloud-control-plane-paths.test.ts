import { describe, expect, it } from 'vitest';
import { isCloudControlPlanePath } from './cloud-control-plane-paths';

describe('isCloudControlPlanePath', () => {
  it('matches the runtime-devices catalog and relay endpoints', () => {
    expect(isCloudControlPlanePath('/api/v1/runtime-devices')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/runtime-devices/rt_abc/heartbeat')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/runtime-devices/rt_abc/proxy')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/runtime-pairings')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/runtime-relay/connect/rt_abc')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/billing/subscription')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/api-keys')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/api-keys/ak_1')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/hosted-runtimes')).toBe(true);
  });

  it('does not match operator data-plane paths', () => {
    expect(isCloudControlPlanePath('/api/v1/fabric/peers/local')).toBe(false);
    expect(isCloudControlPlanePath('/api/v1/cowork/runs')).toBe(false);
    expect(isCloudControlPlanePath('/api/chat')).toBe(false);
    expect(isCloudControlPlanePath('/viz/session')).toBe(false);
    expect(isCloudControlPlanePath('/health')).toBe(false);
  });
});
