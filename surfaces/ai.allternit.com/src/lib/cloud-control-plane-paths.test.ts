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

  it('matches the cloud-api task and workspace control-plane endpoints', () => {
    expect(isCloudControlPlanePath('/api/v1/tasks')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/tasks?workspace_id=ws_1&limit=100')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/tasks/tsk_1/comments')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/tasks/optimize')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/tasks/stream')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/workspaces')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/workspaces/join')).toBe(true);
    expect(isCloudControlPlanePath('/api/v1/workspaces/ws_1/members')).toBe(true);
    // Prefixes match exactly or at a path boundary, not substrings.
    expect(isCloudControlPlanePath('/api/v1/tasks-archive')).toBe(false);
    expect(isCloudControlPlanePath('/api/v1/task')).toBe(false);
  });

  it('does not match operator data-plane paths', () => {
    expect(isCloudControlPlanePath('/api/v1/fabric/peers/local')).toBe(false);
    expect(isCloudControlPlanePath('/api/v1/cowork/runs')).toBe(false);
    expect(isCloudControlPlanePath('/api/chat')).toBe(false);
    expect(isCloudControlPlanePath('/viz/session')).toBe(false);
    expect(isCloudControlPlanePath('/health')).toBe(false);
  });
});
