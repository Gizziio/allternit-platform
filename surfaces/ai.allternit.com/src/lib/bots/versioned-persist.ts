/**
 * Versioned Persist
 *
 * Thin wrapper over zustand's `persist` middleware that adds a `schemaVersion`
 * and a `migrations` map, in the two-phase style of Hermes' BotMeta v1→v2
 * migrators: phase 1 validates the persisted shape, phase 2 applies the
 * migration chain from the stored version up to the current schemaVersion.
 *
 * Current consumers use `schemaVersion: 1` with an identity migration — this
 * is future-proofing only; no data changes. When a future phase bumps the
 * version, add `{ [fromVersion]: (state) => nextState }` entries.
 *
 * @module versioned-persist
 */

import type { PersistOptions, PersistStorage } from 'zustand/middleware';
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';

export interface VersionedPersistConfig<S> {
  /** Current schema version. Bump when the persisted shape changes. */
  schemaVersion: number;
  /**
   * Migration chain keyed by the version being migrated FROM. Each entry
   * upgrades a persisted state of version N to version N+1. Applied in order
   * until the state reaches `schemaVersion`. Omit for identity-only use.
   */
  migrations?: Record<number, (persisted: unknown) => unknown>;
  /** Optional shape validation (phase 1). Return false to discard the persisted state. */
  validate?: (persisted: unknown) => boolean;
  /** Which state slices to persist (zustand `partialize`). */
  partialize?: (state: S) => Partial<S>;
}

/**
 * Build zustand `persist` options with schema versioning. Spreads into the
 * persist options object alongside `name`.
 */
export function createVersionedPersistOptions<S>(
  config: VersionedPersistConfig<S>,
): Pick<
  PersistOptions<S, Partial<S>>,
  'version' | 'migrate' | 'partialize' | 'storage'
> {
  const { schemaVersion, migrations, validate, partialize } = config;

  return {
    storage: createBrowserJSONStorage() as PersistStorage<Partial<S>>,
    ...(partialize ? { partialize } : {}),
    version: schemaVersion,
    migrate: (persisted: unknown, fromVersion: number): Partial<S> => {
      // Phase 1 — validate. Corrupt or rejected state starts fresh rather
      // than crashing hydration.
      if (typeof persisted !== 'object' || persisted === null) {
        return {} as Partial<S>;
      }
      if (validate && !validate(persisted)) {
        return {} as Partial<S>;
      }
      // Phase 2 — apply the migration chain up to the current version.
      let state: unknown = persisted;
      for (let version = fromVersion; version < schemaVersion; version += 1) {
        const migration = migrations?.[version];
        if (migration) {
          state = migration(state);
        }
      }
      return state as Partial<S>;
    },
  };
}
