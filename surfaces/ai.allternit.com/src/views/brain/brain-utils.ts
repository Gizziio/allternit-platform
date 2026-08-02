import type { BrainPage } from '@/services/brain-api';

export interface PageBadges {
  type?: string;
  status?: string;
  domain?: string;
  confidence?: string;
}

export interface PageGroup {
  /** Top-level directory of the page path, or ROOT_GROUP for top-level files. */
  directory: string;
  pages: BrainPage[];
}

export interface LearningEntry {
  page: BrainPage;
  isStale: boolean;
  provenanceRefs: string[];
  badges: PageBadges;
}

export const ROOT_GROUP = '(root)';

/** Known second-brain directories, in display order. Unknown dirs follow alphabetically. */
const KNOWN_DIRS = ['decisions', 'runbooks', 'ideas', 'pains', 'learnings'];

export function topLevelDirectory(path: string): string {
  const idx = path.indexOf('/');
  return idx === -1 ? ROOT_GROUP : path.slice(0, idx);
}

export function groupPagesByDirectory(pages: BrainPage[]): PageGroup[] {
  const groups = new Map<string, BrainPage[]>();
  for (const page of pages) {
    const dir = topLevelDirectory(page.path);
    const arr = groups.get(dir) ?? [];
    arr.push(page);
    groups.set(dir, arr);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => a.path.localeCompare(b.path));
  }
  const order: string[] = [
    ...KNOWN_DIRS.filter((d) => groups.has(d)),
    ...[...groups.keys()].filter((d) => !KNOWN_DIRS.includes(d) && d !== ROOT_GROUP).sort(),
  ];
  if (groups.has(ROOT_GROUP)) order.push(ROOT_GROUP);
  return order.map((directory) => ({ directory, pages: groups.get(directory)! }));
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  return undefined;
}

export function extractBadges(page: BrainPage): PageBadges {
  const fm = page.frontmatter ?? {};
  return {
    type: asString(fm.type),
    status: asString(fm.status),
    domain: asString(fm.domain),
    confidence: asString(fm.confidence),
  };
}

/** provenance_refs is a dashed YAML list, but be defensive: a single comma-separated string also occurs. */
export function normalizeProvenanceRefs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function addedTime(page: BrainPage): number {
  const raw = page.frontmatter?.added;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const t = typeof value === 'string' ? new Date(value).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/** Pages under learnings/, newest first (frontmatter.added desc, path asc as tiebreak/fallback). */
export function learningFeed(pages: BrainPage[]): LearningEntry[] {
  const entries = pages
    .filter((p) => topLevelDirectory(p.path) === 'learnings')
    .map((page) => ({
      page,
      isStale: page.frontmatter?.status === 'stale',
      provenanceRefs: normalizeProvenanceRefs(page.frontmatter?.provenance_refs),
      badges: extractBadges(page),
    }));
  entries.sort((a, b) => {
    const diff = addedTime(b.page) - addedTime(a.page);
    return diff !== 0 ? diff : a.page.path.localeCompare(b.page.path);
  });
  return entries;
}
