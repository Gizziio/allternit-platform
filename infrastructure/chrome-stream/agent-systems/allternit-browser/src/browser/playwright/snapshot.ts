/**
 * Playwright Snapshot (AI and Role formats)
 * Ported from OpenClaw dist/browser/pw-role-snapshot.js and pw-ai.js
 */

import { connectViaCDP } from './launcher.js';

export interface SnapshotAiOptions {
  cdpUrl: string;
  targetId: string;
  maxChars?: number;
}

export interface SnapshotResult {
  snapshot: string;
  refs: Record<string, string>;
}

export interface SemanticSnapshotNode {
  role: string;
  name: string;
  selector: string;
  depth: number;
  interactive: boolean;
  disabled?: boolean;
}

export async function snapshotAiViaPlaywright(options: SnapshotAiOptions): Promise<SnapshotResult> {
  const { browser, context } = await connectViaCDP(options.cdpUrl);
  
  try {
    const page = context.pages()[0];
    if (!page) throw new Error('Page not found');
    
    // Try Playwright's _snapshotForAI if available (undocumented API)
    const pwPage = page as any;
    if (typeof pwPage._snapshotForAI === 'function') {
      const result = await pwPage._snapshotForAI({ maxChars: options.maxChars });
      return {
        snapshot: result.snapshot,
        refs: result.refs || {},
      };
    }
    
    // Fallback: Build our own AI snapshot
    return buildAISnapshot(page, options.maxChars);
  } finally {
    await browser.close();
  }
}

export interface SnapshotRoleOptions {
  cdpUrl: string;
  targetId: string;
  selector?: string;
  frameSelector?: string;
  refsMode?: 'aria' | 'role';
  options?: {
    interactive?: boolean;
    compact?: boolean;
    maxDepth?: number;
  };
}

export async function snapshotRoleViaPlaywright(options: SnapshotRoleOptions): Promise<SnapshotResult> {
  const { browser, context } = await connectViaCDP(options.cdpUrl);
  
  try {
    const page = context.pages()[0];
    if (!page) throw new Error('Page not found');
    
    const nodes = await collectSemanticNodes(page, options.selector);
    return formatSemanticNodes(nodes, {
      interactive: options.options?.interactive,
      compact: options.options?.compact,
      maxDepth: options.options?.maxDepth,
      includeRefs: options.refsMode !== 'aria',
    });
  } finally {
    await browser.close();
  }
}

export async function snapshotAriaViaPlaywright(options: {
  cdpUrl: string;
  targetId: string;
  limit?: number;
}): Promise<{ snapshot: string }> {
  const { browser, context } = await connectViaCDP(options.cdpUrl);
  
  try {
    const page = context.pages()[0];
    if (!page) throw new Error('Page not found');
    
    const nodes = await collectSemanticNodes(page);
    const result = formatSemanticNodes(nodes.slice(0, options.limit || 10000), {
      includeRefs: false,
    });
    return { snapshot: result.snapshot };
  } finally {
    await browser.close();
  }
}

async function buildAISnapshot(page: any, maxChars?: number): Promise<SnapshotResult> {
  // Build a simplified AI-friendly snapshot
  const content = await page.content();
  
  // Extract text content with structure
      const textContent = await page.evaluate(() => {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_ELEMENT
        );    
    const elements: string[] = [];
    let node: Node | null;
    
    while ((node = walker.nextNode())) {
      const el = node as Element;
      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      const text = el.textContent?.trim();
      
      if (text && text.length > 0) {
        elements.push(`[${role}] ${text.substring(0, 100)}`);
      }
    }
    
    return elements.join('\n');
  });
  
  const snapshot = maxChars ? textContent.substring(0, maxChars) : textContent;
  
  return {
    snapshot,
    refs: {},
  };
}

export function formatSemanticNodes(
  nodes: SemanticSnapshotNode[],
  options: {
    interactive?: boolean;
    compact?: boolean;
    maxDepth?: number;
    includeRefs?: boolean;
  } = {},
): SnapshotResult {
  const refs: Record<string, string> = {};
  const lines: string[] = [];
  const maxDepth = options.maxDepth ?? 10;

  for (const node of nodes) {
    if (node.depth > maxDepth || (options.interactive && !node.interactive)) continue;
    const selector = node.selector.trim();
    const ref = `e${lines.length + 1}`;
    const indent = options.compact ? '' : '  '.repeat(node.depth);
    const state = node.disabled ? ' disabled' : '';
    const refText = options.includeRefs === false || !selector ? '' : ` [ref=${ref}]`;
    lines.push(`${indent}[${node.role}]${node.name ? ` ${node.name}` : ''}${state}${refText}`);
    if (options.includeRefs !== false && selector) refs[ref] = selector;
  }

  return { snapshot: lines.join('\n'), refs };
}

async function collectSemanticNodes(page: any, rootSelector?: string): Promise<SemanticSnapshotNode[]> {
  return page.evaluate((selector: string | undefined) => {
    const root = selector ? document.querySelector(selector) : document.documentElement;
    if (!root) throw new Error(`Snapshot root not found: ${selector}`);

    const interactiveTags = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);
    const interactiveRoles = new Set([
      'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
      'menuitem', 'tab', 'treeitem', 'slider', 'spinbutton', 'switch',
    ]);
    const roleByTag: Record<string, string> = {
      A: 'link', BUTTON: 'button', INPUT: 'textbox', SELECT: 'combobox',
      TEXTAREA: 'textbox', IMG: 'img', NAV: 'navigation', MAIN: 'main',
      ASIDE: 'complementary', HEADER: 'banner', FOOTER: 'contentinfo',
      H1: 'heading', H2: 'heading', H3: 'heading', LI: 'listitem', UL: 'list', OL: 'list',
    };

    const cssEscape = (value: string): string => {
      const escape = (globalThis as typeof globalThis & { CSS?: { escape?: (text: string) => string } }).CSS?.escape;
      return escape ? escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    };
    const elementSelector = (element: Element): string => {
      if (element === document.documentElement) return 'html';
      if (element === document.body) return 'body';
      if (element.id) return `#${cssEscape(element.id)}`;
      const testId = element.getAttribute('data-testid');
      if (testId) return `[data-testid="${testId.replace(/"/g, '\\"')}"]`;
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && current !== document.documentElement) {
        let part = current.tagName.toLowerCase();
        const parent: Element | null = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current!.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        current = parent;
        if (parts.length >= 6) break;
      }
      return parts.join(' > ') || element.tagName.toLowerCase();
    };
    const accessibleName = (element: Element): string => {
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        const label = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
        if (label) return label;
      }
      return (
        element.getAttribute('aria-label') ||
        element.getAttribute('alt') ||
        element.getAttribute('title') ||
        element.getAttribute('placeholder') ||
        (element as HTMLInputElement).value ||
        element.textContent ||
        ''
      ).replace(/\s+/g, ' ').trim().slice(0, 200);
    };

    const output: SemanticSnapshotNode[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let current: Node | null = root;
    while (current && output.length < 2000) {
      const element = current as Element;
      const style = window.getComputedStyle(element);
      if (style.display !== 'none' && style.visibility !== 'hidden' && element.getAttribute('aria-hidden') !== 'true') {
        let role = element.getAttribute('role') || roleByTag[element.tagName] || '';
        const input = element as HTMLInputElement;
        if (element.tagName === 'INPUT') {
          if (input.type === 'checkbox') role = 'checkbox';
          else if (input.type === 'radio') role = 'radio';
          else if (input.type === 'range') role = 'slider';
          else if (input.type === 'button' || input.type === 'submit' || input.type === 'reset') role = 'button';
        }
        const interactive = interactiveTags.has(element.tagName) || interactiveRoles.has(role) || element.hasAttribute('tabindex');
        const name = accessibleName(element);
        if (role || interactive || name) {
          let depth = 0;
          let parent = element.parentElement;
          while (parent && parent !== root) { depth += 1; parent = parent.parentElement; }
          output.push({
            role: role || 'generic',
            name,
            selector: elementSelector(element),
            depth,
            interactive,
            disabled: (element as HTMLButtonElement).disabled || element.getAttribute('aria-disabled') === 'true',
          });
        }
      }
      current = walker.nextNode();
    }
    return output;
  }, rootSelector);
}
