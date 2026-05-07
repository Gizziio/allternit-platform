import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarketplacePlugin } from './capability.types';
import { resolveMarketplacePluginPackage } from './marketplaceInstaller';

function makePlugin(overrides: Partial<MarketplacePlugin> = {}): MarketplacePlugin {
  return {
    id: 'plugin-example',
    name: 'Example Plugin',
    description: 'Example plugin',
    version: '1.0.0',
    author: 'Allternit',
    icon: 'puzzle',
    category: 'development',
    installCount: 0,
    rating: 0,
    installed: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resolveMarketplacePluginPackage', () => {
  it('downloads and materializes plugin files from GitHub directory source', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/repos/acme/test/contents/plugins/example')) {
        return new Response(
          JSON.stringify([
            {
              type: 'file',
              path: 'plugins/example/plugin.json',
              name: 'plugin.json',
              size: 60,
              url: 'https://api.github.com/file/plugin-json',
              download_url: 'https://raw.githubusercontent.com/acme/test/main/plugins/example/plugin.json',
            },
            {
              type: 'file',
              path: 'plugins/example/README.md',
              name: 'README.md',
              size: 40,
              url: 'https://api.github.com/file/readme',
              download_url: 'https://raw.githubusercontent.com/acme/test/main/plugins/example/README.md',
            },
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      if (url.endsWith('/plugins/example/plugin.json')) {
        return new Response(
          JSON.stringify({
            name: 'example-plugin',
            description: 'Fetched from GitHub',
            version: '2.1.0',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      if (url.endsWith('/plugins/example/README.md')) {
        return new Response('# Example\n\nPlugin README\n', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      }
      return new Response('not found', { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveMarketplacePluginPackage(
      makePlugin({
        sourceDescriptor: {
          source: 'github',
          repo: 'acme/test',
          ref: 'main',
          path: 'plugins/example',
        },
      }),
    );

    expect(result.source.kind).toBe('github');
    expect(result.source.repo).toBe('acme/test');
    expect(result.pluginManifest.version).toBe('2.1.0');
    expect(result.readme).toContain('Plugin README');
    expect(result.files.some((file) => file.relativePath === 'README.md')).toBe(true);
  });

  it('resolves URL JSON sources into installable package files', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          name: 'remote-json-plugin',
          description: 'Remote manifest payload',
          version: '3.0.0',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveMarketplacePluginPackage(
      makePlugin({
        sourceDescriptor: {
          source: 'url',
          url: 'https://example.com/plugin.json',
        },
      }),
    );

    expect(result.source.kind).toBe('url');
    expect(result.pluginManifest.name).toBe('remote-json-plugin');
    expect(result.files.some((file) => file.relativePath === '.claude-plugin/plugin.json')).toBe(true);
  });

  it('throws when no installable source descriptor is available', async () => {
    await expect(resolveMarketplacePluginPackage(makePlugin({ sourceUrl: undefined }))).rejects.toThrow(
      /no installable source descriptor/i,
    );
  });
});
