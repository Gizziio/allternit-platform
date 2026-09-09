import { describe, expect, it } from 'vitest';
import { SitePluginManifestSchema } from '@allternit/computer-use-protocol';
import { loadPluginManifest } from '../adapters/common.js';
import { createGitHubSiteTools, loadGitHubSiteTools } from '../adapters/github.js';
import { createGmailSiteTools, loadGmailSiteTools } from '../adapters/gmail.js';
import { createNotionSiteTools, loadNotionSiteTools } from '../adapters/notion.js';
import { SiteToolRegistry } from '../registry.js';
import { planResolution } from '../resolver.js';

const PLUGIN_IDS = ['gmail', 'github', 'notion'] as const;

describe('plugin manifest loading', () => {
  it.each(PLUGIN_IDS)('loads and validates the real %s plugin.json', (id) => {
    const manifest = loadPluginManifest(id);
    expect(manifest.id).toBe(id);
    // Must validate against the canonical protocol schema (round-trip).
    expect(SitePluginManifestSchema.parse(JSON.parse(JSON.stringify(manifest)))).toEqual(manifest);
    expect(manifest.policy_profile.allowed_domains.length).toBeGreaterThan(0);
  });
});

describe('site tool adapters', () => {
  it('gmail exposes read_inbox with WebMCP-shaped descriptors wired to the plugin policy', () => {
    const tools = loadGmailSiteTools();
    expect(tools).toHaveLength(1);
    const [tool] = tools;
    expect(tool.descriptor.name).toBe('gmail.read_inbox');
    expect(tool.descriptor.description.length).toBeGreaterThan(0);
    expect(tool.descriptor.inputSchema.type).toBe('object');
    expect(tool.allowedDomains).toContain('mail.google.com');
    expect(tool.blockedActions).toEqual(
      expect.arrayContaining(['delete_all_emails', 'empty_trash', 'remove_label_inbox', 'send_to_all_contacts']),
    );
  });

  it('github exposes review_pr and triage_issue from its cookbooks', () => {
    const tools = loadGitHubSiteTools();
    expect(tools.map((tool) => tool.descriptor.name).sort()).toEqual(['github.review_pr', 'github.triage_issue']);
    for (const tool of tools) {
      expect(tool.allowedDomains).toEqual(expect.arrayContaining(['github.com', '*.github.com']));
      expect(tool.blockedActions).toEqual(
        expect.arrayContaining(['delete_repository', 'force_push', 'dismiss_review', 'close_all_issues']),
      );
      expect(tool.descriptor.description).toMatch(/pull request|issue/i);
    }
  });

  it('notion exposes create_page', () => {
    const tools = loadNotionSiteTools();
    expect(tools.map((tool) => tool.descriptor.name)).toEqual(['notion.create_page']);
    expect(tools[0].descriptor.inputSchema.required).toEqual(['title']);
    expect(tools[0].blockedActions).toContain('delete_workspace');
  });

  it('rejects a manifest from the wrong plugin', () => {
    const gmailManifest = loadPluginManifest('gmail');
    expect(() => createGitHubSiteTools(gmailManifest)).toThrow(/github/);
    expect(() => createNotionSiteTools(gmailManifest)).toThrow(/notion/);
  });

  it('handlers return a plan in dry-run mode without touching the browser', async () => {
    const registry = new SiteToolRegistry();
    registry.registerAll([...loadGitHubSiteTools(), ...loadGmailSiteTools(), ...loadNotionSiteTools()]);
    // A live browser is not reachable in this test; dry-run must not need one.
    const dry = { cdpUrl: 'http://127.0.0.1:1', targetId: 'about:blank', dryRun: true };

    const review = await registry.invoke('github.review_pr', { prUrl: 'https://github.com/acme/app/pull/1', reviewText: 'LGTM' }, dry);
    expect(review.ok).toBe(true);
    expect(review.data?.steps).toEqual(expect.arrayContaining([expect.stringContaining('navigate')]));

    const inbox = await registry.invoke('gmail.read_inbox', { maxMessages: 3 }, dry);
    expect(inbox.ok).toBe(true);

    const page = await registry.invoke('notion.create_page', { title: 'Standup notes', paragraphs: ['a'] }, dry);
    expect(page.ok).toBe(true);
    expect(page.summary).toContain('Standup notes');
  });

  it('blocked actions from the real github manifest are refused at the tool boundary', async () => {
    const registry = new SiteToolRegistry();
    registry.registerAll(loadGitHubSiteTools());
    for (const blocked of ['delete_repository', 'force_push', 'dismiss_review', 'close_all_issues']) {
      const result = await registry.invoke('github.review_pr', { requestedAction: blocked }, { cdpUrl: '', targetId: '' });
      expect(result).toMatchObject({ ok: false, refused: true });
      expect(result.reason).toContain(blocked);
    }
  });
});

describe('resolver preference ordering', () => {
  it('prefers site tools when the origin matches, falling back to DOM refs then vision', () => {
    const registry = new SiteToolRegistry();
    registry.registerAll(loadGitHubSiteTools());
    const plan = planResolution(registry.list(), 'https://github.com/acme/app/pull/1');
    expect(plan.order).toEqual(['site-tool', 'dom-refs', 'vision']);
    expect(plan.tools.map((descriptor) => descriptor.name)).toContain('github.review_pr');
  });

  it('wildcard subdomains match (gist.github.com etc.)', () => {
    const registry = new SiteToolRegistry();
    registry.registerAll(loadGitHubSiteTools());
    const plan = planResolution(registry.list(), 'https://gist.github.com/x');
    expect(plan.order[0]).toBe('site-tool');
  });

  it('skips site tools for unknown or non-matching origins', () => {
    const registry = new SiteToolRegistry();
    registry.registerAll(loadGitHubSiteTools());
    expect(planResolution(registry.list(), 'https://example.com/').order).toEqual(['dom-refs', 'vision']);
    expect(planResolution(registry.list(), null).order).toEqual(['dom-refs', 'vision']);
  });

  it('returns no site tools for gmail origins when only github tools are registered', () => {
    const registry = new SiteToolRegistry();
    registry.registerAll(loadGitHubSiteTools());
    const plan = planResolution(registry.list(), 'https://mail.google.com/');
    expect(plan.order).toEqual(['dom-refs', 'vision']);
    expect(plan.tools).toEqual([]);
  });
});
