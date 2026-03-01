/**
 * Page Snapshot (AI and ARIA formats)
 * Ported from OpenClaw dist/browser/routes/agent.snapshot.js
 */

import { CDPClient } from './client.js';

export interface AriaSnapshotOptions {
  wsUrl: string;
  limit?: number;
}

export interface AriaSnapshotResult {
  snapshot: string;
}

export async function snapshotAria(options: AriaSnapshotOptions): Promise<AriaSnapshotResult> {
  const { wsUrl, limit = 10000 } = options;
  
  const client = await CDPClient.connect(wsUrl);
  
  try {
    await client.send('Accessibility.enable');
    
    // Get the full accessibility tree
    const { nodes } = await client.send('Accessibility.getFullAXTree');
    
    // Build ARIA snapshot
    const lines: string[] = [];
    
    function buildSnapshot(node: any, depth = 0): void {
      if (lines.length >= limit) return;
      
      const indent = '  '.repeat(depth);
      const role = node.role?.value || '';
      const name = node.name?.value || '';
      
      if (role) {
        let line = `${indent}[${role}]`;
        if (name) line += ` ${name}`;
        lines.push(line);
      }
      
      if (node.children) {
        for (const child of node.children) {
          buildSnapshot(child, depth + 1);
          if (lines.length >= limit) break;
        }
      }
    }
    
    // Find root node
    const rootNode = nodes.find((n: any) => n.role?.value === 'WebArea');
    if (rootNode) {
      buildSnapshot(rootNode);
    }
    
    return { snapshot: lines.join('\n') };
  } finally {
    client.close();
  }
}

// ============================================================================
// AI Snapshot (Playwright-based)
// ============================================================================

export interface AISnapshotOptions {
  cdpUrl: string;
  targetId: string;
  maxChars?: number;
}

export interface AISnapshotResult {
  snapshot: string;
  refs: Record<string, string>;
}

export async function snapshotAi(options: AISnapshotOptions): Promise<AISnapshotResult> {
  // This uses Playwright's _snapshotForAI if available
  // Fallback to ARIA snapshot with enhanced formatting
  const { snapshotAiViaPlaywright } = await import('../playwright/snapshot.js');
  return snapshotAiViaPlaywright(options);
}

export interface RoleSnapshotOptions extends AISnapshotOptions {
  selector?: string;
  frameSelector?: string;
  refsMode?: 'aria' | 'role';
  options?: {
    interactive?: boolean;
    compact?: boolean;
    maxDepth?: number;
  };
}

export async function snapshotRole(options: RoleSnapshotOptions): Promise<AISnapshotResult> {
  const { snapshotRoleViaPlaywright } = await import('../playwright/snapshot.js');
  return snapshotRoleViaPlaywright(options);
}
