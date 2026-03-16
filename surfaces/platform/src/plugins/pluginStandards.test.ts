import { describe, expect, it } from 'vitest';
import {
  validateMarketplaceManifestV1,
  validatePluginManifestV1,
} from './pluginStandards';

describe('pluginStandards schema validation', () => {
  it('accepts valid plugin manifests', () => {
    const result = validatePluginManifestV1({
      name: 'agent-rails-toolkit',
      description: 'Automation toolkit for agent rails flows.',
      version: '1.0.0',
      author: {
        name: 'A2R Team',
        email: 'plugins@a2r.dev',
      },
      tags: ['automation', 'rails'],
      commands: ['/rails-bootstrap'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid plugin manifest author structure', () => {
    const result = validatePluginManifestV1({
      name: 'invalid-plugin',
      description: 'Test',
      version: '1.0.0',
      author: {
        email: 'missing-name@example.com',
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('author'))).toBe(true);
  });

  it('rejects marketplace github source entries without repo', () => {
    const result = validateMarketplaceManifestV1({
      name: 'market',
      owner: { name: 'Owner' },
      plugins: [
        {
          name: 'example',
          source: {
            source: 'github',
          },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('repo'))).toBe(true);
  });
});
