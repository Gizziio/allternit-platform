# Allternit Continuity Module

Session discovery, context extraction, and handoff management for cross-tool AI workflows.

## Overview

The continuity module enables seamless session handoffs between different AI coding tools by:

1. **Discovering sessions** across tools (OpenCode, Claude Code, Codex, etc.)
2. **Extracting meaningful context** from sessions
3. **Emitting standardized batons** for handoff
4. **Validating batons** through CI gates

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Session Sources                           │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ OpenCode │ Claude   │  Codex   │   Kimi   │   Qwen   │   GLM    │
│  SQLite  │  JSONL   │  JSONL   │  Custom  │  Custom  │  Custom  │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬────┘
     │          │          │          │          │          │
     └──────────┴──────────┴────┬─────┴──────────┴──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Session Discovery  │
                    │   (TTL-cached)      │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Context Extractor  │
                    │  - Objective        │
                    │  - Decisions        │
                    │  - TODOs            │
                    │  - DAG Tasks        │
                    │  - Allternit Conventions  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Handoff Emitter   │
                    │   (Baton Format)    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │     CI Gates        │
                    │  - Evidence Gate    │
                    │  - No-Lazy Gate     │
                    │  - Resume Gate      │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Target Tool       │
                    │   (Resume Session)  │
                    └─────────────────────┘
```

## Components

### 1. Session Discovery (`src/continuity/index.ts`)

Scans known tool storage paths with 5-minute TTL caching.

```typescript
import { SessionDiscovery } from "@/continuity"

// Scan all tools
const sessions = await SessionDiscovery.scanAll()

// Force refresh
const fresh = await SessionDiscovery.scanAll({ force: true })

// Custom TTL
const hourly = await SessionDiscovery.scanAll({ ttl_ms: 60 * 60 * 1000 })
```

### 2. Context Extraction (`src/continuity/context-extractor.ts`)

Extracts structured context from session data.

```typescript
import { ContextExtractor } from "@/continuity/context-extractor"

const context = await ContextExtractor.extract({
  source: sessionSource,
  workspace: "/path/to/project",
  messages: [...],  // Message history
  usage: usageSummary,
})
```

Extracted fields:
- **Objective**: From first user message or session title
- **Progress Summary**: Completed work items
- **Decisions**: Explicit decisions made during session
- **TODOs**: Open tasks with priority and blocking status
- **DAG Tasks**: Structured workflow tasks with dependencies
- **Files Changed**: List of modified files with actions
- **Commands Executed**: Categorized (build/test/lint/git/other)
- **Errors Seen**: Errors encountered with recoverability
- **Next Actions**: Concrete next steps
- **Allternit Conventions**: Project standards (inferred or explicit)
- **Limits**: Token usage and context ratios

### 3. Handoff Emitter (`src/continuity/handoff-emitter.ts`)

Generates batons in markdown or JSON format.

```typescript
import { HandoffEmitter } from "@/continuity/handoff-emitter"

// Generate markdown baton
const markdown = HandoffEmitter.emitMarkdown({
  context: sessionContext,
  target_tool: "claude_code",
  compact_reason: "threshold",
})

// Generate JSON baton
const json = HandoffEmitter.emitJSON({
  context: sessionContext,
  compact_reason: "threshold",
})
```

### 4. CI Gates (`src/continuity/gates.ts`)

Validates handoff quality before emission.

```typescript
import { CIGates } from "@/continuity/gates"

const report = await CIGates.validate(baton, {
  strict: true,
  targetTool: "claude_code",
  maxContextTokens: 200000,
})

if (!report.passed) {
  console.log(CIGates.formatReport(report))
}
```

## Baton Format

### Sections

The handoff baton contains 13 sections:

1. **Objective** - Primary goal of the session
2. **Current Plan** - Progress summary
3. **Work Completed** - Finished items
4. **Files Changed** - Modified files with actions
5. **Commands Executed** - Categorized command history
6. **Errors / Blockers** - Issues encountered
7. **Decisions Made** - Key architectural choices
8. **Open TODOs** - Outstanding tasks
9. **DAG Tasks (NEW)** - Structured workflow with dependencies
10. **Next Actions** - Concrete next steps
11. **Allternit Conventions (NEW)** - Project standards
12. **Evidence Pointers** - References to artifacts
13. **Limits Snapshot** - Token usage and context ratios

### Example

```markdown
# Allternit Session Baton

**Session:** sess-abc-123  
**Tool:** opencode  
**Workspace:** /home/user/project  
**Generated:** 2026-02-24T10:00:00Z  
**Reason:** threshold

---

## Objective

Implement session handoff feature with DAG task support

---

## DAG Tasks (Workflow)

### 🔴 Critical Path
- **[IN_PROGRESS]** Implement core (opencode)

### 🟡 In Progress (1)
- Implement: Build the feature
  - Budget: 5000/10000 tokens

### ⏳ Pending (0)

---
**Progress:** 1/2 completed (50%)

---

## Allternit Conventions

### Code Style
- Formatter: prettier
- Linter: eslint

### Testing
- Framework: vitest
- Pattern: `**/*.test.ts`
```

## CI Gates

### Evidence Gate

Validates that all referenced artifacts exist:

| Check | Severity |
|-------|----------|
| Referenced files exist | Error |
| Valid receipt offset | Error |
| State hash format | Warning |
| Diff references valid | Warning |

### No-Lazy Gate

Detects lazy handoff patterns:

| Pattern | Example |
|---------|---------|
| Responsibility deferral | "I'll let you handle this" |
| AI disclaimers | "As an AI language model..." |
| Vague instructions | "You can just..." |
| Complexity downplay | "Should be easy" |
| Incomplete excuses | "I didn't have time to..." |
| Open questions | "TODO: how should we...?" |
| Unhelpful sentiment | "Good luck!" |

Also validates:
- Next actions are concrete (not vague)
- TODOs have sufficient detail
- DAG tasks have descriptions

### Resume Gate

Validates the baton can be resumed:

| Check | Severity |
|-------|----------|
| Workspace exists | Error |
| Valid objective | Error |
| Valid session ID | Error |
| Actionable items present | Error |
| Fits in context window | Error |
| Near context limit | Warning |
| Session age > 30 days | Warning |
| Incomplete blocking tasks | Warning |
| Unrecoverable errors | Warning |
| Target tool compatibility | Warning |

## Tool Support

### Supported Tools

| Tool | Storage | Parser Status |
|------|---------|---------------|
| OpenCode | SQLite | Basic |
| Claude Code | JSONL | Basic |
| Codex | JSONL | Basic |
| Copilot | Proprietary | Basic |
| Cursor | SQLite | Basic |
| Gemini CLI | JSON | Basic |
| Droid | JSON | Basic |
| Allternit Shell | SQLite | Native |
| **Kimi** | Custom | Basic |
| **Qwen** | Custom | Basic |
| **MiniMax** | Custom | Basic |
| **GLM** | Custom | Basic |

### Adding a New Tool

1. Add to `ToolType` in `types.ts`:
```typescript
export type ToolType = 
  | "existing_tools"
  | "new_tool"  // Add here
  | "unknown"
```

2. Add paths to `TOOL_PATHS` in `index.ts`:
```typescript
new_tool: [
  "~/.new_tool/sessions",
  "~/.local/share/new_tool",
],
```

3. Add parser in `parseSessionPath`:
```typescript
case "new_tool":
  return parseNewToolSession(sessionPath, id, mtime)
```

4. Implement parser:
```typescript
async function parseNewToolSession(
  path: string, 
  id: string, 
  mtime: number
): Promise<SessionSource> {
  // Parse tool-specific format
  return {
    id,
    tool: "new_tool",
    workspace_path: path,
    created_at: mtime,
    modified_at: mtime,
    message_count: 0,
    title: id,
  }
}
```

## Allternit Conventions

Conventions can be defined in:

- `.allternit/conventions.json`
- `allternit.json`
- `.allternit.json`

Example:
```json
{
  "allternit": {
    "file_naming": {
      "pattern": "kebab-case",
      "examples": ["my-file.ts", "another-util.ts"]
    },
    "code_style": {
      "formatter": "prettier",
      "linter": "eslint"
    },
    "testing": {
      "framework": "vitest",
      "pattern": "**/*.test.ts",
      "coverage_threshold": 80
    },
    "git_workflow": {
      "branching_strategy": "git-flow",
      "commit_convention": "conventional-commits"
    },
    "architecture": {
      "pattern": "layered",
      "patterns_used": ["Repository", "Service"],
      "forbidden_patterns": ["God objects"]
    },
    "review_checklist": [
      "Tests passing",
      "Documentation updated",
      "No console.log statements"
    ]
  }
}
```

Conventions are also auto-inferred from project structure (package.json, .eslintrc, etc.).

## DAG Tasks

Structured workflow tasks with dependency tracking:

```typescript
interface DAGTask {
  id: string
  name: string
  description: string
  status: "pending" | "in_progress" | "completed" | "blocked" | "failed"
  dependencies: string[]
  priority: "critical" | "high" | "medium" | "low"
  blocking: boolean
  estimated_tokens?: number
  actual_tokens?: number
  assigned_to?: ToolType
}
```

Tasks are extracted from:
- `TASK: Name - description` patterns
- Markdown task lists: `- [x] Done`, `- [~] In progress`, `- [!] Blocked`

## Integration

### With Guard System

The continuity module integrates with the guard system for automatic handoffs at threshold:

```typescript
// In guard compaction
if (action === "handoff") {
  const context = await ContextExtractor.extract({...})
  const baton = HandoffEmitter.emitJSON({ context, compact_reason: "threshold" })
  const report = await CIGates.validate(baton)
  
  if (report.passed) {
    await emitBaton({...})
  } else {
    // Log validation failures
    log.error("Handoff validation failed", report)
  }
}
```

### With TUI

Session discovery results can be displayed in the TUI for manual handoff selection.

## Testing

```bash
# Run continuity tests
bun test test/continuity/

# Specific test files
bun test test/continuity/types.test.ts
bun test test/continuity/handoff-emitter.test.ts
bun test test/continuity/dag-tasks.test.ts
bun test test/continuity/gates.test.ts
```

## Future Work

- [ ] Full SQLite parsers for OpenCode/Cursor
- [ ] Claude Code conversation parsing
- [ ] Automatic session resumption in target tools
- [ ] Cross-tool DAG task assignment
- [ ] Allternit conventions schema validation
