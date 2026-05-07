/**
 * Feature Plugin Store
 *
 * Persists which feature plugins are enabled/disabled to localStorage.
 * Provides a simple event bus so React hooks stay in sync across components.
 */

import { FEATURE_PLUGIN_REGISTRY } from './feature.registry';

const STORAGE_KEY = 'allternit:feature-plugins:v1';

// ─── Read / Write ─────────────────────────────────────────────────────────────

function readEnabled(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First run: enable defaults
      const defaults = FEATURE_PLUGIN_REGISTRY.filter((p) => p.enabledByDefault).map((p) => p.id);
      return new Set(defaults);
    }
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeEnabled(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore write errors (e.g. private browsing)
  }
}

// ─── Event Bus ────────────────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyAll(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeToPluginChanges(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getEnabledPluginIds(): string[] {
  return [...readEnabled()];
}

export function isPluginEnabled(id: string): boolean {
  return readEnabled().has(id);
}

export function enablePlugin(id: string): void {
  const s = readEnabled();
  s.add(id);
  writeEnabled(s);
  notifyAll();
}

export function disablePlugin(id: string): void {
  const s = readEnabled();
  s.delete(id);
  writeEnabled(s);
  notifyAll();
}

export function togglePlugin(id: string): void {
  if (isPluginEnabled(id)) {
    disablePlugin(id);
  } else {
    enablePlugin(id);
  }
}
