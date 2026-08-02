import { describe, it, expect } from 'vitest';
import type { BrainPage } from '@/services/brain-api';
import {
  groupPagesByDirectory,
  learningFeed,
  extractBadges,
  normalizeProvenanceRefs,
  ROOT_GROUP,
} from './brain-utils';

function page(path: string, frontmatter: BrainPage['frontmatter'] = {}, content = ''): BrainPage {
  return { path, frontmatter, content };
}

describe('groupPagesByDirectory', () => {
  it('orders known dirs first, then other dirs alphabetically, then root files', () => {
    const groups = groupPagesByDirectory([
      page('notes/plain.md'),
      page('learnings/a.md'),
      page('zzz-last/x.md'),
      page('decisions/d1.md'),
      page('README.md'),
      page('pains/p1.md'),
      page('alpha/a.md'),
    ]);
    expect(groups.map((g) => g.directory)).toEqual([
      'decisions',
      'pains',
      'learnings',
      'alpha',
      'notes',
      'zzz-last',
      ROOT_GROUP,
    ]);
  });

  it('sorts pages within a group by path', () => {
    const groups = groupPagesByDirectory([
      page('learnings/b.md'),
      page('learnings/a.md'),
    ]);
    expect(groups[0].pages.map((p) => p.path)).toEqual(['learnings/a.md', 'learnings/b.md']);
  });

  it('handles an empty list', () => {
    expect(groupPagesByDirectory([])).toEqual([]);
  });
});

describe('learningFeed', () => {
  it('sorts newest-first by frontmatter.added with path asc fallback', () => {
    const feed = learningFeed([
      page('learnings/old.md', { added: '2026-01-01' }),
      page('learnings/new.md', { added: '2026-07-01' }),
      page('learnings/b-undated.md'),
      page('learnings/a-undated.md'),
      page('notes/not-a-learning.md', { added: '2026-08-01' }),
    ]);
    expect(feed.map((e) => e.page.path)).toEqual([
      'learnings/new.md',
      'learnings/old.md',
      'learnings/a-undated.md',
      'learnings/b-undated.md',
    ]);
  });

  it('detects stale lessons', () => {
    const feed = learningFeed([
      page('learnings/stale.md', { status: 'stale' }),
      page('learnings/active.md', { status: 'active' }),
    ]);
    expect(feed.find((e) => e.page.path === 'learnings/stale.md')?.isStale).toBe(true);
    expect(feed.find((e) => e.page.path === 'learnings/active.md')?.isStale).toBe(false);
  });

  it('normalizes provenance refs from an array', () => {
    const feed = learningFeed([
      page('learnings/x.md', { provenance_refs: ['decisions/d1.md', 'runbooks/r1.md'] }),
    ]);
    expect(feed[0].provenanceRefs).toEqual(['decisions/d1.md', 'runbooks/r1.md']);
  });

  it('normalizes provenance refs from a comma-separated string', () => {
    const feed = learningFeed([
      page('learnings/x.md', { provenance_refs: 'decisions/d1.md, runbooks/r1.md' }),
    ]);
    expect(feed[0].provenanceRefs).toEqual(['decisions/d1.md', 'runbooks/r1.md']);
  });

  it('returns empty provenance refs when missing', () => {
    expect(normalizeProvenanceRefs(undefined)).toEqual([]);
    const feed = learningFeed([page('learnings/x.md')]);
    expect(feed[0].provenanceRefs).toEqual([]);
  });
});

describe('extractBadges', () => {
  it('extracts type/status/domain/confidence', () => {
    const badges = extractBadges(
      page('learnings/x.md', {
        type: 'lesson',
        status: 'active',
        domain: 'testing',
        confidence: 'high',
      })
    );
    expect(badges).toEqual({ type: 'lesson', status: 'active', domain: 'testing', confidence: 'high' });
  });

  it('tolerates missing keys', () => {
    expect(extractBadges(page('notes/plain.md'))).toEqual({
      type: undefined,
      status: undefined,
      domain: undefined,
      confidence: undefined,
    });
  });
});
