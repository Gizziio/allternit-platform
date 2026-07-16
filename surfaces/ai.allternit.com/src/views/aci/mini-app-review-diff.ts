/**
 * Security-focused diff between a candidate miniapp manifest and the
 * previously verified one. Pure and renderer-agnostic so it can be verified
 * with plain node and reused by the review console and by tests.
 *
 * The registry returns both manifests verbatim; this module computes what a
 * reviewer triages on: permission/command/presentation changes and a list of
 * risk flags. A first submission (no previous verified version) reports every
 * present section as "added".
 */

import type { MiniAppManifest } from './mini-app.types';

export interface ManifestDiffChange {
  /** Dotted section, e.g. "permissions.network" or "lifecycle.start". */
  section: string;
  /** 'added' | 'removed' | 'changed' */
  kind: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

export interface ManifestReviewDiff {
  /** null when there is no previously verified version (first submission). */
  fromVersion: string | null;
  toVersion: string;
  changes: ManifestDiffChange[];
  riskFlags: string[];
  hasSecurityRelevantChanges: boolean;
}

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

const scalarChanged = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);

/** Diff two string arrays into added/removed entries. */
function diffStringList(
  section: string,
  oldList: unknown,
  newList: unknown,
  changes: ManifestDiffChange[],
): { added: string[]; removed: string[] } {
  const oldSet = new Set(asStringArray(oldList));
  const newSet = new Set(asStringArray(newList));
  const added = [...newSet].filter((v) => !oldSet.has(v));
  const removed = [...oldSet].filter((v) => !newSet.has(v));
  for (const value of added) changes.push({ section, kind: 'added', newValue: value });
  for (const value of removed) changes.push({ section, kind: 'removed', oldValue: value });
  return { added, removed };
}

/** Diff scalar fields of two objects; reports each changed field. */
function diffScalarFields(
  section: string,
  fields: string[],
  oldObj: Json | null,
  newObj: Json | null,
  changes: ManifestDiffChange[],
): string[] {
  const changedFields: string[] = [];
  for (const field of fields) {
    const oldValue = oldObj?.[field];
    const newValue = newObj?.[field];
    if (oldValue === undefined && newValue === undefined) continue;
    if (!scalarChanged(oldValue, newValue)) continue;
    changedFields.push(field);
    const kind =
      oldValue === undefined ? 'added' : newValue === undefined ? 'removed' : 'changed';
    changes.push({ section: `${section}.${field}`, kind, oldValue, newValue });
  }
  return changedFields;
}

/** Diff env maps by key: added / removed / changed values. */
function diffEnv(
  oldEnv: unknown,
  newEnv: unknown,
  changes: ManifestDiffChange[],
): boolean {
  const oldMap = asObject(oldEnv) ?? {};
  const newMap = asObject(newEnv) ?? {};
  let changed = false;
  for (const key of Object.keys(newMap)) {
    if (!(key in oldMap)) {
      changes.push({ section: 'harness.env', kind: 'added', newValue: key });
      changed = true;
    } else if (scalarChanged(oldMap[key], newMap[key])) {
      changes.push({
        section: 'harness.env',
        kind: 'changed',
        oldValue: `${key}=${String(oldMap[key])}`,
        newValue: `${key}=${String(newMap[key])}`,
      });
      changed = true;
    }
  }
  for (const key of Object.keys(oldMap)) {
    if (!(key in newMap)) {
      changes.push({ section: 'harness.env', kind: 'removed', oldValue: key });
      changed = true;
    }
  }
  return changed;
}

export function diffManifestsForReview(
  previous: MiniAppManifest | null | undefined,
  candidate: MiniAppManifest,
): ManifestReviewDiff {
  const changes: ManifestDiffChange[] = [];
  const riskFlags = new Set<string>();
  const prev = (previous ?? null) as Json | null;
  const next = candidate as unknown as Json;

  // ── Permissions ──────────────────────────────────────────────────────────
  const prevPerms = asObject(prev?.permissions) ?? {};
  const nextPerms = asObject(next.permissions) ?? {};
  for (const list of ['network', 'filesystem', 'secrets'] as const) {
    const { added, removed } = diffStringList(
      `permissions.${list}`,
      prevPerms[list],
      nextPerms[list],
      changes,
    );
    if (added.length > 0) {
      riskFlags.add(
        list === 'network'
          ? 'network-expanded'
          : list === 'filesystem'
            ? 'filesystem-expanded'
            : 'secrets-added',
      );
    }
    if (removed.length > 0 && added.length === 0) riskFlags.add(`${list}-reduced`);
  }
  const prevProcesses = prevPerms.processes === true;
  const nextProcesses = nextPerms.processes === true;
  if (prevProcesses !== nextProcesses) {
    changes.push({
      section: 'permissions.processes',
      kind: 'changed',
      oldValue: prevProcesses,
      newValue: nextProcesses,
    });
    if (nextProcesses) riskFlags.add('processes-enabled');
  }

  // ── Harness ──────────────────────────────────────────────────────────────
  const prevHarness = asObject(prev?.harness);
  const nextHarness = asObject(next.harness);
  const harnessChanged = diffScalarFields(
    'harness',
    ['transport', 'command', 'args', 'baseURL', 'cwd', 'model'],
    prevHarness,
    nextHarness,
    changes,
  );
  if (diffEnv(prevHarness?.env, nextHarness?.env, changes)) harnessChanged.push('env');
  if (harnessChanged.length > 0) riskFlags.add('commands-changed');

  // ── Lifecycle ────────────────────────────────────────────────────────────
  const prevLifecycle = asObject(prev?.lifecycle);
  const nextLifecycle = asObject(next.lifecycle);
  const lifecycleFields = ['install', 'start', 'stop', 'health'] as const;
  let lifecycleChanged = false;
  for (const field of lifecycleFields) {
    const oldValue = prevLifecycle?.[field];
    const newValue = nextLifecycle?.[field];
    if (oldValue === undefined && newValue === undefined) continue;
    if (!scalarChanged(oldValue, newValue)) continue;
    lifecycleChanged = true;
    const kind =
      oldValue === undefined ? 'added' : newValue === undefined ? 'removed' : 'changed';
    changes.push({ section: `lifecycle.${field}`, kind, oldValue, newValue });
  }
  if (lifecycleChanged) riskFlags.add('commands-changed');

  // ── Presentation ─────────────────────────────────────────────────────────
  const presentationChanged = diffScalarFields(
    'presentation',
    ['mode', 'uiUrl', 'healthUrl', 'electronPartition', 'nativeRenderer', 'fallback'],
    asObject(prev?.presentation),
    asObject(next.presentation),
    changes,
  );
  if (presentationChanged.length > 0) riskFlags.add('presentation-changed');

  // ── Compatibility ────────────────────────────────────────────────────────
  const prevCompat = asObject(prev?.compatibility);
  const nextCompat = asObject(next.compatibility);
  const { added: addedPlatforms } = diffStringList(
    'compatibility.platforms',
    prevCompat?.platforms,
    nextCompat?.platforms,
    changes,
  );
  if (addedPlatforms.length > 0) riskFlags.add('platforms-expanded');
  diffScalarFields('compatibility', ['allternit'], prevCompat, nextCompat, changes);

  // ── Top-level metadata ───────────────────────────────────────────────────
  diffScalarFields(
    'manifest',
    ['name', 'description', 'category', 'icon', 'repo', 'githubUrl', 'downloadable', 'pinnable'],
    prev,
    next,
    changes,
  );

  const securitySections = /^(permissions|harness|lifecycle|presentation|compatibility)\./;
  const hasSecurityRelevantChanges = changes.some((change) =>
    securitySections.test(change.section),
  );
  if (prev === null) riskFlags.add('first-submission');
  if (hasSecurityRelevantChanges === false && prev !== null) {
    // Metadata-only update: worth saying out loud for the reviewer.
    riskFlags.add('metadata-only');
  }

  return {
    fromVersion: (prev?.version as string | undefined) ?? null,
    toVersion: (next.version as string | undefined) ?? '',
    changes,
    riskFlags: [...riskFlags].sort(),
    hasSecurityRelevantChanges,
  };
}
