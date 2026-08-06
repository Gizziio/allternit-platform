import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireApiKey } from '../middleware/apikey.js';
import * as vault from '../services/vault.js';
import { qmd } from '../services/search.js';
import { backlinksFor, buildLinkGraph } from '../services/links.js';
import { parseNote } from '../services/markdown.js';

/**
 * Agent API (PRD FR-6) — REST surface for AI agents, authenticated by API key.
 * All note paths are vault-relative. Scopes: read / write / search.
 */
export const agentRouter = Router();

function reindex(rel?: string) {
  if (rel) void qmd.upsert(rel).catch(() => {});
  void buildLinkGraph().catch(() => {});
}

agentRouter.get('/health', (_req, res) => res.json({ ok: true, service: 'webobsidian-agent-api', version: 'v1' }));

// List notes
agentRouter.get(
  '/notes',
  requireApiKey('read'),
  asyncHandler(async (req, res) => {
    const all = await vault.listMarkdownFiles();
    const offset = Number(req.query.offset ?? 0) || 0;
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
    res.json({ total: all.length, offset, limit, notes: all.slice(offset, offset + limit) });
  }),
);

// Read a note (path can contain slashes)
agentRouter.get(
  '/notes/*',
  requireApiKey('read'),
  asyncHandler(async (req, res) => {
    const rel = decodeURIComponent((req.params as any)[0]);
    if (!(await vault.exists(rel))) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const content = await vault.readFileText(rel);
    const note = parseNote(rel, content);
    res.json({
      path: rel,
      content,
      title: note.title,
      frontmatter: note.frontmatter,
      tags: note.tags,
      links: note.links,
    });
  }),
);

// Create / update a note
agentRouter.put(
  '/notes/*',
  requireApiKey('write'),
  asyncHandler(async (req, res) => {
    const rel = decodeURIComponent((req.params as any)[0]);
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    await vault.writeFileText(rel, content);
    reindex(rel);
    res.json({ ok: true, path: rel });
  }),
);

// Append to a note (creates if missing)
agentRouter.patch(
  '/notes/*',
  requireApiKey('write'),
  asyncHandler(async (req, res) => {
    const rel = decodeURIComponent((req.params as any)[0]);
    const append = typeof req.body?.append === 'string' ? req.body.append : '';
    const existing = (await vault.exists(rel)) ? await vault.readFileText(rel) : '';
    const joined = existing && !existing.endsWith('\n') ? existing + '\n' + append : existing + append;
    await vault.writeFileText(rel, joined);
    reindex(rel);
    res.json({ ok: true, path: rel, size: joined.length });
  }),
);

// Delete a note (to trash)
agentRouter.delete(
  '/notes/*',
  requireApiKey('write'),
  asyncHandler(async (req, res) => {
    const rel = decodeURIComponent((req.params as any)[0]);
    if (!(await vault.exists(rel))) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const trashed = await vault.trash(rel);
    qmd.remove(rel);
    reindex();
    res.json({ ok: true, trashed });
  }),
);

// Search
agentRouter.get(
  '/search',
  requireApiKey('search'),
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '');
    const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
    res.json({ query: q, hits: await qmd.search(q, limit) });
  }),
);

// Backlinks
agentRouter.get(
  '/backlinks',
  requireApiKey('read'),
  asyncHandler(async (req, res) => {
    const rel = String(req.query.path ?? '');
    res.json({ path: rel, backlinks: backlinksFor(rel) });
  }),
);

// Tags
agentRouter.get(
  '/tags',
  requireApiKey('read'),
  asyncHandler(async (_req, res) => {
    res.json({ tags: qmd.allTags() });
  }),
);
