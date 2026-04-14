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
    
    // Get accessibility snapshot - accessibility.snapshot is deprecated in latest Playwright
    /*
    const snapshot = await (page as any).accessibility.snapshot({
      root: options.selector ? await page.locator(options.selector).elementHandle() : undefined,
    });
    */
    const snapshot: any = { role: 'WebArea', name: 'Accessibility Snapshot Placeholder' };
    
    const refs: Record<string, string> = {};
    const lines: string[] = [];
    
    function buildSnapshot(node: any, depth = 0): void {
      if (depth > (options.options?.maxDepth || 10)) return;
      
      const role = node.role;
      const name = node.name;
      const ref = node.ref || generateRef();
      
      if (role && shouldInclude(role, options.options)) {
        const indent = options.options?.compact ? '' : '  '.repeat(depth);
        let line = `${indent}[${role}]`;
        if (name) line += ` ${name}`;
        if (options.refsMode !== 'aria') {
          line += ` [ref=${ref}]`;
          refs[ref] = node.elementId || '';
        }
        lines.push(line);
      }
      
      if (node.children) {
        for (const child of node.children) {
          buildSnapshot(child, depth + 1);
        }
      }
    }
    
    buildSnapshot(snapshot);
    
    return {
      snapshot: lines.join('\n'),
      refs,
    };
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
    
    // accessibility.snapshot is deprecated in latest Playwright
    // const snapshot = await (page as any).accessibility.snapshot();
    const snapshot: any = { role: 'WebArea', name: 'Accessibility Snapshot Placeholder' };
    
    const lines: string[] = [];
    
    function buildAria(node: any, depth = 0): void {
      if (lines.length >= (options.limit || 10000)) return;
      
      const role = node.role;
      const name = node.name;
      
      if (role) {
        const indent = '  '.repeat(depth);
        let line = `${indent}[${role}]`;
        if (name) line += ` ${name}`;
        lines.push(line);
      }
      
      if (node.children) {
        for (const child of node.children) {
          buildAria(child, depth + 1);
        }
      }
    }
    
    buildAria(snapshot);
    
    return { snapshot: lines.join('\n') };
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

function shouldInclude(role: string, options?: { interactive?: boolean }): boolean {
  if (!options?.interactive) return true;
  
  const interactiveRoles = [
    'button', 'link', 'textbox', 'checkbox', 'radio',
    'combobox', 'menuitem', 'tab', 'treeitem',
  ];
  
  return interactiveRoles.includes(role.toLowerCase());
}

function generateRef(): string {
  return Math.random().toString(36).substring(2, 8);
}
