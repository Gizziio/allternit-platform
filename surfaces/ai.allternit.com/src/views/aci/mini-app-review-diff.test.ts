import { describe, expect, it } from 'vitest';
import { diffManifestsForReview } from './mini-app-review-diff';
import type { MiniAppManifest } from './mini-app.types';

const base: MiniAppManifest = {
  id: 'pub.app',
  name: 'Demo',
  description: 'd',
  category: 'tools',
  pinnable: true,
  version: '1.0.0',
  permissions: { network: ['api.example.com'], filesystem: ['~/docs'], secrets: ['TOKEN'], processes: false },
  harness: { transport: 'subprocess', command: 'node', args: ['server.js'], env: { MODE: 'prod' } },
  lifecycle: { install: { command: 'npm', args: ['ci'] }, start: { command: 'npm', args: ['start'] } },
  presentation: { mode: 'hybrid', uiUrl: 'https://app.example.com' },
  compatibility: { platforms: ['darwin'] },
};

describe('diffManifestsForReview', () => {
  it('reports a first submission with everything added', () => {
    const diff = diffManifestsForReview(null, base);
    expect(diff.fromVersion).toBeNull();
    expect(diff.toVersion).toBe('1.0.0');
    expect(diff.riskFlags).toContain('first-submission');
    expect(diff.hasSecurityRelevantChanges).toBe(true);
    expect(diff.changes.some((c) => c.section === 'permissions.network' && c.kind === 'added')).toBe(true);
  });

  it('reports no changes for identical manifests', () => {
    const diff = diffManifestsForReview(base, { ...base });
    expect(diff.changes).toHaveLength(0);
    expect(diff.hasSecurityRelevantChanges).toBe(false);
    expect(diff.riskFlags).toContain('metadata-only');
  });

  it('flags network expansion and reduction distinctly', () => {
    const expanded = diffManifestsForReview(base, {
      ...base,
      permissions: { ...base.permissions, network: ['api.example.com', 'evil.example.com'] },
    });
    expect(expanded.riskFlags).toContain('network-expanded');
    expect(expanded.changes).toContainEqual({ section: 'permissions.network', kind: 'added', newValue: 'evil.example.com' });

    const reduced = diffManifestsForReview(base, { ...base, permissions: { ...base.permissions, network: [] } });
    expect(reduced.riskFlags).toContain('network-reduced');
    expect(reduced.riskFlags).not.toContain('network-expanded');
  });

  it('flags process permission escalation', () => {
    const diff = diffManifestsForReview(base, { ...base, permissions: { ...base.permissions, processes: true } });
    expect(diff.changes).toContainEqual({ section: 'permissions.processes', kind: 'changed', oldValue: false, newValue: true });
    expect(diff.riskFlags).toContain('processes-enabled');
  });

  it('flags harness and lifecycle command changes', () => {
    const harness = diffManifestsForReview(base, { ...base, harness: { ...base.harness, command: 'bash' } });
    expect(harness.changes).toContainEqual({ section: 'harness.command', kind: 'changed', oldValue: 'node', newValue: 'bash' });
    expect(harness.riskFlags).toContain('commands-changed');

    const lifecycle = diffManifestsForReview(base, {
      ...base,
      lifecycle: { ...base.lifecycle, start: { command: 'npm', args: ['run', 'dev'] } },
    });
    expect(lifecycle.changes.some((c) => c.section === 'lifecycle.start' && c.kind === 'changed')).toBe(true);
    expect(lifecycle.riskFlags).toContain('commands-changed');
  });

  it('reports env key additions, removals, and value changes', () => {
    const diff = diffManifestsForReview(base, {
      ...base,
      harness: { ...base.harness, env: { MODE: 'debug', EXTRA: '1' } },
    });
    expect(diff.changes).toContainEqual({ section: 'harness.env', kind: 'changed', oldValue: 'MODE=prod', newValue: 'MODE=debug' });
    expect(diff.changes).toContainEqual({ section: 'harness.env', kind: 'added', newValue: 'EXTRA' });
    const removed = diffManifestsForReview(base, { ...base, harness: { ...base.harness, env: {} } });
    expect(removed.changes).toContainEqual({ section: 'harness.env', kind: 'removed', oldValue: 'MODE' });
  });

  it('flags presentation and platform changes', () => {
    const presentation = diffManifestsForReview(base, { ...base, presentation: { ...base.presentation, mode: 'embedded' } });
    expect(presentation.riskFlags).toContain('presentation-changed');
    const platforms = diffManifestsForReview(base, { ...base, compatibility: { platforms: ['darwin', 'linux'] } });
    expect(platforms.riskFlags).toContain('platforms-expanded');
  });

  it('treats metadata-only edits as not security-relevant', () => {
    const diff = diffManifestsForReview(base, { ...base, description: 'new description' });
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].section).toBe('manifest.description');
    expect(diff.hasSecurityRelevantChanges).toBe(false);
  });

  it('returns sorted risk flags', () => {
    const diff = diffManifestsForReview(base, {
      ...base,
      permissions: { network: ['a', 'b'], filesystem: ['x'], secrets: ['S'], processes: true },
    });
    expect([...diff.riskFlags].sort()).toEqual(diff.riskFlags);
  });
});
