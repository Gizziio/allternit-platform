/**
 * Skills lockfile reader
 *
 * Reads `skills-lock.json` (pinned skill hashes) and verifies on-disk
 * skill files against it. Dependency-free: node:crypto only.
 *
 * Lockfile format:
 *   { "version": 1, "skills": { "<name>": { "source", "sourceType",
 *     "skillPath", "computedHash" } } }
 * `skillPath` is relative to the directory containing the lockfile.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/** A single pinned skill entry from the lockfile */
export interface LockedSkill {
  source: string;
  sourceType: string;
  /** Path to the skill's SKILL.md, relative to the lockfile directory */
  skillPath: string;
  /** Expected sha256 hex digest of the file at skillPath */
  computedHash: string;
}

/** Parsed skills-lock.json */
export interface SkillsLock {
  version: number;
  skills: Record<string, LockedSkill>;
}

/** Result of verifying one locked skill against disk */
export type LockVerification = 'ok' | 'mismatch' | 'missing';

/** Load and parse a skills-lock.json. Returns null if the file does not exist. */
export async function loadSkillsLock(lockfilePath: string): Promise<SkillsLock | null> {
  let content: string;
  try {
    content = await fs.readFile(lockfilePath, 'utf-8');
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const parsed = JSON.parse(content);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof parsed.version !== 'number' ||
    typeof parsed.skills !== 'object' ||
    parsed.skills === null
  ) {
    throw new Error(`Invalid skills lockfile: ${lockfilePath}`);
  }

  return parsed as SkillsLock;
}

/**
 * Find a skills-lock.json by walking up from `startDir` toward the
 * filesystem root. Returns the lockfile and the directory it was found in
 * (the root that skillPath entries are relative to), or null if none found.
 */
export async function findSkillsLock(
  startDir: string,
): Promise<{ dir: string; lock: SkillsLock } | null> {
  let dir = path.resolve(startDir);

  for (;;) {
    const candidate = path.join(dir, 'skills-lock.json');
    const lock = await loadSkillsLock(candidate);
    if (lock !== null) {
      return { dir, lock };
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/** Recompute the sha256 hex digest of a file. */
export async function sha256File(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Verify one locked skill: hash the file at `locked.skillPath` relative to
 * `rootDir` and compare against `locked.computedHash`.
 * - 'missing': the file is not on disk
 * - 'mismatch': the hash differs from the pinned hash
 * - 'ok': the hash matches
 */
export async function verifyLockedSkill(rootDir: string, locked: LockedSkill): Promise<LockVerification> {
  const filePath = path.join(rootDir, locked.skillPath);

  let actualHash: string;
  try {
    actualHash = await sha256File(filePath);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return 'missing';
    }
    throw error;
  }

  return actualHash === locked.computedHash ? 'ok' : 'mismatch';
}
