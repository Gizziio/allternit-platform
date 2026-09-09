import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SitePluginManifest } from '@allternit/computer-use-protocol';
import {
  clickViaPlaywright,
  navigateViaPlaywright,
  typeViaPlaywright,
  waitForViaPlaywright,
  evaluateViaPlaywright,
} from '../../playwright/actions.js';
import { refused, type SiteTool, type SiteToolContext, type SiteToolResult } from '../registry.js';
import { loadPluginManifest, readCookbookSection, resolvePluginDir } from './common.js';

/**
 * GitHub site tools, derived from domains/computer-use/core/plugins/github:
 *  - cookbook review-pr.md   → github.review_pr
 *  - cookbook triage-issue.md → github.triage_issue
 * Handlers drive the existing actions.ts primitives only; selectors come from
 * the plugin cookbooks. Extraction uses evaluateViaPlaywright (actions.ts has
 * no dedicated `extract` primitive — evaluate is the sanctioned escape hatch).
 */

function requireString(args: Record<string, unknown>, field: string): string {
  const value = args[field];
  if (typeof value !== 'string' || !value) throw new Error(`github tool requires args.${field}`);
  return value;
}

interface GitHubBinding {
  cdpUrl: string;
  targetId: string;
}

const GITHUB_COM = 'github.com';

async function extractText(binding: GitHubBinding, selector: string, limit = 10): Promise<string[]> {
  const fn = `(() => {
    const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
    return nodes.slice(0, ${limit}).map((node) => (node.innerText || node.textContent || '').trim());
  })()`;
  const result = await evaluateViaPlaywright({ ...binding, fn });
  return Array.isArray(result) ? result.map(String) : [];
}

async function reviewPrHandler(args: Record<string, unknown>, ctx: SiteToolContext): Promise<SiteToolResult> {
  const prUrl = requireString(args, 'prUrl');
  const reviewText = requireString(args, 'reviewText');
  const requested = typeof args.requestedAction === 'string' ? args.requestedAction : 'post_review_comment';
  if (requested !== 'post_review_comment') {
    return refused(`github.review_pr does not perform action '${requested}'`);
  }
  const plan = [
    `navigate ${prUrl}`,
    'extract PR metadata (title, author, files changed)',
    'open Files Changed tab and extract diff summary',
    'focus textarea#pull_request_review_body and type the review text',
    "select review type COMMENT and submit the form",
  ];
  if (ctx.dryRun) {
    return { ok: true, summary: `dry-run: would post a review comment on ${prUrl}`, data: { steps: plan } };
  }

  const binding = { cdpUrl: ctx.cdpUrl, targetId: ctx.targetId };
  await navigateViaPlaywright({ ...binding, url: prUrl });
  await waitForViaPlaywright({ ...binding, selector: 'span.js-issue-title', timeoutMs: 15_000 });

  const [prTitle] = await extractText(binding, 'span.js-issue-title', 1);
  await clickViaPlaywright({ ...binding, ref: '', selector: "a[data-tab-item='files-tab']" });
  await waitForViaPlaywright({ ...binding, selector: 'div.js-diff-progressive-container', timeoutMs: 15_000 });
  const changedFiles = await extractText(binding, 'div#files_bucket .file-header[data-path]', 50);

  await clickViaPlaywright({ ...binding, ref: '', selector: "button[data-hotkey='p']" });
  await waitForViaPlaywright({ ...binding, selector: 'div.pull-request-review-menu', timeoutMs: 10_000 });
  await clickViaPlaywright({ ...binding, ref: '', selector: 'textarea#pull_request_review_body' });
  await typeViaPlaywright({ ...binding, ref: '', selector: 'textarea#pull_request_review_body', text: reviewText });
  await clickViaPlaywright({ ...binding, ref: '', selector: "input[value='COMMENT']" });
  await clickViaPlaywright({ ...binding, ref: '', selector: "button.btn-primary[type='submit']" });
  await waitForViaPlaywright({ ...binding, timeMs: 1_000 });

  return {
    ok: true,
    summary: `Review comment posted on ${prUrl}`,
    data: { prUrl, prTitle, changedFiles: changedFiles.length, requestedAction: 'post_review_comment' },
  };
}

async function triageIssueHandler(args: Record<string, unknown>, ctx: SiteToolContext): Promise<SiteToolResult> {
  const issueUrl = requireString(args, 'issueUrl');
  const comment = requireString(args, 'comment');
  const label = typeof args.label === 'string' && args.label ? args.label : undefined;
  const requested = typeof args.requestedAction === 'string' ? args.requestedAction : undefined;
  if (requested && requested !== 'apply_label' && requested !== 'post_triage_comment') {
    return refused(`github.triage_issue does not perform action '${requested}'`);
  }
  const plan = [
    `navigate ${issueUrl}`,
    'extract issue title, body, labels, reporter',
    label ? `apply label '${label}' via the label picker` : 'no label requested',
    'type triage comment into textarea#new_comment_field and submit',
  ];
  if (ctx.dryRun) {
    return { ok: true, summary: `dry-run: would triage ${issueUrl}`, data: { steps: plan } };
  }

  const binding = { cdpUrl: ctx.cdpUrl, targetId: ctx.targetId };
  await navigateViaPlaywright({ ...binding, url: issueUrl });
  await waitForViaPlaywright({ ...binding, selector: 'h1.gh-header-title', timeoutMs: 15_000 });

  const [issueTitle] = await extractText(binding, 'h1.gh-header-title span.js-issue-title', 1);

  if (label && requested !== 'post_triage_comment') {
    await clickViaPlaywright({ ...binding, ref: '', selector: "details-menu[src*='/labels'] summary" });
    await waitForViaPlaywright({ ...binding, selector: "details-menu[src*='/labels'] .select-menu-item", timeoutMs: 10_000 });
    await clickViaPlaywright({
      ...binding,
      ref: '',
      selector: `div[role='menuitem']:has(span:text-is("${label}"))`,
    });
  }

  await clickViaPlaywright({ ...binding, ref: '', selector: 'textarea#new_comment_field' });
  await typeViaPlaywright({ ...binding, ref: '', selector: 'textarea#new_comment_field', text: comment });
  await clickViaPlaywright({ ...binding, ref: '', selector: "button.btn-primary[type='submit']" });
  await waitForViaPlaywright({ ...binding, timeMs: 1_000 });

  return {
    ok: true,
    summary: `Issue triaged: ${issueUrl}`,
    data: { issueUrl, issueTitle, label: label ?? null },
  };
}

export function createGitHubSiteTools(manifest: SitePluginManifest): SiteTool[] {
  if (manifest.id !== 'github') throw new Error(`Expected the github plugin manifest, got '${manifest.id}'`);
  let reviewGoal = 'Open a GitHub pull request and post a structured review comment.';
  let triageGoal = 'Read a GitHub issue, apply a label, and post a triage comment.';
  try {
    const reviewMd = readFileSync(join(resolvePluginDir('github'), 'cookbooks', 'review-pr.md'), 'utf8');
    const triageMd = readFileSync(join(resolvePluginDir('github'), 'cookbooks', 'triage-issue.md'), 'utf8');
    reviewGoal = readCookbookSection(reviewMd, 'Goal') || reviewGoal;
    triageGoal = readCookbookSection(triageMd, 'Goal') || triageGoal;
  } catch {
    // Cookbooks are documentation-only; fall back to the static summaries.
  }

  return [
    {
      descriptor: {
        name: 'github.review_pr',
        description: `${reviewGoal} Destructive action (post_review_comment): caller approval required per plugin policy.`,
        inputSchema: {
          type: 'object',
          properties: {
            prUrl: { type: 'string', format: 'uri', description: 'URL of the pull request to review' },
            reviewText: { type: 'string', description: 'Review comment to post (max 2000 chars)' },
            requestedAction: { type: 'string', enum: ['post_review_comment'] },
          },
          required: ['prUrl', 'reviewText'],
          additionalProperties: false,
        },
      },
      allowedDomains: manifest.policy_profile.allowed_domains,
      blockedActions: manifest.policy_profile.blocked_actions,
      actions: ['post_review_comment'],
      handler: reviewPrHandler,
    },
    {
      descriptor: {
        name: 'github.triage_issue',
        description: `${triageGoal} Destructive actions (apply_label, post_triage_comment): caller approval required per plugin policy.`,
        inputSchema: {
          type: 'object',
          properties: {
            issueUrl: { type: 'string', format: 'uri', description: 'URL of the issue to triage' },
            label: { type: 'string', description: 'Label to apply (must exist on the repository)' },
            comment: { type: 'string', description: 'Triage comment to post (max 500 chars)' },
            requestedAction: { type: 'string', enum: ['apply_label', 'post_triage_comment'] },
          },
          required: ['issueUrl', 'comment'],
          additionalProperties: false,
        },
      },
      allowedDomains: manifest.policy_profile.allowed_domains,
      blockedActions: manifest.policy_profile.blocked_actions,
      actions: ['apply_label', 'post_triage_comment'],
      handler: triageIssueHandler,
    },
  ];
}

export function loadGitHubSiteTools(): SiteTool[] {
  return createGitHubSiteTools(loadPluginManifest('github'));
}
