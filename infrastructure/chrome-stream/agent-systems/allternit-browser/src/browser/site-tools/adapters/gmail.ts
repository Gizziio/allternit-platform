import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SitePluginManifest } from '@allternit/computer-use-protocol';
import {
  clickViaPlaywright,
  navigateViaPlaywright,
  waitForViaPlaywright,
  evaluateViaPlaywright,
} from '../../playwright/actions.js';
import type { SiteTool, SiteToolContext, SiteToolResult } from '../registry.js';
import { loadPluginManifest, readCookbookSection, resolvePluginDir } from './common.js';

/**
 * Gmail site tools, derived from domains/computer-use/core/plugins/gmail:
 *  - cookbook read-inbox.md → gmail.read_inbox (inspect mode; reads only,
 *    never sends or deletes — those actions are not exposed as tools).
 */

interface GmailBinding {
  cdpUrl: string;
  targetId: string;
}

const INBOX_URL = 'https://mail.google.com/mail/u/0/#inbox';

const EXTRACT_UNREAD_FN = `(() => {
  const rows = Array.from(document.querySelectorAll("tr.zA.zE"));
  return rows.slice(0, 5).map((row) => ({
    sender: (row.querySelector('span.zF') || {}).textContent || '',
    subject: (row.querySelector('span.bog') || {}).textContent || '',
    snippet: (row.querySelector('span.y2') || {}).textContent || '',
    time: ((row.querySelector('span.xW span') || {}).textContent || '').trim(),
  }));
})()`;

async function readInboxHandler(args: Record<string, unknown>, ctx: SiteToolContext): Promise<SiteToolResult> {
  const requested = typeof args.requestedAction === 'string' ? args.requestedAction : 'read_inbox';
  if (requested !== 'read_inbox') {
    return { ok: false, refused: true, reason: `gmail.read_inbox does not perform action '${requested}'`, summary: `Refused: unknown action '${requested}'` };
  }
  const maxMessages = typeof args.maxMessages === 'number' && args.maxMessages > 0
    ? Math.min(Math.floor(args.maxMessages), 10)
    : 5;
  const plan = [
    `navigate ${INBOX_URL}`,
    'wait for div[role=main]',
    `extract up to ${maxMessages} unread rows (tr.zA.zE): sender, subject, snippet, time`,
  ];
  if (ctx.dryRun) {
    return { ok: true, summary: 'dry-run: would read the Gmail inbox (inspect mode, no destructive actions)', data: { steps: plan } };
  }

  const binding = { cdpUrl: ctx.cdpUrl, targetId: ctx.targetId };
  await navigateViaPlaywright({ ...binding, url: INBOX_URL });
  await waitForViaPlaywright({ ...binding, selector: "div[role='main']", timeoutMs: 15_000 });

  const extracted = await evaluateViaPlaywright({ ...binding, fn: EXTRACT_UNREAD_FN });
  const messages = (Array.isArray(extracted) ? extracted : []).slice(0, maxMessages);

  // Non-destructive walk through up to maxMessages threads to capture bodies,
  // per cookbook read-inbox.md steps 4b-4d.
  const bodies: Array<string | null> = [];
  for (let index = 0; index < messages.length; index += 1) {
    try {
      await clickViaPlaywright({ ...binding, ref: '', selector: `tr.zA.zE >> nth=${index}` });
      await waitForViaPlaywright({ ...binding, selector: 'div.a3s.aiL', timeoutMs: 10_000 });
      const bodyFn = `(() => { const node = document.querySelector('div.a3s.aiL'); return node ? (node.innerText || '').slice(0, 1500) : null; })()`;
      const body = await evaluateViaPlaywright({ ...binding, fn: bodyFn });
      bodies.push(typeof body === 'string' ? body : null);
    } catch {
      bodies.push(null);
    }
    try {
      await clickViaPlaywright({ ...binding, ref: '', selector: "div[aria-label='Back to Inbox'], a[href='#inbox']" });
      await waitForViaPlaywright({ ...binding, selector: "div[role='main']", timeoutMs: 10_000 });
    } catch {
      await navigateViaPlaywright({ ...binding, url: INBOX_URL });
    }
  }

  const snippets = messages.map((message: Record<string, string>, index: number) => ({
    sender: message.sender ?? '',
    subject: message.subject ?? '',
    time: message.time ?? '',
    snippet: message.snippet ?? '',
    fullBody: bodies[index],
  }));
  return {
    ok: true,
    summary: `Read ${snippets.length} unread message(s) from the Gmail inbox`,
    data: { unreadCountVisible: snippets.length, messages: snippets },
  };
}

export function createGmailSiteTools(manifest: SitePluginManifest): SiteTool[] {
  if (manifest.id !== 'gmail') throw new Error(`Expected the gmail plugin manifest, got '${manifest.id}'`);
  let goal = 'Open Gmail, identify unread messages, and extract sender, subject, and body preview.';
  try {
    const md = readFileSync(join(resolvePluginDir('gmail'), 'cookbooks', 'read-inbox.md'), 'utf8');
    goal = readCookbookSection(md, 'Goal') || goal;
  } catch {
    // Cookbooks are documentation-only; fall back to the static summary.
  }

  return [
    {
      descriptor: {
        name: 'gmail.read_inbox',
        description: `${goal} Inspect mode: reads only; sending, deleting, and label changes are never performed.`,
        inputSchema: {
          type: 'object',
          properties: {
            maxMessages: { type: 'number', description: 'Unread messages to read (default 5, max 10)' },
            requestedAction: { type: 'string', enum: ['read_inbox'] },
          },
          required: [],
          additionalProperties: false,
        },
      },
      allowedDomains: manifest.policy_profile.allowed_domains,
      blockedActions: manifest.policy_profile.blocked_actions,
      actions: ['read_inbox'],
      handler: readInboxHandler,
    },
  ];
}

export function loadGmailSiteTools(): SiteTool[] {
  return createGmailSiteTools(loadPluginManifest('gmail'));
}
