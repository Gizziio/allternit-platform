# Gizzi-Code to Allternit Native - Implementation Guide

**Date:** March 6, 2026  
**Purpose:** Step-by-step implementation guide with code examples

---

## Table of Contents

1. [Phase 1: Foundation (Sprint 1-2)](#phase-1-foundation)
2. [Phase 2: Decoupling (Sprint 3-4)](#phase-2-decoupling)
3. [Phase 3: Allternit Layers (Sprint 5-6)](#phase-3-allternit-layers)
4. [Phase 4: Kernel Integration (Sprint 7-8)](#phase-4-kernel-integration)
5. [Phase 5: Optimization (Sprint 9-10)](#phase-5-optimization)

---

## Phase 1: Foundation

### Step 1.1: Create Allternit Directory Structure

```bash
# Navigate to gizzi-code root
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code

# Create Allternit workspace structure
mkdir -p .allternit/{state/{locks,checkpoints},contracts/{schemas},context/{pack.history},memory}
mkdir -p memory
mkdir -p skills/_template

# Create root-level Allternit files
touch AGENTS.md SOUL.md USER.md IDENTITY.md TOOLS.md SYSTEM.md CHANNELS.md POLICY.md HEARTBEAT.md MEMORY.md
```

### Step 1.2: Create Allternit Manifest Schema

```typescript
// src/shared/allternit/manifest.ts
import z from 'zod';

export const WorkspaceManifest = z.object({
  version: z.string(),
  engineVersion: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  policies: z.object({
    workspaceBoundary: z.boolean(),
    network: z.boolean(),
    destructive: z.boolean(),
    rateLimit: z.number(),
  }),
  identity: z.object({
    name: z.string(),
    nature: z.string(),
    avatar: z.string().optional(),
  }),
});

export type WorkspaceManifest = z.infer<typeof WorkspaceManifest>;

export async function loadManifest(workspaceRoot: string): Promise<WorkspaceManifest> {
  const manifestPath = path.join(workspaceRoot, '.allternit', 'manifest.json');
  const content = await Bun.file(manifestPath).text();
  return WorkspaceManifest.parse(JSON.parse(content));
}

export async function saveManifest(
  workspaceRoot: string,
  manifest: WorkspaceManifest
): Promise<void> {
  const manifestPath = path.join(workspaceRoot, '.allternit', 'manifest.json');
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));
}
```

### Step 1.3: Implement 21-Phase Boot Sequence

```typescript
// src/cli/bootstrap/allternit-boot.ts
import { Log } from '@/shared/util/log';
import { WorkspaceLock } from './workspace-lock';
import { loadManifest } from '@/shared/allternit/manifest';
import { IdentityEngine } from '@/runtime/context/identity';
import { GovernanceEngine } from '@/runtime/governance/engine';
import { MemoryHydration } from '@/runtime/memory/hydration';
import { SkillRegistry } from '@/runtime/skills/registry';
import { ContextPackBuilder } from '@/runtime/context/pack';

const log = Log.create({ service: 'allternit-boot' });

export interface BootResult {
  contextPack: ContextPack;
  workspaceRoot: string;
  manifest: WorkspaceManifest;
}

export class AllternitBootSequence {
  constructor(private workspaceRoot: string) {}

  async boot(): Promise<BootResult> {
    log.info('Starting Allternit 21-phase boot sequence');
    
    try {
      // PHASE 1: SYSTEM INITIALIZATION
      await this.phase1_systemInit();
      
      // PHASE 2: IDENTITY & GOVERNANCE
      const identity = await this.phase2_identityGovernance();
      
      // PHASE 3: ENVIRONMENT & TOOLS
      const environment = await this.phase3_environmentTools();
      
      // PHASE 4: MEMORY HYDRATION
      const memory = await this.phase4_memoryHydration();
      
      // PHASE 5: CAPABILITIES
      const capabilities = await this.phase5_capabilities();
      
      // PHASE 6: CONTEXT BUILD
      const contextPack = await this.phase6_contextBuild(
        identity,
        environment,
        memory,
        capabilities
      );
      
      log.info('Allternit boot sequence complete');
      
      return {
        contextPack,
        workspaceRoot: this.workspaceRoot,
        manifest: await loadManifest(this.workspaceRoot),
      };
    } catch (error) {
      log.error('Boot sequence failed', { error });
      throw error;
    }
  }

  private async phase1_systemInit() {
    log.info('PHASE 1: System Initialization');
    
    // Step 1: Lock Acquisition
    const lock = await WorkspaceLock.acquire(this.workspaceRoot);
    log.debug('Workspace lock acquired', { lockId: lock.id });
    
    // Step 2: Load Manifest
    const manifest = await loadManifest(this.workspaceRoot);
    log.debug('Manifest loaded', { version: manifest.version });
    
    // Step 3: Crash Recovery
    await this.crashRecovery();
    log.debug('Crash recovery complete');
  }

  private async phase2_identityGovernance() {
    log.info('PHASE 2: Identity & Governance');
    
    // Step 4: Load IDENTITY.md
    const identity = await IdentityEngine.loadIdentity(this.workspaceRoot);
    log.debug('Identity loaded', { name: identity.name });
    
    // Step 5: Load AGENTS.md
    const constitution = await GovernanceEngine.loadConstitution(this.workspaceRoot);
    log.debug('Constitution loaded');
    
    // Step 6: Load SOUL.md
    const soul = await IdentityEngine.loadSoul(this.workspaceRoot);
    log.debug('Soul profile loaded');
    
    // Step 7: Load USER.md
    const userPrefs = await IdentityEngine.loadUserPrefs(this.workspaceRoot);
    log.debug('User preferences loaded');
    
    return { identity, constitution, soul, userPrefs };
  }

  private async phase3_environmentTools() {
    log.info('PHASE 3: Environment & Tools');
    
    // Step 8: Load TOOLS.md
    const tools = await GovernanceEngine.loadTools(this.workspaceRoot);
    
    // Step 9: Load SYSTEM.md
    const system = await GovernanceEngine.loadSystem(this.workspaceRoot);
    
    // Step 10: Load CHANNELS.md
    const channels = await GovernanceEngine.loadChannels(this.workspaceRoot);
    
    // Step 11: Load POLICY.md
    const policy = await GovernanceEngine.loadPolicy(this.workspaceRoot);
    
    return { tools, system, channels, policy };
  }

  private async phase4_memoryHydration() {
    log.info('PHASE 4: Memory Hydration');
    
    // Steps 12-16: Load memory files
    const curatedMemory = await MemoryHydration.loadCurated(this.workspaceRoot);
    const dailyLogs = await MemoryHydration.loadDailyLogs(this.workspaceRoot);
    const activeTasks = await MemoryHydration.loadActiveTasks(this.workspaceRoot);
    const lessons = await MemoryHydration.loadLessons(this.workspaceRoot);
    const selfReview = await MemoryHydration.loadSelfReview(this.workspaceRoot);
    
    return { curatedMemory, dailyLogs, activeTasks, lessons, selfReview };
  }

  private async phase5_capabilities() {
    log.info('PHASE 5: Capabilities');
    
    // Step 17: Index Skills
    const skillIndex = await SkillRegistry.index(this.workspaceRoot);
    log.debug('Skills indexed', { count: skillIndex.skills.length });
    
    // Step 18: Load Tool Registry
    const toolRegistry = await SkillRegistry.loadToolRegistry(this.workspaceRoot);
    
    // Step 19: Load Provider Config
    const providerConfig = await SkillRegistry.loadProviderConfig(this.workspaceRoot);
    
    return { skillIndex, toolRegistry, providerConfig };
  }

  private async phase6_contextBuild(identity, environment, memory, capabilities) {
    log.info('PHASE 6: Context Build');
    
    // Step 20: Build Context Pack
    const contextPack = await ContextPackBuilder.build({
      identity,
      governance: environment,
      memory,
      capabilities,
    });
    
    // Step 21: Resume Work
    await this.resumeWork(contextPack);
    
    return contextPack;
  }

  private async crashRecovery() {
    // Read active-tasks.md and taskgraph.json
    // Reconcile state
    // Detect stale tasks (>2h no update)
  }

  private async resumeWork(contextPack: ContextPack) {
    // Continue from active-tasks.md
    // Check heartbeat status
    // Run scheduled tasks if due
  }
}
```

### Step 1.4: Implement Workspace Lock

```typescript
// src/cli/bootstrap/workspace-lock.ts
import { Log } from '@/shared/util/log';
import { NamedError } from '@allternit/util/error';
import z from 'zod';

const log = Log.create({ service: 'workspace-lock' });

export const LockError = NamedError.create('LockError', z.object({
  reason: z.string(),
  lockedBy: z.string().optional(),
}));

export interface WorkspaceLock {
  id: string;
  acquiredAt: string;
  expiresAt: string;
  pid: number;
}

export class WorkspaceLock {
  private static LOCK_FILE = '.allternit/state/locks/workspace.lock';
  private static TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static HEARTBEAT_MS = 60 * 1000; // 1 minute

  private lockFile: string;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(private workspaceRoot: string) {
    this.lockFile = path.join(workspaceRoot, WorkspaceLock.LOCK_FILE);
  }

  static async acquire(workspaceRoot: string): Promise<WorkspaceLock> {
    const locker = new WorkspaceLock(workspaceRoot);
    return await locker.acquire();
  }

  async acquire(): Promise<WorkspaceLock> {
    // Check if lock exists and is not expired
    const existingLock = await this.readLock();
    
    if (existingLock) {
      if (!this.isExpired(existingLock)) {
        throw LockError.create({
          reason: 'Workspace is locked by another process',
          lockedBy: existingLock.id,
        });
      }
      log.warn('Found expired lock, releasing');
    }

    // Create new lock
    const lock: WorkspaceLock = {
      id: crypto.randomUUID(),
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + WorkspaceLock.TTL_MS).toISOString(),
      pid: process.pid,
    };

    await this.writeLock(lock);
    log.info('Workspace lock acquired', { lockId: lock.id });

    // Start heartbeat
    this.startHeartbeat();

    // Handle process exit
    process.on('exit', () => this.release());
    process.on('SIGINT', () => this.release());
    process.on('SIGTERM', () => this.release());

    return lock;
  }

  async release(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    await Bun.write(this.lockFile, '');
    log.info('Workspace lock released');
  }

  private async readLock(): Promise<WorkspaceLock | null> {
    try {
      const content = await Bun.file(this.lockFile).text();
      if (!content.trim()) return null;
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async writeLock(lock: WorkspaceLock): Promise<void> {
    await Bun.write(this.lockFile, JSON.stringify(lock, null, 2));
  }

  private isExpired(lock: WorkspaceLock): boolean {
    return new Date(lock.expiresAt) < new Date();
  }

  private async refreshLock(): Promise<void> {
    const lock = await this.readLock();
    if (!lock) return;

    lock.expiresAt = new Date(Date.now() + WorkspaceLock.TTL_MS).toISOString();
    await this.writeLock(lock);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.refreshLock().catch((err) => {
        log.error('Heartbeat failed', { err });
      });
    }, WorkspaceLock.HEARTBEAT_MS);
  }
}
```

---

## Phase 2: Decoupling

### Step 2.1: Create @allternit/runtime Package Structure

```bash
# Create runtime package
mkdir -p /Users/macbook/Desktop/allternit-workspace/allternit/cmd/runtime
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/runtime

# Initialize package
bun init

# Create directory structure
mkdir -p src/{kernel,orchestration,skills,memory,context,providers,server,database,governance}
mkdir -p src/allternit/{layers,boot,contracts}
```

### Step 2.2: Create Runtime Package.json

```json
{
  "$schema": "https://json.schemastore.org/package.json",
  "name": "@allternit/runtime",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "exports": {
    ".": "./dist/index.js",
    "./kernel": "./dist/kernel/index.js",
    "./orchestration": "./dist/orchestration/index.js",
    "./skills": "./dist/skills/index.js",
    "./memory": "./dist/memory/index.js",
    "./context": "./dist/context/index.js",
    "./providers": "./dist/providers/index.js",
    "./governance": "./dist/governance/index.js"
  },
  "dependencies": {
    "@ai-sdk/openai": "2.0.89",
    "@ai-sdk/anthropic": "2.0.65",
    "@ai-sdk/google": "2.0.54",
    "ai": "5.0.124",
    "hono": "*",
    "drizzle-orm": "1.0.0-beta.12-a5629fb",
    "@modelcontextprotocol/sdk": "1.25.2",
    "@agentclientprotocol/sdk": "0.14.1",
    "@allternit/sdk": "workspace:*",
    "@allternit/util": "workspace:*",
    "zod": "4.3.6"
  }
}
```

### Step 2.3: Move Runtime Code (Example: Skills)

**Before (in gizzi-code):**
```typescript
// src/runtime/skills/registry.ts (in gizzi-code)
import { Log } from '@/shared/util/log';
import { Skill } from './types';

export class SkillRegistry {
  // ... implementation
}
```

**After (in @allternit/runtime):**
```typescript
// src/skills/registry.ts (in @allternit/runtime)
import { Log } from '@allternit/util/log';
import { Skill, SkillContract } from './types';
import { WorkspaceRoot } from '../context/workspace';

export class SkillRegistry {
  static async index(workspaceRoot: WorkspaceRoot): Promise<SkillIndex> {
    const skillsDir = path.join(workspaceRoot, 'skills');
    const skills: Skill[] = [];
    
    for await (const entry of Bun.glob('*/SKILL.md', { cwd: skillsDir })) {
      const skillPath = path.join(skillsDir, entry);
      const skill = await this.parseSkill(skillPath);
      skills.push(skill);
    }
    
    return {
      skills,
      indexedAt: new Date().toISOString(),
    };
  }

  static async load(workspaceRoot: WorkspaceRoot, skillName: string): Promise<Skill> {
    const skillPath = path.join(workspaceRoot, 'skills', skillName, 'SKILL.md');
    return await this.parseSkill(skillPath);
  }

  private static async parseSkill(skillPath: string): Promise<Skill> {
    const content = await Bun.file(skillPath).text();
    // Parse SKILL.md frontmatter and content
    // ...
  }
}
```

### Step 2.4: Update Gizzi-Code to Use Runtime

**Before:**
```typescript
// src/cli/commands/skills.ts (in gizzi-code)
import { SkillRegistry } from '@/runtime/skills/registry';

export async function listSkills() {
  const registry = new SkillRegistry();
  const skills = await registry.index();
  // ...
}
```

**After:**
```typescript
// src/cli/commands/skills.ts (in gizzi-code)
import { SkillRegistry } from '@allternit/runtime/skills';

export async function listSkills(workspaceRoot: string) {
  const skills = await SkillRegistry.index(workspaceRoot);
  // ...
}
```

---

## Phase 3: Allternit Layers Implementation

### Step 3.1: Layer 1 - Cognitive Persistence

```typescript
// @allternit/runtime/allternit/layers/layer1-cognitive.ts
import { z } from 'zod';
import { Receipt } from '../memory/receipt';

export const BRAIN = z.object({
  taskGraph: z.array(z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(['pending', 'in-progress', 'blocked', 'completed']),
    parent: z.string().optional(),
    receipts: z.array(z.string()),
  })),
  updatedAt: z.string().datetime(),
});

export const MEMORY = z.object({
  entries: z.array(z.object({
    timestamp: z.string().datetime(),
    type: z.enum(['decision', 'question', 'blocker', 'lesson']),
    content: z.string(),
    tags: z.array(z.string()),
  })),
  curatedLessons: z.array(z.string()),
});

export class CognitivePersistence {
  constructor(private workspaceRoot: string) {}

  async loadBrain(): Promise<z.infer<typeof BRAIN>> {
    const brainPath = path.join(this.workspaceRoot, '.allternit', 'brain', 'BRAIN.md');
    const content = await Bun.file(brainPath).text();
    return this.parseBrain(content);
  }

  async loadMemory(): Promise<z.infer<typeof MEMORY>> {
    const memoryPath = path.join(this.workspaceRoot, 'MEMORY.md');
    const content = await Bun.file(memoryPath).text();
    return this.parseMemory(content);
  }

  async appendReceipt(receipt: Receipt): Promise<void> {
    const receiptsPath = path.join(
      this.workspaceRoot,
      '.allternit',
      'memory',
      'receipts.jsonl'
    );
    await Bun.write(receiptsPath, JSON.stringify(receipt) + '\n', { append: true });
  }

  async checkpoint(): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      taskGraph: await this.loadBrain(),
      memory: await this.loadMemory(),
    };
    
    const checkpointsPath = path.join(
      this.workspaceRoot,
      '.allternit',
      'state',
      'checkpoints.jsonl'
    );
    await Bun.write(checkpointsPath, JSON.stringify(checkpoint) + '\n', { append: true });
    
    return checkpoint;
  }

  private parseBrain(content: string): z.infer<typeof BRAIN> {
    // Parse BRAIN.md markdown into structured task graph
    // ...
  }

  private parseMemory(content: string): z.infer<typeof MEMORY> {
    // Parse MEMORY.md markdown into structured memory
    // ...
  }
}
```

### Step 3.2: Layer 2 - Identity Stabilization

```typescript
// @allternit/runtime/allternit/layers/layer2-identity.ts
import { z } from 'zod';

export const IDENTITY = z.object({
  name: z.string(),
  nature: z.string(),
  vibe: z.string().optional(),
  emoji: z.string().optional(),
  avatar: z.string().optional(),
});

export const SOUL = z.object({
  tone: z.string(),
  personality: z.string(),
  guidelines: z.array(z.string()),
});

export const USER = z.object({
  preferences: z.record(z.string()),
  assumptions: z.array(z.string()),
  communicationStyle: z.string(),
});

export class IdentityEngine {
  constructor(private workspaceRoot: string) {}

  static async loadIdentity(workspaceRoot: string): Promise<z.infer<typeof IDENTITY>> {
    const content = await Bun.file(path.join(workspaceRoot, 'IDENTITY.md')).text();
    return this.parseIdentity(content);
  }

  static async loadSoul(workspaceRoot: string): Promise<z.infer<typeof SOUL>> {
    const content = await Bun.file(path.join(workspaceRoot, 'SOUL.md')).text();
    return this.parseSoul(content);
  }

  static async loadUserPrefs(workspaceRoot: string): Promise<z.infer<typeof USER>> {
    const content = await Bun.file(path.join(workspaceRoot, 'USER.md')).text();
    return this.parseUser(content);
  }

  private static parseIdentity(content: string): z.infer<typeof IDENTITY> {
    // Parse IDENTITY.md frontmatter
    const { data } = matter(content);
    return IDENTITY.parse(data);
  }

  private static parseSoul(content: string): z.infer<typeof SOUL> {
    const { data } = matter(content);
    return SOUL.parse(data);
  }

  private static parseUser(content: string): z.infer<typeof USER> {
    const { data } = matter(content);
    return USER.parse(data);
  }
}
```

### Step 3.3: Layer 3 - Governance & Decision

```typescript
// @allternit/runtime/allternit/layers/layer3-governance.ts
import { z } from 'zod';
import { Tool } from '../tools/types';

export const AGENTS = z.object({
  version: z.string(),
  boot: z.object({
    sequence: z.array(z.string()),
  }),
  permissions: z.object({
    allowedPaths: z.array(z.string()),
    deniedPaths: z.array(z.string()),
    toolTiers: z.record(z.enum(['read', 'write', 'execute', 'destructive'])),
  }),
  safety: z.object({
    approvalRequired: z.array(z.string()),
    maxIterations: z.number(),
  }),
});

export const POLICY = z.object({
  overrides: z.record(z.any()),
  experimentFlags: z.array(z.string()),
  abTests: z.array(z.object({
    name: z.string(),
    variant: z.string(),
  })),
});

export class GovernanceEngine {
  constructor(private workspaceRoot: string) {}

  static async loadConstitution(workspaceRoot: string): Promise<z.infer<typeof AGENTS>> {
    const content = await Bun.file(path.join(workspaceRoot, 'AGENTS.md')).text();
    const { data } = matter(content);
    return AGENTS.parse(data);
  }

  static async loadPolicy(workspaceRoot: string): Promise<z.infer<typeof POLICY>> {
    const content = await Bun.file(path.join(workspaceRoot, 'POLICY.md')).text();
    const { data } = matter(content);
    return POLICY.parse(data);
  }

  async validateToolUse(tool: Tool): Promise<Permission> {
    const constitution = await GovernanceEngine.loadConstitution(this.workspaceRoot);
    const policy = await GovernanceEngine.loadPolicy(this.workspaceRoot);
    
    // Check tool tier permissions
    const tier = constitution.permissions.toolTiers[tool.name];
    if (!tier) {
      return { allowed: false, reason: 'Tool not in registry' };
    }
    
    // Check if approval required
    if (constitution.safety.approvalRequired.includes(tool.name)) {
      return { allowed: false, reason: 'Requires approval', requiresApproval: true };
    }
    
    return { allowed: true, tier };
  }

  async enforceRails(receipt: Receipt): Promise<void> {
    // Validate receipt against AGENTS.md constitution
    // Emit violations to audit ledger
  }
}
```

---

## Phase 4: Kernel Integration (Rust FFI)

### Step 4.1: Create Rust FFI Bridge

```typescript
// @allternit/runtime/kernel/ffi-bridge.ts
import { init, GovernanceEngine, Receipt } from './kernel-node';

export class KernelBridge {
  private engine: ReturnType<typeof GovernanceEngine>;

  constructor() {
    this.engine = new GovernanceEngine();
  }

  async initialize(): Promise<void> {
    await init();
  }

  async emitReceipt(receipt: Receipt): Promise<string> {
    const receiptJson = JSON.stringify(receipt);
    const receiptId = this.engine.emit_receipt(receiptJson);
    return receiptId;
  }

  async validateAction(action: string): Promise<ValidationResult> {
    const resultJson = this.engine.validate_action(action);
    return JSON.parse(resultJson);
  }

  async getPolicyDecision(context: PolicyContext): Promise<PolicyDecision> {
    const contextJson = JSON.stringify(context);
    const decisionJson = this.engine.get_policy_decision(contextJson);
    return JSON.parse(decisionJson);
  }
}
```

### Step 4.2: Rust Kernel FFI

```rust
// kernel/src/lib.rs
use napi_derive::napi;
use serde::{Deserialize, Serialize};

#[napi]
pub struct GovernanceEngine {
    // Internal state
}

#[napi]
impl GovernanceEngine {
    #[napi(constructor)]
    pub fn new() -> Self {
        GovernanceEngine { /* init */ }
    }

    #[napi]
    pub fn emit_receipt(&self, receipt_json: String) -> String {
        let receipt: Receipt = serde_json::from_str(&receipt_json).unwrap();
        let id = self.internal_emit_receipt(receipt);
        id.to_string()
    }

    #[napi]
    pub fn validate_action(&self, action_json: String) -> String {
        let action: Action = serde_json::from_str(&action_json).unwrap();
        let result = self.internal_validate_action(action);
        serde_json::to_string(&result).unwrap()
    }
}
```

---

## Phase 5: Optimization

### Step 5.1: Lazy Load AI Providers

```typescript
// @allternit/runtime/providers/lazy-loader.ts
type ProviderFactory = () => Promise<any>;

export class ProviderLoader {
  private cache: Map<string, any> = new Map();
  private factories: Map<string, ProviderFactory> = new Map();

  constructor() {
    this.registerFactories();
  }

  private registerFactories() {
    this.factories.set('openai', async () => {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI();
    });

    this.factories.set('anthropic', async () => {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      return createAnthropic();
    });

    this.factories.set('google', async () => {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      return createGoogleGenerativeAI();
    });
  }

  async getProvider(name: string) {
    if (this.cache.has(name)) {
      return this.cache.get(name);
    }

    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Unknown provider: ${name}`);
    }

    const provider = await factory();
    this.cache.set(name, provider);
    return provider;
  }
}
```

### Step 5.2: Tree Shake Utilities

```typescript
// Instead of this:
import * as R from 'remeda';
const result = R.pipe(data, R.map(fn), R.filter(pred));

// Do this:
import { pipe, map, filter } from 'remeda';
const result = pipe(data, map(fn), filter(pred));
```

### Step 5.3: Update Workspace Dependencies

```json
// @allternit/gizzi-code/package.json (after decoupling)
{
  "name": "@allternit/gizzi-code",
  "dependencies": {
    "@allternit/runtime": "workspace:*",
    "@opentui/core": "0.1.79",
    "@opentui/solid": "0.1.79",
    "@clack/prompts": "1.0.0-alpha.1",
    "solid-js": "*",
    "yargs": "18.0.0",
    "zod": "4.3.6"
  },
  "peerDependencies": {
    "@allternit/runtime": "workspace:*"
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// test/allternit/boot-sequence.test.ts
import { describe, test, expect } from 'bun:test';
import { AllternitBootSequence } from '../../src/cli/bootstrap/allternit-boot';

describe('AllternitBootSequence', () => {
  test('should complete 21-phase boot', async () => {
    const boot = new AllternitBootSequence('/tmp/test-workspace');
    const result = await boot.boot();
    
    expect(result.contextPack).toBeDefined();
    expect(result.manifest).toBeDefined();
  });

  test('should recover from crash', async () => {
    // Simulate crash scenario
    // Verify recovery from checkpoints
  });
});
```

### Architecture Tests

```typescript
// test/architecture/layer-dependencies.test.ts
import { describe, test, expect } from 'bun:test';
import { parse } from '@swc/core';

describe('Architecture Constraints', () => {
  test('TUI layer should not import AI providers', async () => {
    const tuiFiles = await glob('src/cli/ui/**/*.ts');
    
    for (const file of tuiFiles) {
      const content = await Bun.file(file).text();
      expect(content).not.toContain('@ai-sdk/');
      expect(content).not.toContain('ai');
    }
  });

  test('Runtime layer should not import TUI components', async () => {
    const runtimeFiles = await glob('../runtime/src/**/*.ts');
    
    for (const file of runtimeFiles) {
      const content = await Bun.file(file).text();
      expect(content).not.toContain('@opentui/');
      expect(content).not.toContain('@clack/');
    }
  });
});
```

---

## Migration Checklist

### Sprint 1-2: Foundation
- [ ] Create Allternit directory structure
- [ ] Implement WorkspaceLock
- [ ] Implement 21-phase boot sequence
- [ ] Create context pack builder
- [ ] Add checkpoint system
- [ ] Write unit tests for boot sequence

### Sprint 3-4: Decoupling
- [ ] Create @allternit/runtime package
- [ ] Move src/runtime/* to @allternit/runtime
- [ ] Update all imports in gizzi-code
- [ ] Remove AI providers from gizzi-code
- [ ] Remove Hono from gizzi-code
- [ ] Remove Drizzle from gizzi-code
- [ ] Test runtime independently
- [ ] Test TUI independently

### Sprint 5-6: Allternit Layers
- [ ] Implement Layer 1 (Cognitive)
- [ ] Implement Layer 2 (Identity)
- [ ] Implement Layer 3 (Governance)
- [ ] Implement Layer 4 (Skills)
- [ ] Implement Layer 5 (Business)
- [ ] Write integration tests

### Sprint 7-8: Kernel Integration
- [ ] Design Rust FFI interface
- [ ] Implement napi-rs bridge
- [ ] Add receipt emission
- [ ] Add policy enforcement
- [ ] Build audit ledger
- [ ] End-to-end testing

### Sprint 9-10: Optimization
- [ ] Lazy load AI providers
- [ ] Tree shake utilities
- [ ] Remove unused dependencies
- [ ] Bundle size analysis
- [ ] Performance benchmarking
- [ ] Document API boundaries

---

**Generated:** March 6, 2026  
**Next Steps:** Review with team, get alignment on approach, begin Sprint 1
