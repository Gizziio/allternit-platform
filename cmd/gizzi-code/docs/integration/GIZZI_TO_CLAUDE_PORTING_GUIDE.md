# Gizzi → Claude Code Porting Guide

**Direction:** Port Gizzi primitives INTO Claude Code codebase  
**TUI:** Keep Claude's React + Ink (don't port Gizzi's SolidJS TUI)  
**Goal:** Add Gizzi's unique features to Claude's mature base

---

## 1. Bus Event System

### Source (Gizzi)
```typescript
// src/shared/bus/index.ts
export namespace Bus {
  export async function publish<Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>
  )
  
  export function subscribe<Definition>(
    def: Definition,
    callback: (event) => void
  ): Unsubscribe
  
  export function subscribeAll(callback: (event) => void): Unsubscribe
}
```

### Port To (Claude)
```typescript
// src/bus/index.ts (NEW FILE)
import { z } from 'zod';

export type BusEventDefinition<T extends z.ZodType> = {
  type: string;
  properties: T;
};

export type Unsubscribe = () => void;

const subscriptions = new Map<string, Array<(event: unknown) => void>>();

export const Bus = {
  publish<T extends z.ZodType>(
    def: BusEventDefinition<T>,
    properties: z.infer<T>
  ): Promise<void> {
    const event = { type: def.type, properties };
    const callbacks = [
      ...(subscriptions.get(def.type) || []),
      ...(subscriptions.get('*') || [])
    ];
    await Promise.all(callbacks.map(cb => cb(event)));
  },
  
  subscribe<T>(
    def: BusEventDefinition<z.ZodType<T>>,
    callback: (event: { type: string; properties: T }) => void
  ): Unsubscribe {
    const list = subscriptions.get(def.type) || [];
    list.push(callback);
    subscriptions.set(def.type, list);
    return () => {
      const idx = list.indexOf(callback);
      if (idx > -1) list.splice(idx, 1);
    };
  },
  
  subscribeAll(callback: (event: unknown) => void): Unsubscribe {
    return this.subscribe({ type: '*', properties: z.any() }, callback);
  }
};
```

### Integration Points
- Bridge Claude's existing events to Bus
- Use for cross-component communication
- Foundation for continuity system

---

## 2. Continuity/Handoff System

### Source (Gizzi)
```typescript
// src/continuity/types.ts
export type ToolType = 
  | "gizzi" | "claude_code" | "codex" | "copilot" 
  | "cursor" | "gemini_cli" | "droid" | "gizzi_shell" 
  | "qwen" | "kimi" | "minimax" | "glm" | "unknown"

export interface SessionContext {
  session_id: string
  source_tool: ToolType
  workspace_path: string
  objective: string
  progress_summary: string[]
  decisions: string[]
  open_todos: TodoItem[]
  dag_tasks: DAGTask[]
  blockers: string[]
  files_changed: FileChange[]
  commands_executed: CommandsByCategory
  errors_seen: ErrorItem[]
  next_actions: NextAction[]
  gizzi_conventions?: GIZZIConventions
}

export interface DAGTask {
  id: string
  name: string
  description: string
  status: "pending" | "in_progress" | "completed" | "blocked" | "failed"
  dependencies: string[]
  priority: "critical" | "high" | "medium" | "low"
  blocking: boolean
}
```

### Port To (Claude)
```typescript
// src/continuity/types.ts (NEW FILE)
export type ToolType = 
  | "claude_code" | "gizzi" | "codex" | "copilot" 
  | "cursor" | "gemini_cli" | "kimi" | "unknown"

export interface SessionContext {
  sessionId: string
  sourceTool: ToolType
  workspacePath: string
  objective: string
  progressSummary: string[]
  decisions: string[]
  openTodos: TodoItem[]
  dagTasks: DAGTask[]
  blockers: string[]
  filesChanged: FileChange[]
  commandsExecuted: CommandsByCategory
  errorsSeen: ErrorItem[]
  nextActions: NextAction[]
  conventions?: ProjectConventions
}

export interface DAGTask {
  id: string
  name: string
  description: string
  status: "pending" | "in_progress" | "completed" | "blocked" | "failed"
  dependencies: string[]
  priority: "critical" | "high" | "medium" | "low"
  blocking: boolean
}
```

### Integration
- Add to Claude's session persistence
- Use for `/handoff` command
- Enable cross-tool context transfer

---

## 3. Session Parent-Child

### Source (Gizzi)
```typescript
// src/runtime/session/index.ts
export const Info = z.object({
  id: Identifier.schema("session"),
  parentID: Identifier.schema("session").optional(),
  title: z.string(),
  // ...
})
```

### Port To (Claude)
```typescript
// src/utils/sessionStorage.ts (MODIFY)
export interface Session {
  // Existing Claude fields
  id: string
  messages: Message[]
  timestamp: number
  
  // NEW: From Gizzi
  parentId?: string
  childIds?: string[]
  continuity?: SessionContext
}

// src/commands/fork/ (NEW COMMAND)
// Fork current session into child
export default function ForkCommand() {
  // Create new session with parentId = current
  // Copy relevant context
  // Open child session
}

// src/commands/tree/ (NEW COMMAND)  
// Show session tree visualization
export default function TreeCommand() {
  // Display parent-child relationships
  // Visual tree in TUI
}
```

---

## 4. PermissionNext Rulesets

### Source (Gizzi)
```typescript
// src/runtime/tools/guard/permission/next.ts
export namespace PermissionNext {
  export type Rule = "allow" | "deny" | "ask"
  
  export type Ruleset = {
    [pattern: string]: Rule | Ruleset
  }
  
  export function merge(...rulesets: Ruleset[]): Ruleset
  export function fromConfig(config: Record<string, any>): Ruleset
}

// Example usage:
const rules = PermissionNext.merge(
  defaults,
  PermissionNext.fromConfig({
    bash: { "rm -rf /": "deny", "*": "ask" },
    edit: { "*.env": "ask", "*": "allow" }
  })
)
```

### Port To (Claude)
```typescript
// src/utils/permissions/ruleset.ts (NEW FILE)
export type PermissionRule = "allow" | "deny" | "ask"

export type PermissionRuleset = {
  [pattern: string]: PermissionRule | PermissionRuleset
}

export function mergePermissionRulesets(
  ...rulesets: PermissionRuleset[]
): PermissionRuleset {
  // Deep merge rulesets
  // Later rulesets override earlier ones
}

export function checkPermission(
  ruleset: PermissionRuleset,
  tool: string,
  params: Record<string, unknown>
): "allow" | "deny" | "ask" {
  // Check ruleset against tool call
  // Return decision
}

// src/hooks/toolPermission/permissionSetup.ts (MODIFY)
// Add ruleset support to existing permission system
```

---

## 5. Gizzi Branding

### Source (Gizzi)
```typescript
// src/shared/brand/meta.ts
export const GIZZIBrand = {
  name: "GIZZI",
  productLine: "Code",
  product: "GIZZI Code",
  command: "gizzi-code",
  wordmark: "GIZZI.IO",
  minimal: "GIZZI",
}

// src/shared/brand/copy.ts
export const GIZZICopy = {
  header: { subagentSession: "Subagent session", parent: "Parent", ... },
  sidebar: { contextPack: "Context Pack", runtime: "LSP Runtime", ... },
  footer: { boot: "Boot kernel", ... },
  prompt: { variants: "profiles", agents: "runtimes", ... },
  // ... hundreds of strings
}
```

### Port To (Claude)
```typescript
// src/brand/index.ts (NEW FILE)
export const Brand = {
  name: "GIZZI",
  product: "GIZZI Code",
  command: "gizzi-code",
  wordmark: "GIZZI.IO",
} as const

export const Copy = {
  // Adapt Gizzi copy to Claude's contexts
  productName: "GIZZI Code",
  
  session: {
    subagentSession: "Subagent session",
    parent: "Parent",
    child: "Child",
  },
  
  status: {
    kernel: "Kernel",
    runtime: "Runtime",
    adapters: "Adapters",
  },
  
  // ... adapt as needed
}

// Replace in Claude components:
// src/components/LogoV2/WelcomeV2.tsx (MODIFY)
// Change "Claude" to Brand.product

// src/components/PromptInput/PromptInput.tsx (MODIFY)
// Use Copy.prompt strings
```

### Visual Identity
```typescript
// src/components/brand/ShimmeringBanner.tsx (NEW)
// Reimplement Gizzi's boot animation in Ink

import { Box, Text } from 'ink';
import { useState, useEffect } from 'react';

export function ShimmeringBanner() {
  // Gizzi-style shimmering banner
  // Implement in React + Ink
}

// Replace Claude's welcome with Gizzi's
// src/components/Onboarding.tsx (MODIFY)
```

---

## 6. Skills System

### Source (Gizzi)
```typescript
// src/runtime/skills/skill.ts
export namespace Skill {
  export const Info = z.object({
    name: z.string(),
    description: z.string(),
    location: z.string(),
    content: z.string(),
  })
  
  export const EXTERNAL_DIRS = [".claude", ".agents", ".openclaw"]
  export const EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md"
  
  export async function dirs(): Promise<string[]>
  export async function list(): Promise<Info[]>
}
```

### Port To (Claude)
```typescript
// src/skills/index.ts (NEW FILE)
import { z } from 'zod';
import glob from 'glob';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface Skill {
  name: string
  description: string
  location: string
  content: string
}

export const SKILL_DIRS = [".claude", ".agents", ".gizzi", ".openclaw"]
export const SKILL_PATTERN = "**/SKILL.md"

export async function discoverSkills(
  rootDir: string
): Promise<Skill[]> {
  const skills: Skill[] = []
  
  // Scan external directories
  for (const dir of SKILL_DIRS) {
    const fullPath = path.join(rootDir, dir, 'skills')
    if (!await fs.stat(fullPath).catch(() => false)) continue
    
    const files = await glob(SKILL_PATTERN, { cwd: fullPath })
    for (const file of files) {
      const content = await fs.readFile(path.join(fullPath, file), 'utf8')
      const parsed = parseSkillMarkdown(content)
      if (parsed) skills.push(parsed)
    }
  }
  
  return skills
}

function parseSkillMarkdown(content: string): Skill | null {
  // Parse frontmatter + markdown content
  // Extract name, description
}

// src/commands/skills/ (ENHANCE EXISTING)
// Extend Claude's existing /skills command
// Add skill discovery, listing, execution
```

---

## 7. Cowork Mode (Hold Off Initially)

### Source (Gizzi)
```typescript
// src/cli/commands/cowork.ts
// src/cli/ui/tui/component/cowork-viewer-indicator.tsx
// src/cli/ui/tui/component/dialog-cowork-approvals.tsx
// src/cli/ui/tui/component/dialog-cowork-pairing.tsx
```

### Decision
**DO NOT PORT YET** - Per user instruction, hold off until integration is stable.

**Reason:** Complex feature, requires stability first.

---

## Files to Create/Modify Summary

### New Files (from Gizzi)
```
src/bus/index.ts                      # Event bus
src/continuity/types.ts               # Handoff types
src/continuity/extract.ts             # Context extraction
src/continuity/emit.ts                # Handoff creation
src/continuity/parse.ts               # Handoff parsing
src/utils/permissions/ruleset.ts      # PermissionNext
src/brand/index.ts                    # Brand constants
src/brand/copy.ts                     # UI strings
src/components/brand/ShimmeringBanner.tsx  # Boot animation
src/skills/index.ts                   # Skill system
src/skills/discovery.ts               # Skill discovery
src/commands/fork/                    # Fork session
src/commands/tree/                    # Session tree
```

### Modified Files (Claude existing)
```
src/utils/sessionStorage.ts           # Add parent-child
src/hooks/toolPermission/             # Add ruleset support
src/components/LogoV2/                # Apply Gizzi branding
src/components/Onboarding.tsx         # Apply Gizzi branding
src/commands/skills/                  # Enhance with Gizzi features
```

---

## Implementation Order

1. **Bus** - Foundation for other features
2. **Branding** - Apply Gizzi identity to Claude UI
3. **Continuity types** - Type definitions
4. **Session parent-child** - Extend session model
5. **PermissionNext** - Enhance permission system
6. **Skills** - Add skill discovery
7. **Cowork** (later) - After stability

---

*Porting guide complete. Ready for implementation.*
