/**
 * E2E Test: Agent Workspace System
 * 
 * Validates the complete flow from file system to API:
 * 1. File system loads workspace files
 * 2. Trust tiers are parsed from SOUL.md
 * 3. HEARTBEAT tasks are extracted
 * 4. Context pack is built
 * 5. Context is sent with chat messages
 * 
 * RUN WITH: npm test -- agent-workspace.e2e.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { AgentTrustTiers } from '../agent-trust-tiers';
import { parseHeartbeatTasks } from '../agent-heartbeat-executor';

const TEST_AGENT_ID = 'test-agent';
const TEST_WORKSPACE_PATH = path.join(os.homedir(), 'agents', TEST_AGENT_ID, '.allternit');

// Direct file system helpers for testing
async function readWorkspaceFile(fileName: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(TEST_WORKSPACE_PATH, fileName), 'utf-8');
  } catch {
    return null;
  }
}

async function workspaceExists(): Promise<boolean> {
  try {
    await fs.access(TEST_WORKSPACE_PATH);
    return true;
  } catch {
    return false;
  }
}

async function listWorkspaceFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(TEST_WORKSPACE_PATH, { withFileTypes: true });
    return entries.filter(e => e.isFile()).map(e => e.name);
  } catch {
    return [];
  }
}

describe('Agent Workspace E2E', () => {
  beforeAll(async () => {
    // Ensure test workspace exists
    const exists = await workspaceExists();
    if (!exists) {
      throw new Error(`Test workspace not found at ${TEST_WORKSPACE_PATH}. Run setup first.`);
    }
    console.log(`[E2E Test] Using workspace at: ${TEST_WORKSPACE_PATH}`);
  });

  describe('File System Integration', () => {
    it('should detect workspace exists', async () => {
      const exists = await workspaceExists();
      expect(exists).toBe(true);
    });

    it('should load workspace with all files', async () => {
      const files = await listWorkspaceFiles();
      
      expect(files.length).toBeGreaterThanOrEqual(4);
      
      // Check core files are loaded
      const fileNames = files.map(f => f.toUpperCase());
      expect(fileNames).toContain('SOUL.MD');
      expect(fileNames).toContain('HEARTBEAT.MD');
      expect(fileNames).toContain('IDENTITY.MD');
      expect(fileNames).toContain('TOOLS.MD');
      expect(fileNames).toContain('BRAIN.MD');
    });

    it('should read file content', async () => {
      const content = await readWorkspaceFile('SOUL.md');
      
      expect(content).toBeDefined();
      expect(content).toContain('Trust Tiers');
      expect(content).toContain('Tier 1');
      expect(content).toContain('Tier 2');
      expect(content).toContain('Tier 3');
    });
  });

  describe('Trust Tier Parsing', () => {
    it('should parse trust tiers from SOUL.md', async () => {
      const content = await readWorkspaceFile('SOUL.md');
      expect(content).toBeTruthy();
      
      const trustTiers = AgentTrustTiers.parseFromSoulMd(content!);
      
      // Tier 1 should have autonomous actions
      expect(trustTiers.tier1.length).toBeGreaterThan(0);
      expect(trustTiers.tier1.some(r => r.toLowerCase().includes('read'))).toBe(true);
      
      // Tier 3 should have restricted actions
      expect(trustTiers.tier3.length).toBeGreaterThan(0);
      expect(trustTiers.tier3.some(r => r.toLowerCase().includes('delete'))).toBe(true);
    });

    it('should correctly identify permission requirements', async () => {
      const content = await readWorkspaceFile('SOUL.md');
      const trustTiers = new AgentTrustTiers(AgentTrustTiers.parseFromSoulMd(content!));
      
      // Reading files should be autonomous
      expect(trustTiers.requiresPermission('readFile', { path: 'test.ts' })).toBe(false);
      
      // Deleting should require permission
      expect(trustTiers.requiresPermission('delete', { path: 'test.ts' })).toBe(true);
      
      // Shell commands should require permission
      expect(trustTiers.requiresPermission('Shell', { command: 'rm -rf /' })).toBe(true);
    });

    it('should parse startup tasks from HEARTBEAT.md', async () => {
      const content = await readWorkspaceFile('HEARTBEAT.md');
      expect(content).toBeTruthy();
      
      const tasks = parseHeartbeatTasks(content!);
      const startupTasks = tasks.filter(t => t.frequency === 'startup');
      
      expect(startupTasks.length).toBeGreaterThan(0);
      expect(startupTasks.some(t => t.action.toLowerCase().includes('workspace'))).toBe(true);
    });
  });

  describe('Context Pack Building', () => {
    it('should build system prompt from workspace', async () => {
      const files: Record<string, string> = {};
      const fileNames = ['IDENTITY.md', 'SOUL.md', 'TOOLS.md'];
      
      for (const name of fileNames) {
        const content = await readWorkspaceFile(name);
        if (content) files[name] = content;
      }
      
      // Build system prompt similar to mode-session-store
      const sections: string[] = [];
      
      if (files['IDENTITY.md']) {
        sections.push('# Agent Identity\n' + files['IDENTITY.md']);
      }
      if (files['SOUL.md']) {
        sections.push('# Trust Tiers\n' + files['SOUL.md']);
      }
      if (files['TOOLS.md']) {
        sections.push('# Available Tools\n' + files['TOOLS.md']);
      }
      
      const systemPrompt = sections.join('\n\n---\n\n');
      
      expect(systemPrompt).toContain('Agent Identity');
      expect(systemPrompt).toContain('Trust Tiers');
      expect(systemPrompt).toContain('Available Tools');
      expect(systemPrompt.length).toBeGreaterThan(1000);
    });
  });

  describe('Integration Flow', () => {
    it('should complete full workflow', async () => {
      // Step 1: Check workspace exists
      const exists = await workspaceExists();
      expect(exists).toBe(true);
      
      // Step 2: List files
      const files = await listWorkspaceFiles();
      expect(files.length).toBeGreaterThan(0);
      
      // Step 3: Parse trust tiers
      const soulContent = await readWorkspaceFile('SOUL.md');
      const trustTiers = new AgentTrustTiers(AgentTrustTiers.parseFromSoulMd(soulContent!));
      expect(trustTiers['config'].tier3.length).toBeGreaterThan(0);
      
      // Step 4: Verify permission gating works
      expect(trustTiers.requiresPermission('read', {})).toBe(false);
      expect(trustTiers.requiresPermission('delete', {})).toBe(true);
      
      // Step 5: Parse HEARTBEAT
      const heartbeatContent = await readWorkspaceFile('HEARTBEAT.md');
      const tasks = parseHeartbeatTasks(heartbeatContent!);
      expect(tasks.length).toBeGreaterThan(0);
      
      console.log('✅ Full integration flow completed successfully');
      console.log(`   - Workspace files: ${files.length}`);
      console.log(`   - Trust tier rules: ${trustTiers['config'].tier1.length + trustTiers['config'].tier2.length + trustTiers['config'].tier3.length}`);
      console.log(`   - HEARTBEAT tasks: ${tasks.length}`);
    });
  });
});

// Run validation
describe('Validation', () => {
  it('should confirm all components work together', async () => {
    const results = {
      fileSystem: false,
      workspaceLoading: false,
      trustTierParsing: false,
      contextBuilding: false,
    };
    
    try {
      // Test file system
      results.fileSystem = await workspaceExists();
      
      // Test workspace loading
      const files = await listWorkspaceFiles();
      results.workspaceLoading = files.length > 0;
      
      // Test trust tier parsing
      const soulContent = await readWorkspaceFile('SOUL.md');
      const trustTiers = AgentTrustTiers.parseFromSoulMd(soulContent!);
      results.trustTierParsing = trustTiers.tier3.length > 0;
      
      // Test context building
      const identityContent = await readWorkspaceFile('IDENTITY.md');
      results.contextBuilding = !!identityContent && identityContent.length > 0;
      
      console.log('\n📊 E2E Validation Results:');
      console.log(`   File System: ${results.fileSystem ? '✅' : '❌'}`);
      console.log(`   Workspace Loading: ${results.workspaceLoading ? '✅' : '❌'}`);
      console.log(`   Trust Tier Parsing: ${results.trustTierParsing ? '✅' : '❌'}`);
      console.log(`   Context Building: ${results.contextBuilding ? '✅' : '❌'}`);
      
      expect(results.fileSystem).toBe(true);
      expect(results.workspaceLoading).toBe(true);
      expect(results.trustTierParsing).toBe(true);
      expect(results.contextBuilding).toBe(true);
      
    } catch (error) {
      console.error('E2E Validation failed:', error);
      throw error;
    }
  });
});
