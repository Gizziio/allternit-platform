/**
 * Client-side skills API for Allternit Design mode.
 *
 * Returns bundled open-design skills plus any local skills the user has
 * imported via the File System Access API, and discovered skills from the
 * daemon-side scan of ~/.claude/skills/, ./skills/, and ./.claude/skills/.
 */

import { BUNDLED_SKILLS, getBundledSkillById } from './bundled-skills';
import type { SkillRecord, SkillMode, SkillScenario } from './skill-registry';

export interface SkillsQuery {
  mode?: SkillMode;
  scenario?: SkillScenario;
  query?: string;
}

export interface DiscoveredSkill {
  id: string;
  name: string;
  path: string;
  source: string;
  manifest?: Record<string, unknown>;
}

export interface DiscoverSkillsResponse {
  skills: DiscoveredSkill[];
  scanned_paths: string[];
  total: number;
}

let localSkillCache: SkillRecord[] | null = null;

export function registerLocalSkills(skills: SkillRecord[]) {
  localSkillCache = skills;
}

export function getLocalSkills(): SkillRecord[] {
  return localSkillCache ?? [];
}

function getAllSkills(): SkillRecord[] {
  const map = new Map<string, SkillRecord>();
  for (const skill of BUNDLED_SKILLS) map.set(skill.id, skill);
  // Local skills override bundled skills by id.
  for (const skill of localSkillCache ?? []) map.set(skill.id, skill);
  return Array.from(map.values());
}

export async function fetchSkills(query: SkillsQuery = {}): Promise<SkillRecord[]> {
  // Simulate async API call; in LTS this will be a fetch to /api/design/skills
  await Promise.resolve();
  let skills = getAllSkills();
  if (query.mode) {
    skills = skills.filter((s) => s.mode === query.mode);
  }
  if (query.scenario) {
    skills = skills.filter((s) => s.scenario === query.scenario);
  }
  if (query.query?.trim()) {
    const q = query.query.toLowerCase();
    skills = skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.triggers.some((t) => t.toLowerCase().includes(q)),
    );
  }
  return skills;
}

export async function fetchSkillById(id: string): Promise<SkillRecord | null> {
  await Promise.resolve();
  return getAllSkills().find((s) => s.id === id) ?? null;
}

/**
 * Ask the daemon to scan the canonical skill directories and return any
 * discovered Open Design / Claude skills.
 */
export async function discoverSkills(cwd?: string): Promise<DiscoverSkillsResponse> {
  const params = new URLSearchParams();
  if (cwd) params.set('cwd', cwd);
  const res = await fetch(`/api/design/skills/discover?${params.toString()}`);
  if (!res.ok) {
    return { skills: [], scanned_paths: [], total: 0 };
  }
  return res.json();
}
