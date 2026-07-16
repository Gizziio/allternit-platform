import { describe, expect, it } from 'vitest';
import {
  explainMiniAppPermissions,
  explainOAuthProvider,
  oauthProviderDisplayName,
} from './mini-app-permissions-explain';

describe('explainMiniAppPermissions', () => {
  it('returns an empty array when nothing is declared', () => {
    expect(explainMiniAppPermissions({})).toEqual([]);
    expect(explainMiniAppPermissions({ permissions: {} })).toEqual([]);
  });

  it('explains network access with host count suffixes', () => {
    const [one] = explainMiniAppPermissions({ permissions: { network: ['api.example.com'] } });
    expect(one).toEqual({ icon: 'network', title: 'Network access', detail: 'Connects to api.example.com' });
    const [three] = explainMiniAppPermissions({ permissions: { network: ['a.com', 'b.com', 'c.com'] } });
    expect(three.detail).toBe('Connects to a.com and 2 other hosts');
  });

  it('explains filesystem, secrets, and processes', () => {
    const explanations = explainMiniAppPermissions({
      permissions: { filesystem: ['~/Documents', '/data'], secrets: ['API_TOKEN'], processes: true },
      lifecycle: { start: { command: 'npm start' } },
    });
    const fs = explanations.find((e) => e.icon === 'filesystem');
    expect(fs?.detail).toBe('Accesses files at ~/Documents and 1 other location');
    const secrets = explanations.find((e) => e.icon === 'secrets');
    expect(secrets?.detail).toBe('Uses the API_TOKEN secret stored on this computer');
    const processes = explanations.find((e) => e.icon === 'processes');
    expect(processes?.detail).toContain('Runs local commands on this computer');
    expect(processes?.detail).toContain('"npm start"');
  });

  it('keeps a stable section order: network, filesystem, secrets, processes, oauth', () => {
    const explanations = explainMiniAppPermissions({
      permissions: { network: ['a.com'], filesystem: ['/x'], secrets: ['S'], processes: true },
      oauth: { github: { authorizationUrl: 'https://g/a', tokenUrl: 'https://g/t', clientId: 'c', scopes: ['read'] } },
    });
    expect(explanations.map((e) => e.icon)).toEqual(['network', 'filesystem', 'secrets', 'processes', 'oauth']);
  });
});

describe('explainOAuthProvider', () => {
  it('uses known provider names and lists scopes', () => {
    const explanation = explainOAuthProvider('github', {
      authorizationUrl: 'https://github.com/a',
      tokenUrl: 'https://github.com/t',
      clientId: 'c',
      scopes: ['read', 'user'],
    });
    expect(explanation.title).toBe('GitHub account');
    expect(explanation.detail).toBe('Connects your GitHub account (scopes: read, user)');
  });

  it('falls back to capitalized ids and omits empty scope lists', () => {
    expect(oauthProviderDisplayName('acme-api')).toBe('Acme-api');
    const explanation = explainOAuthProvider('acme-api', {
      authorizationUrl: 'https://a.com/a',
      tokenUrl: 'https://a.com/t',
      clientId: 'c',
      scopes: [],
    });
    expect(explanation.detail).toBe('Connects your Acme-api account');
  });
});
