import type { CapabilityType } from './capability.types';

const STORAGE_KEYS: Record<CapabilityType, string> = {
  skill: 'allternit:capabilities:skills:v1',
  command: 'allternit:capabilities:commands:v1',
  connector: 'allternit:capabilities:connectors:v1',
  mcp: 'allternit:capabilities:mcps:v1',
  plugin: 'allternit:feature-plugins:v1',
  'cli-tool': 'allternit:capabilities:cli-tools:v1',
  webhook: 'allternit:capabilities:webhooks:v1',
};

type Listener = () => void;
const listeners = new Map<CapabilityType, Set<Listener>>();

function getListeners(type: CapabilityType): Set<Listener> {
  if (!listeners.has(type)) {
    listeners.set(type, new Set());
  }
  return listeners.get(type)!;
}

function notify(type: CapabilityType): void {
  for (const listener of getListeners(type)) {
    listener();
  }
}

function sanitizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function readEnabledState(type: CapabilityType): { ids: string[]; hasStored: boolean } {
  if (typeof window === 'undefined') {
    return { ids: [], hasStored: false };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[type]);
    if (!raw) return { ids: [], hasStored: false };
    return { ids: sanitizeIds(JSON.parse(raw)), hasStored: true };
  } catch {
    return { ids: [], hasStored: true };
  }
}

function writeEnabledIds(type: CapabilityType, ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore storage errors in renderer runtime.
  }
}

export function getEnabledIds(type: CapabilityType): string[] {
  return readEnabledState(type).ids;
}

export function setEnabledIds(type: CapabilityType, ids: Set<string>): void {
  writeEnabledIds(type, ids);
  notify(type);
}

export function isEnabled(type: CapabilityType, id: string): boolean {
  return getEnabledIds(type).includes(id);
}

export function enable(type: CapabilityType, id: string): void {
  const ids = new Set(getEnabledIds(type));
  ids.add(id);
  setEnabledIds(type, ids);
}

export function disable(type: CapabilityType, id: string): void {
  const ids = new Set(getEnabledIds(type));
  ids.delete(id);
  setEnabledIds(type, ids);
}

export function toggle(type: CapabilityType, id: string): void {
  const ids = new Set(getEnabledIds(type));
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  setEnabledIds(type, ids);
}

export function subscribeToCapabilityChanges(type: CapabilityType, fn: Listener): () => void {
  const set = getListeners(type);
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}
