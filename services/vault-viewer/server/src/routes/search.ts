import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { qmd } from '../services/search.js';
import { backlinksFor, graphData, resolveLink, buildLinkGraph } from '../services/links.js';
import { resolveFile } from '../services/fileindex.js';
import { readPropertyTypes, setPropertyType } from '../services/propertytypes.js';

export const searchRouter = Router();
searchRouter.use(requireAuth);

searchRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '');
    // limit omitted / 0 → return every match; the client renders them incrementally.
    const limit = Math.max(0, Number(req.query.limit ?? 0) || 0);
    res.json({ query: q, hits: await qmd.search(q, limit) });
  }),
);

// Per-note match contexts for the rendered batch of results (Obsidian-style
// grouped search). Reads bodies lazily so broad queries stay cheap.
searchRouter.post(
  '/search/matches',
  asyncHandler(async (req, res) => {
    const { query, paths, matchCase, phrase } = req.body ?? {};
    // phrase=true → match the whole query as one needle (e.g. unlinked mentions
    // look for the exact note title, not each word of it).
    const terms = phrase
      ? [String(query ?? '').trim()].filter((t) => t.length >= 2)
      : qmd.queryTerms(String(query ?? ''));
    const list = (Array.isArray(paths) ? paths : []).slice(0, 80).map((p) => String(p));
    const matches = await Promise.all(
      list.map((p) => qmd.matchesFor(p, terms, { caseSensitive: !!matchCase })),
    );
    res.json({ matches });
  }),
);

searchRouter.get(
  '/tags',
  asyncHandler(async (_req, res) => {
    res.json({ tags: qmd.allTags() });
  }),
);

searchRouter.get(
  '/properties',
  asyncHandler(async (_req, res) => {
    res.json({ properties: qmd.allProperties() });
  }),
);

searchRouter.get(
  '/property-types',
  asyncHandler(async (_req, res) => {
    res.json({ types: await readPropertyTypes() });
  }),
);

searchRouter.post(
  '/property-types',
  asyncHandler(async (req, res) => {
    const { key, type } = req.body ?? {};
    if (typeof key !== 'string' || typeof type !== 'string') {
      res.status(400).json({ error: 'key and type required' });
      return;
    }
    res.json({ types: await setPropertyType(key, type) });
  }),
);

searchRouter.get(
  '/backlinks',
  asyncHandler(async (req, res) => {
    const rel = String(req.query.path ?? '');
    res.json({ path: rel, backlinks: backlinksFor(rel) });
  }),
);

searchRouter.get(
  '/resolve',
  asyncHandler(async (req, res) => {
    const target = String(req.query.target ?? '');
    // The link graph only indexes markdown notes, so a wikilink that points at a
    // non-markdown file with an explicit extension (e.g. `[[Foo.canvas]]`) misses.
    // Fall back to the vault-wide file index for those — but only when an explicit
    // non-markdown extension is present, so a bare `[[Foo]]` still resolves to a
    // note (or stays unresolved so the client can offer to create one).
    let resolved = resolveLink(target);
    if (!resolved && /\.[^./]+$/.test(target) && !/\.(md|markdown)$/i.test(target)) {
      resolved = resolveFile(target);
    }
    res.json({ target, path: resolved ?? null });
  }),
);

searchRouter.get(
  '/graph',
  asyncHandler(async (_req, res) => {
    res.json(graphData());
  }),
);

searchRouter.post(
  '/reindex',
  asyncHandler(async (_req, res) => {
    await qmd.build();
    await buildLinkGraph();
    res.json({ ok: true });
  }),
);
