import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SitePluginManifest } from '@allternit/computer-use-protocol';
import {
  clickViaPlaywright,
  navigateViaPlaywright,
  pressKeyViaPlaywright,
  typeViaPlaywright,
  waitForViaPlaywright,
  evaluateViaPlaywright,
} from '../../playwright/actions.js';
import { refused, type SiteTool, type SiteToolContext, type SiteToolResult } from '../registry.js';
import { loadPluginManifest, readCookbookSection, resolvePluginDir } from './common.js';

/**
 * Notion site tools, derived from domains/computer-use/core/plugins/notion:
 *  - cookbook create-page.md → notion.create_page
 * Page creation is classified as a destructive action by the plugin policy;
 * the caller (model + operator approval) is responsible for the approval gate.
 */

function requireString(args: Record<string, unknown>, field: string): string {
  const value = args[field];
  if (typeof value !== 'string' || !value) throw new Error(`notion tool requires args.${field}`);
  return value;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

interface NotionBinding {
  cdpUrl: string;
  targetId: string;
}

const WORKSPACE_URL = 'https://www.notion.so';

async function createPageHandler(args: Record<string, unknown>, ctx: SiteToolContext): Promise<SiteToolResult> {
  const title = requireString(args, 'title');
  const requested = typeof args.requestedAction === 'string' ? args.requestedAction : 'create_notion_page';
  if (requested !== 'create_notion_page') {
    return refused(`notion.create_page does not perform action '${requested}'`);
  }
  const parentUrl = typeof args.parentUrl === 'string' && args.parentUrl ? args.parentUrl : WORKSPACE_URL;
  const paragraphs = stringList(args.paragraphs);
  const todoItems = stringList(args.todoItems);
  const plan = [
    `navigate ${parentUrl}`,
    'open a new page (sidebar New page button, Meta/Ctrl+N fallback)',
    `type title '${title}'`,
    ...paragraphs.map((paragraph) => `type body paragraph (${paragraph.length} chars)`),
    ...todoItems.map((item) => `type to-do item '${item}'`),
    'wait for auto-save and extract the new page URL',
  ];
  if (ctx.dryRun) {
    return { ok: true, summary: `dry-run: would create Notion page '${title}'`, data: { steps: plan } };
  }

  const binding = { cdpUrl: ctx.cdpUrl, targetId: ctx.targetId };
  await navigateViaPlaywright({ ...binding, url: parentUrl });
  await waitForViaPlaywright({
    ...binding,
    selector: "nav[aria-label='Sidebar'], div[data-block-id]",
    timeoutMs: 20_000,
  });

  try {
    await clickViaPlaywright({
      ...binding,
      ref: '',
      selector: "div.notion-sidebar-container div[role='button'][aria-label='New page']",
      timeoutMs: 5_000,
    });
  } catch {
    await pressKeyViaPlaywright({ ...binding, key: 'Meta+N' });
  }
  await waitForViaPlaywright({ ...binding, selector: 'div.notion-page-content', timeoutMs: 10_000 });

  await clickViaPlaywright({ ...binding, ref: '', selector: "div[placeholder='Untitled']" });
  await typeViaPlaywright({ ...binding, ref: '', selector: "div[placeholder='Untitled']", text: title });
  await pressKeyViaPlaywright({ ...binding, key: 'Enter' });

  for (const paragraph of paragraphs) {
    await typeViaPlaywright({ ...binding, ref: '', selector: 'div.notion-page-content', text: paragraph });
    await pressKeyViaPlaywright({ ...binding, key: 'Enter' });
  }
  for (const item of todoItems) {
    // Slash-command fallback: type to-do content as plain text lines prefixed
    // with the to-do marker (cookbook allows degraded formatting).
    await typeViaPlaywright({ ...binding, ref: '', selector: 'div.notion-page-content', text: `[ ] ${item}` });
    await pressKeyViaPlaywright({ ...binding, key: 'Enter' });
  }

  await waitForViaPlaywright({ ...binding, timeMs: 1_500 });
  const urlFn = '(() => window.location.href)()';
  const newPageUrl = await evaluateViaPlaywright({ ...binding, fn: urlFn });

  return {
    ok: true,
    summary: `Notion page '${title}' created`,
    data: { title, newPageUrl: typeof newPageUrl === 'string' ? newPageUrl : null, parentUrl },
  };
}

export function createNotionSiteTools(manifest: SitePluginManifest): SiteTool[] {
  if (manifest.id !== 'notion') throw new Error(`Expected the notion plugin manifest, got '${manifest.id}'`);
  let goal = 'Create a new Notion page with a title, structured content, and a to-do checklist.';
  try {
    const md = readFileSync(join(resolvePluginDir('notion'), 'cookbooks', 'create-page.md'), 'utf8');
    goal = readCookbookSection(md, 'Goal') || goal;
  } catch {
    // Cookbooks are documentation-only; fall back to the static summary.
  }

  return [
    {
      descriptor: {
        name: 'notion.create_page',
        description: `${goal} Destructive action (create_notion_page): caller approval required per plugin policy.`,
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Page title' },
            parentUrl: { type: 'string', format: 'uri', description: 'Parent page/workspace URL (default: workspace root)' },
            paragraphs: { type: 'array', items: { type: 'string' }, description: 'Body paragraphs' },
            todoItems: { type: 'array', items: { type: 'string' }, description: 'To-do checklist items' },
            requestedAction: { type: 'string', enum: ['create_notion_page'] },
          },
          required: ['title'],
          additionalProperties: false,
        },
      },
      allowedDomains: manifest.policy_profile.allowed_domains,
      blockedActions: manifest.policy_profile.blocked_actions,
      actions: ['create_notion_page'],
      handler: createPageHandler,
    },
  ];
}

export function loadNotionSiteTools(): SiteTool[] {
  return createNotionSiteTools(loadPluginManifest('notion'));
}
