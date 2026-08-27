import { randomUUID } from 'node:crypto';
import { getSettings, updateSettings, type ApiKeyRecord } from './settings.js';
import { generateApiKey, hashApiKey } from './auth.js';

export type Scope = 'read' | 'write' | 'search';

export async function listKeys(): Promise<Omit<ApiKeyRecord, 'hash'>[]> {
  const s = await getSettings();
  return s.api.keys.map(({ hash, ...rest }) => rest);
}

export async function createKey(
  name: string,
  scopes: Scope[],
): Promise<{ raw: string; record: Omit<ApiKeyRecord, 'hash'> }> {
  const { raw, hash, prefix } = generateApiKey();
  const record: ApiKeyRecord = {
    id: randomUUID(),
    name: name || 'agent',
    hash,
    prefix,
    scopes: scopes.length ? scopes : ['read', 'search'],
    createdAt: new Date().toISOString(),
    lastUsed: null,
  };
  await updateSettings((d) => {
    d.api.keys.push(record);
  });
  const { hash: _omit, ...safe } = record;
  return { raw, record: safe };
}

export async function revokeKey(id: string): Promise<boolean> {
  let removed = false;
  await updateSettings((d) => {
    const before = d.api.keys.length;
    d.api.keys = d.api.keys.filter((k) => k.id !== id);
    removed = d.api.keys.length < before;
  });
  return removed;
}

/** Look up a raw key; returns the matching record (and bumps lastUsed). */
export async function authenticateKey(raw: string): Promise<ApiKeyRecord | null> {
  if (!raw) return null;
  const hash = hashApiKey(raw);
  const s = await getSettings();
  const match = s.api.keys.find((k) => k.hash === hash);
  if (!match) return null;
  // best-effort lastUsed update (don't block the request)
  void updateSettings((d) => {
    const k = d.api.keys.find((x) => x.id === match.id);
    if (k) k.lastUsed = new Date().toISOString();
  }).catch(() => {});
  return match;
}
