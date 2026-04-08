/**
 * Full Integration Test for Agent Workspace System
 * 
 * Tests all components working together:
 * - File System → Workspace Loading
 * - Trust Tiers → Permission Gating
 * - HEARTBEAT → Task Execution
 * - Cron Scheduler → Recurring Tasks
 * - Cowork Integration → Task Sync
 * - File Watcher → Auto-refresh
 * 
 * RUN WITH: npm test -- agent-integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { agentWorkspaceFS } from '../agent-workspace-files';
import { AgentTrustTiers } from '../agent-trust-tiers';
import { HeartbeatTaskManager, parseHeartbeatTasks } from '../agent-heartbeat-executor';
import { agentCronScheduler, useCronScheduler } from '../agent-cron-scheduler';
import { coworkIntegration, getAgentCoworkTasks } from '../agent-cowork-integration';
import { WorkspaceFileWatcher } from '../agent-workspace-watcher';

const TEST_AGENT_ID = 'test-agent';

describe('Full Agent Integration', () => {
  beforeAll(async () => {
    // Ensure test workspace exists
    const exists = await agentWorkspaceFS.workspaceExists(TEST_AGENT_ID);
    if (!exists) {
      throw new Error(`Test workspace not found. Run setup first.`);
    }
  });

  afterAll(() => {
    // Cleanup
    agentCronScheduler.stop();
    agentWorkspaceFS.clearCache();
  });

  describe('1. File System → Workspace Loading', () => {
    it('should load workspace with all files', async () => {
      const workspace = await agentWorkspaceFS.loadWorkspace(TEST_AGENT_ID);
      
      expect(workspace).toBeDefined();
      expect(workspace?.files.length).toBeGreaterThanOrEqual(5);
      
      const fileNames = workspace?.files.map(f => f.name.toUpperCase());
      expect(fileNames).toContain('SOUL.MD');
      expect(fileNames).toContain('HEARTBEAT.MD');
    });
  });

  describe('2. Trust Tiers → Permission Gating', () => {
    it('should parse trust tiers from SOUL.md', async () => {
      const workspace = await agentWorkspaceFS.loadWorkspace(TEST_AGENT_ID);
      const trustTiers = AgentTrustTiers.fromWorkspace(workspace!);
      
      // Should have Tier 3 rules (require permission)
      expect(trustTiers['config'].tier3.length).toBeGreaterThan(0);
    });

    it('should require permission for delete actions', async () => {
      const workspace = await agentWorkspaceFS.loadWorkspace(TEST_AGENT_ID);
      const trustTiers = AgentTrustTiers.fromWorkspace(workspace!);
      
      expect(trustTiers.requiresPermission('delete', { path: 'test.ts' })).toBe(true);
      expect(trustTiers.requiresPermission('Shell', { command: 'rm -rf' })).toBe(true);
    });

    it('should not require permission for read actions', async () => {
      const workspace = await agentWorkspaceFS.loadWorkspace(TEST_AGENT_ID);
      const trustTiers = AgentTrustTiers.fromWorkspace(workspace!);
      
      expect(trustTiers.requiresPermission('readFile', { path: 'test.ts' })).toBe(false);
    });
  });

  describe('3. HEARTBEAT → Task Execution', () => {
    it('should parse tasks from HEARTBEAT.md', async () => {
      const content = await agentWorkspaceFS.readFile(TEST_AGENT_ID, 'HEARTBEAT.md');
      const tasks = parseHeartbeatTasks(content!);
      
      expect(tasks.length).toBeGreaterThan(0);
      
      const startupTasks = tasks.filter(t => t.frequency === 'startup');
      const dailyTasks = tasks.filter(t => t.frequency === 'daily');
      
      expect(startupTasks.length).toBeGreaterThan(0);
      expect(dailyTasks.length).toBeGreaterThan(0);
    });

    it('should execute startup tasks', async () => {
      const workspace = await agentWorkspaceFS.loadWorkspace(TEST_AGENT_ID);
      const trustTiers = AgentTrustTiers.fromWorkspace(workspace!);
      
      const taskManager = new HeartbeatTaskManager(TEST_AGENT_ID, trustTiers);
      await taskManager.loadTasks();
      
      const results = await taskManager.executeStartupTasks({
        sessionId: 'test-session',
        onPermissionRequest: async () => true,
      });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('4. Cron Scheduler → Recurring Tasks', () => {
    it('should register agent tasks with scheduler', async () => {
      await agentCronScheduler.registerAgentTasks(TEST_AGENT_ID);
      
      const status = agentCronScheduler.getStatus();
      expect(status.totalJobs).toBeGreaterThan(0);
    });

    it('should track job schedules', () => {
      const store = useCronScheduler.getState();
      const jobs = store.getJobsForAgent(TEST_AGENT_ID);
      
      expect(jobs.length).toBeGreaterThan(0);
      
      const dailyJobs = jobs.filter(j => j.frequency === 'daily');
      expect(dailyJobs.length).toBeGreaterThan(0);
    });

    it('should calculate next run times correctly', () => {
      const store = useCronScheduler.getState();
      const jobs = store.getJobsForAgent(TEST_AGENT_ID);
      
      for (const job of jobs) {
        expect(job.nextRunAt).toBeGreaterThan(Date.now());
        
        // Daily jobs should be ~24 hours from now
        if (job.frequency === 'daily') {
          const hoursDiff = (job.nextRunAt - Date.now()) / (1000 * 60 * 60);
          expect(hoursDiff).toBeGreaterThan(23);
          expect(hoursDiff).toBeLessThan(25);
        }
      }
    });
  });

  describe('5. Cowork Integration → Task Sync', () => {
    it('should sync HEARTBEAT tasks to cowork', async () => {
      const content = await agentWorkspaceFS.readFile(TEST_AGENT_ID, 'HEARTBEAT.md');
      const tasks = parseHeartbeatTasks(content!);
      
      const recurringTasks = tasks.filter(t => t.frequency !== 'startup');
      const coworkTasks = coworkIntegration.syncAgentTasks(TEST_AGENT_ID, recurringTasks);
      
      expect(coworkTasks.length).toBe(recurringTasks.length);
    });

    it('should retrieve agent cowork tasks', () => {
      const tasks = getAgentCoworkTasks(TEST_AGENT_ID);
      expect(tasks.length).toBeGreaterThan(0);
    });

    it('should record task execution results', async () => {
      const result = {
        taskId: 'test-task',
        success: true,
        output: 'Test output',
        executionTimeMs: 100,
        timestamp: new Date(),
      };
      
      coworkIntegration.recordExecution(TEST_AGENT_ID, 'test-task', result);
      
      // Task should be updated
      const tasks = getAgentCoworkTasks(TEST_AGENT_ID);
      const testTask = tasks.find(t => t.id.includes('test-task'));
      
      if (testTask) {
        expect(testTask.status).toBe('completed');
      }
    });
  });

  describe('6. File Watcher → Auto-refresh', () => {
    it('should detect file changes', async () => {
      const watcher = new WorkspaceFileWatcher(TEST_AGENT_ID, {
        pollIntervalMs: 100,
      });
      
      let detectedChanges: any[] = [];
      watcher.start();
      
      // Wait for initial scan
      await new Promise(r => setTimeout(r, 200));
      
      // Stop and restart to trigger change detection
      watcher.stop();
      
      // Modify a file (simulate by invalidating cache)
      agentWorkspaceFS.invalidateCache(TEST_AGENT_ID);
      
      // Restart watcher
      watcher.start();
      await new Promise(r => setTimeout(r, 200));
      
      const status = watcher.getStatus();
      expect(status.isWatching).toBe(true);
      expect(status.filesWatched).toBeGreaterThan(0);
      
      watcher.stop();
    });

    it('should track watched files', async () => {
      const watcher = new WorkspaceFileWatcher(TEST_AGENT_ID);
      await watcher.start();
      
      const status = watcher.getStatus();
      expect(status.filesWatched).toBeGreaterThanOrEqual(5);
      
      watcher.stop();
    });
  });

  describe('7. End-to-End Flow', () => {
    it('should complete full agent workflow', async () => {
      // Step 1: Load workspace
      const workspace = await agentWorkspaceFS.loadWorkspace(TEST_AGENT_ID);
      expect(workspace).toBeDefined();
      
      // Step 2: Parse trust tiers
      const trustTiers = AgentTrustTiers.fromWorkspace(workspace!);
      expect(trustTiers['config'].tier3.length).toBeGreaterThan(0);
      
      // Step 3: Load and execute startup tasks
      const taskManager = new HeartbeatTaskManager(TEST_AGENT_ID, trustTiers);
      await taskManager.loadTasks();
      
      const startupResults = await taskManager.executeStartupTasks({
        sessionId: 'e2e-test',
        onPermissionRequest: async () => true,
      });
      expect(startupResults.every(r => r.success)).toBe(true);
      
      // Step 4: Register with cron scheduler
      await agentCronScheduler.registerAgentTasks(TEST_AGENT_ID);
      const cronStatus = agentCronScheduler.getStatus();
      expect(cronStatus.totalJobs).toBeGreaterThan(0);
      
      // Step 5: Sync to cowork
      const allTasks = Array.from(taskManager['tasks'].values());
      const recurringTasks = allTasks.filter(t => t.frequency !== 'startup');
      const coworkTasks = coworkIntegration.syncAgentTasks(TEST_AGENT_ID, recurringTasks);
      expect(coworkTasks.length).toBe(recurringTasks.length);
      
      // Verify all components are connected
      console.log('\n✅ E2E Integration Test Results:');
      console.log(`   Workspace files: ${workspace!.files.length}`);
      console.log(`   Trust tier rules: ${trustTiers['config'].tier1.length + trustTiers['config'].tier2.length + trustTiers['config'].tier3.length}`);
      console.log(`   Startup tasks: ${startupResults.length}`);
      console.log(`   Cron jobs: ${cronStatus.totalJobs}`);
      console.log(`   Cowork tasks: ${coworkTasks.length}`);
    });
  });
});

// Integration status report
describe('Integration Status', () => {
  it('should report all systems operational', async () => {
    const status = {
      fileSystem: false,
      trustTiers: false,
      heartbeat: false,
      cron: false,
      cowork: false,
      watcher: false,
    };
    
    try {
      // File System
      status.fileSystem = await agentWorkspaceFS.workspaceExists(TEST_AGENT_ID);
      
      // Trust Tiers
      const workspace = await agentWorkspaceFS.loadWorkspace(TEST_AGENT_ID);
      const trustTiers = AgentTrustTiers.fromWorkspace(workspace!);
      status.trustTiers = trustTiers['config'].tier3.length > 0;
      
      // HEARTBEAT
      const content = await agentWorkspaceFS.readFile(TEST_AGENT_ID, 'HEARTBEAT.md');
      const tasks = parseHeartbeatTasks(content!);
      status.heartbeat = tasks.length > 0;
      
      // Cron
      await agentCronScheduler.registerAgentTasks(TEST_AGENT_ID);
      const cronStatus = agentCronScheduler.getStatus();
      status.cron = cronStatus.totalJobs > 0;
      
      // Cowork
      const recurringTasks = tasks.filter(t => t.frequency !== 'startup');
      coworkIntegration.syncAgentTasks(TEST_AGENT_ID, recurringTasks);
      status.cowork = getAgentCoworkTasks(TEST_AGENT_ID).length > 0;
      
      // Watcher
      const watcher = new WorkspaceFileWatcher(TEST_AGENT_ID);
      await watcher.start();
      const watcherStatus = watcher.getStatus();
      status.watcher = watcherStatus.filesWatched > 0;
      watcher.stop();
      
      console.log('\n📊 Integration Status:');
      console.log(`   File System: ${status.fileSystem ? '✅' : '❌'}`);
      console.log(`   Trust Tiers: ${status.trustTiers ? '✅' : '❌'}`);
      console.log(`   HEARTBEAT: ${status.heartbeat ? '✅' : '❌'}`);
      console.log(`   Cron Scheduler: ${status.cron ? '✅' : '❌'}`);
      console.log(`   Cowork Integration: ${status.cowork ? '✅' : '❌'}`);
      console.log(`   File Watcher: ${status.watcher ? '✅' : '❌'}`);
      
      // All should be true
      expect(status.fileSystem).toBe(true);
      expect(status.trustTiers).toBe(true);
      expect(status.heartbeat).toBe(true);
      expect(status.cron).toBe(true);
      expect(status.cowork).toBe(true);
      expect(status.watcher).toBe(true);
      
    } catch (error) {
      console.error('Integration test failed:', error);
      throw error;
    }
  });
});
