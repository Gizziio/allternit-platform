import { describe, expect, it } from 'vitest';
import {
  isCloudControlPlaneUrl,
  rewriteCloudApiToProtocol,
  shouldInjectDesktopIdentity,
} from './api-protocol';

const CLOUD = 'https://api.allternit.com';
const LOCAL = 'http://127.0.0.1:8013';

describe('api-protocol routing', () => {
  it('treats allternit-api://cloud as the control plane', () => {
    expect(isCloudControlPlaneUrl('allternit-api://cloud/api/v1/billing/subscription', CLOUD)).toBe(true);
    expect(isCloudControlPlaneUrl('allternit-api://cloud/v1/models', CLOUD)).toBe(true);
    expect(isCloudControlPlaneUrl(`${CLOUD}/v1/models`, CLOUD)).toBe(true);
    expect(isCloudControlPlaneUrl('allternit-api://localhost:8013/api/v1/me', CLOUD)).toBe(false);
    expect(isCloudControlPlaneUrl(`${LOCAL}/api/v1/me`, CLOUD)).toBe(false);
  });

  it('injects desktop identity only onto the local operator API', () => {
    expect(shouldInjectDesktopIdentity(`${LOCAL}/api/v1/me`, LOCAL, CLOUD)).toBe(true);
    expect(shouldInjectDesktopIdentity('allternit-api://localhost:8013/api/v1/me', LOCAL, CLOUD)).toBe(true);
    expect(shouldInjectDesktopIdentity('allternit-api://cloud/api/v1/billing/subscription', LOCAL, CLOUD)).toBe(false);
    expect(shouldInjectDesktopIdentity(`${CLOUD}/api/v1/billing/subscription`, LOCAL, CLOUD)).toBe(false);
    expect(shouldInjectDesktopIdentity(`${CLOUD}/v1/models`, LOCAL, CLOUD)).toBe(false);
  });

  it('rewrites every cloud-api path, including /v1/models', () => {
    expect(rewriteCloudApiToProtocol(`${CLOUD}/api/v1/billing/subscription`, CLOUD)).toBe(
      'allternit-api://cloud/api/v1/billing/subscription',
    );
    expect(rewriteCloudApiToProtocol(`${CLOUD}/v1/models`, CLOUD)).toBe('allternit-api://cloud/v1/models');
    expect(rewriteCloudApiToProtocol(CLOUD, CLOUD)).toBeNull();
    expect(rewriteCloudApiToProtocol(`${LOCAL}/api/v1/me`, CLOUD)).toBeNull();
  });
});
