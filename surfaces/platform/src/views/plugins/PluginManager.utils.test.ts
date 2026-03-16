import { describe, expect, it } from 'vitest';
import {
  detectLanguageFromName,
  isVersionNewer,
  normalizeMarketplacePluginPayload,
  parseGitHubRepoRef,
} from './PluginManager';

describe('PluginManager utility helpers', () => {
  it('parses valid GitHub repo refs and strips .git suffix', () => {
    expect(parseGitHubRepoRef('owner/repo')).toEqual({ owner: 'owner', repo: 'repo' });
    expect(parseGitHubRepoRef('owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('returns null for invalid GitHub repo refs', () => {
    expect(parseGitHubRepoRef('owner')).toBeNull();
    expect(parseGitHubRepoRef('https://github.com/owner/repo')).toBeNull();
    expect(parseGitHubRepoRef('')).toBeNull();
  });

  it('detects languages from filename extensions', () => {
    expect(detectLanguageFromName('file.ts')).toBe('typescript');
    expect(detectLanguageFromName('file.MD')).toBe('markdown');
    expect(detectLanguageFromName('file.unknown')).toBeUndefined();
  });

  it('detects newer semantic versions correctly', () => {
    expect(isVersionNewer('1.2.0', '1.1.9')).toBe(true);
    expect(isVersionNewer('1.2.0', '1.2.0')).toBe(false);
    expect(isVersionNewer('1.1.0', '1.2.0')).toBe(false);
    expect(isVersionNewer('unknown', '1.2.0')).toBe(false);
  });

  it('normalizes marketplace payloads using fallback values', () => {
    const normalized = normalizeMarketplacePluginPayload(
      {
        id: 'plugin-a',
        name: 'Plugin A',
        description: 'desc',
      },
      {
        version: '1.2.3',
        author: 'Fallback Author',
      }
    );

    expect(normalized).toMatchObject({
      id: 'plugin-a',
      name: 'Plugin A',
      description: 'desc',
      version: '1.2.3',
      author: 'Fallback Author',
      installed: false,
    });
  });

  it('returns null when payload cannot produce id + name', () => {
    expect(normalizeMarketplacePluginPayload({}, {})).toBeNull();
    expect(normalizeMarketplacePluginPayload('invalid', { id: 'x', name: 'y' })).toBeNull();
  });
});
