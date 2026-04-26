/**
 * Persisted Atom State — structured, versioned, debounced state persistence.
 *
 * Replaces raw electron-store access with typed state slices, schema
 * migrations, and a subscribe API so the renderer can react to changes.
 *
 * Uses electron-store as the durable backend (same file, extended API).
 */

import Store from 'electron-store';
import log from 'electron-log';

// ── Schema version — bump when adding/removing/renaming fields ───────────────
const SCHEMA_VERSION = 1;

// ── State shape ──────────────────────────────────────────────────────────────

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

export interface BackendState {
  mode: 'bundled' | 'remote' | 'development';
  remoteUrl?: string;
  lastLocalVersion?: string;
}

export interface SessionState {
  lastSessionId?: string;
  lastProjectPath?: string;
  recentSessionIds: string[];
}

export interface AppPrefs {
  theme: 'light' | 'dark' | 'system';
  locale?: string;
  menuBarMode: boolean;
  startupOnLogin: boolean;
  viewMode: 'verbose' | 'normal' | 'summary';
}

export interface PersistedStateSchema {
  _version: number;
  window: WindowState;
  backend: BackendState;
  session: SessionState;
  prefs: AppPrefs;
  onboardingComplete: boolean;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: PersistedStateSchema = {
  _version: SCHEMA_VERSION,
  window: { width: 1400, height: 900, maximized: false },
  backend: { mode: 'bundled' },
  session: { recentSessionIds: [] },
  prefs: {
    theme: 'system',
    menuBarMode: false,
    startupOnLogin: false,
    viewMode: 'normal',
  },
  onboardingComplete: false,
};

// ── Migrations ───────────────────────────────────────────────────────────────
// Add entries here when SCHEMA_VERSION bumps.

type Migration = (raw: Record<string, unknown>) => void;

const MIGRATIONS: Record<number, Migration> = {
  // 1 → 2: example future migration
  // 2: (raw) => { raw.prefs = raw.prefs ?? {}; },
};

// ── Manager ──────────────────────────────────────────────────────────────────

type SliceKey = keyof Omit<PersistedStateSchema, '_version'>;
type SliceValue<K extends SliceKey> = PersistedStateSchema[K];
type ChangeHandler<K extends SliceKey> = (value: SliceValue<K>) => void;

class PersistedStateManager {
  private store: Store<PersistedStateSchema>;
  private handlers = new Map<string, Set<ChangeHandler<SliceKey>>>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: Partial<PersistedStateSchema> = {};

  constructor() {
    this.store = new Store<PersistedStateSchema>({
      name: 'allternit-state',
      defaults: DEFAULTS,
    });
    this.migrate();
  }

  get<K extends SliceKey>(key: K): SliceValue<K> {
    return this.store.get(key) as SliceValue<K>;
  }

  set<K extends SliceKey>(key: K, value: SliceValue<K>): void {
    this.pending[key] = value as never;
    this.scheduleFLush();
    this.emit(key, value);
  }

  /** Deep-merge a partial update into a slice. */
  patch<K extends SliceKey>(key: K, partial: Partial<SliceValue<K>>): void {
    const current = this.get(key);
    const next = { ...(current as object), ...(partial as object) } as SliceValue<K>;
    this.set(key, next);
  }

  subscribe<K extends SliceKey>(key: K, handler: ChangeHandler<K>): () => void {
    if (!this.handlers.has(key)) this.handlers.set(key, new Set());
    this.handlers.get(key)!.add(handler as ChangeHandler<SliceKey>);
    return () => this.handlers.get(key)?.delete(handler as ChangeHandler<SliceKey>);
  }

  /** Force-flush pending writes immediately (call on app quit). */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.writePending();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private scheduleFLush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.writePending();
    }, 500);
  }

  private writePending(): void {
    if (Object.keys(this.pending).length === 0) return;
    for (const [key, value] of Object.entries(this.pending)) {
      this.store.set(key as SliceKey, value as never);
    }
    log.debug('[PersistedState] Flushed:', Object.keys(this.pending));
    this.pending = {};
  }

  private migrate(): void {
    const stored = (this.store.get('_version') as number | undefined) ?? 0;
    if (stored >= SCHEMA_VERSION) return;
    log.info(`[PersistedState] Migrating v${stored} → v${SCHEMA_VERSION}`);
    const raw = this.store.store as unknown as Record<string, unknown>;
    for (let v = stored + 1; v <= SCHEMA_VERSION; v++) {
      const migration = MIGRATIONS[v];
      if (migration) {
        try { migration(raw); } catch (err) {
          log.error(`[PersistedState] Migration v${v} failed:`, err);
        }
      }
    }
    raw['_version'] = SCHEMA_VERSION;
    this.store.store = raw as unknown as PersistedStateSchema;
    log.info('[PersistedState] Migration complete');
  }

  private emit<K extends SliceKey>(key: K, value: SliceValue<K>): void {
    const set = this.handlers.get(key);
    if (!set) return;
    for (const handler of set) {
      try { handler(value as never); } catch { /* never crash on state change */ }
    }
  }
}

export const persistedState = new PersistedStateManager();
