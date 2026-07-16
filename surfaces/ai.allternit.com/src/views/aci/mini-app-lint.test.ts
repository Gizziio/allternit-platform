import { describe, expect, it } from 'vitest';
import { hasLintErrors, lintMiniAppManifest } from './mini-app-lint';
import type { MiniAppManifest } from './mini-app.types';

const valid: MiniAppManifest = {
  id: 'pub.app',
  name: 'Demo',
  description: 'A sufficiently long description of the demo miniapp',
  category: 'tools',
  pinnable: true,
  version: '1.2.0',
  icon: 'icon.png',
  release: { changelog: 'Adds things', signature: 'sig' },
  presentation: { mode: 'hybrid', uiUrl: 'https://app.example.com' },
  lifecycle: { health: { kind: 'http', url: 'http://localhost:8080/health' } },
  permissions: { network: ['api.example.com'], secrets: ['API_TOKEN'], filesystem: ['~/Documents'] },
};

const codes = (manifest: MiniAppManifest, opts?: { signed?: boolean }) =>
  lintMiniAppManifest(manifest, opts).map((finding) => finding.code);

describe('lintMiniAppManifest', () => {
  it('accepts a complete manifest with no findings', () => {
    expect(lintMiniAppManifest(valid)).toEqual([]);
  });

  it('maps schema validation failures to error findings', () => {
    const broken = { ...valid, name: '' };
    const findings = lintMiniAppManifest(broken);
    expect(findings.some((f) => f.code === 'schema' && f.severity === 'error')).toBe(true);
    expect(hasLintErrors(findings)).toBe(true);
  });

  it('requires a semver version without leading v or zero-padding', () => {
    expect(codes({ ...valid, version: undefined })).toContain('version-missing');
    expect(codes({ ...valid, version: '1.0' })).toContain('version-semver');
    expect(codes({ ...valid, version: 'v1.0.0' })).toContain('version-semver');
    expect(codes({ ...valid, version: '01.2.3' })).toContain('version-semver');
    expect(codes({ ...valid, version: '1.0.0-alpha.1' })).not.toContain('version-semver');
    expect(codes({ ...valid, version: '1.2.3+build.5' })).not.toContain('version-semver');
  });

  it('warns about missing changelog, icon, short description, and downloadable without repo', () => {
    expect(codes({ ...valid, release: { signature: 'sig' } })).toContain('changelog-missing');
    expect(codes({ ...valid, icon: undefined })).toContain('icon-missing');
    expect(codes({ ...valid, description: 'too short' })).toContain('description-short');
    expect(codes({ ...valid, downloadable: true, repo: undefined })).toContain('repo-missing');
  });

  it('requires a start command when install is declared', () => {
    const findings = lintMiniAppManifest({
      ...valid,
      lifecycle: { install: { command: 'npm ci' } },
    });
    expect(findings.some((f) => f.code === 'lifecycle-start-missing' && f.severity === 'error')).toBe(true);
  });

  it('warns when embedded/hybrid presentations lack a health check', () => {
    expect(codes({ ...valid, lifecycle: undefined })).toContain('health-check-missing');
    expect(codes({ ...valid, presentation: { mode: 'native' }, lifecycle: undefined })).not.toContain('health-check-missing');
  });

  it('rejects network entries that are not bare hostnames', () => {
    for (const bad of ['https://api.example.com', 'api.example.com/path', 'user@api.example.com', 'api .example.com']) {
      expect(codes({ ...valid, permissions: { network: [bad] } })).toContain('network-host-format');
    }
    expect(codes({ ...valid, permissions: { network: ['api.example.com', 'localhost:3000'] } })).not.toContain('network-host-format');
  });

  it('rejects invalid secret names and relative filesystem paths', () => {
    expect(codes({ ...valid, permissions: { secrets: ['lowercase'] } })).toContain('secret-name-format');
    expect(codes({ ...valid, permissions: { secrets: ['VALID_KEY_2'] } })).not.toContain('secret-name-format');
    expect(codes({ ...valid, permissions: { filesystem: ['relative/path'] } })).toContain('filesystem-path-format');
    expect(codes({ ...valid, permissions: { filesystem: ['/abs/path', '~/home', 'C:\\data'] } })).not.toContain('filesystem-path-format');
  });

  it('enforces https and non-empty scopes for OAuth providers', () => {
    const oauth = {
      github: { authorizationUrl: 'http://evil.example.com/auth', tokenUrl: 'https://github.com/token', clientId: 'x', scopes: ['read'] },
    };
    expect(codes({ ...valid, oauth })).toContain('oauth-url-https');
    const emptyScopes = {
      github: { authorizationUrl: 'https://github.com/auth', tokenUrl: 'https://github.com/token', clientId: 'x', scopes: [] },
    };
    expect(codes({ ...valid, oauth: emptyScopes })).toContain('oauth-scopes-empty');
    const localhost = {
      dev: { authorizationUrl: 'http://127.0.0.1:8080/auth', tokenUrl: 'http://localhost:8080/token', clientId: 'x', scopes: ['read'] },
    };
    expect(codes({ ...valid, oauth: localhost })).toEqual([]);
  });

  it('notes missing signatures as info and suppresses it when signing is planned', () => {
    const unsigned = { ...valid, release: { changelog: 'x' } };
    expect(codes(unsigned)).toContain('signature-missing');
    expect(codes(unsigned, { signed: true })).not.toContain('signature-missing');
  });

  it('every finding carries an actionable fix', () => {
    const everything = lintMiniAppManifest({
      ...valid,
      version: 'nope',
      permissions: { network: ['https://bad'], secrets: ['bad'], filesystem: ['rel'] },
      oauth: { x: { authorizationUrl: 'http://evil.com/a', tokenUrl: 'notaurl', clientId: 'y', scopes: [] } },
    });
    expect(hasLintErrors(everything)).toBe(true);
    expect(everything.every((finding) => typeof finding.fix === 'string' && finding.fix.length > 0)).toBe(true);
  });
});
