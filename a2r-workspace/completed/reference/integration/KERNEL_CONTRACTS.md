# A2R Kernel Contracts

**Phase:** 2 (Kernel Contracts)  
**Last Updated:** 2026-01-31  
**Status:** Complete

## Overview

This document defines the formal contracts between A2R Kernel and the runtime bridge. These contracts enable A2R to govern runtime behavior without modifying core code.

---

## Contract 1: WIH (Work-In-Hand) Schema

**Purpose:** Standardized task representation for dependency tracking and work management.

**Schema:** `packages/a2r-kernel/src/schemas/wih.schema.json`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g., `P2-T0200`, `A2R-0001`) |
| `title` | string | Human-readable task title (max 200 chars) |
| `status` | enum | `draft`, `ready`, `in_progress`, `blocked`, `review`, `complete`, `cancelled` |
| `createdAt` | ISO8601 | Creation timestamp |
| `version` | semver | Schema version (e.g., `1.0.0`) |

### Dependency Fields

| Field | Type | Description |
|-------|------|-------------|
| `blockedBy` | string[] | WIH IDs that must complete first |
| `blocks` | string[] | WIH IDs waiting on this item |

### Routing Configuration

```json
{
  "routing": {
    "preToolUse": ["wih-gated", "default"],
    "postToolUse": ["audit-logger"],
    "fileAccessCheck": ["default", "read-only"]
  }
}
```

### Example WIH

```json
{
  "id": "P2-T0200",
  "title": "Define WIH schema",
  "description": "Create JSON Schema for Work-In-Hand items",
  "status": "complete",
  "priority": 80,
  "blockedBy": [],
  "blocks": ["P2-T0201"],
  "assignee": "Kernel-Architect",
  "phase": "2",
  "tags": ["kernel", "schema", "infrastructure"],
  "receiptRefs": ["RCPT-a1b2c3d4"],
  "artifacts": [
    { "path": "packages/a2r-kernel/src/schemas/wih.schema.json", "type": "schema" }
  ],
  "createdAt": "2026-01-31T20:10:00Z",
  "updatedAt": "2026-01-31T20:15:00Z",
  "version": "1.0.0",
  "routing": {
    "preToolUse": ["wih-gated"],
    "fileAccessCheck": ["default"]
  }
}
```

---

## Contract 2: Receipt Schema

**Purpose:** Cryptographic proof of work completion with audit trail.

**Schema:** `packages/a2r-kernel/src/schemas/receipt.schema.json`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Receipt ID (format: `RCPT-[a-z0-9]+`) |
| `wihId` | string | Reference to completed WIH |
| `status` | enum | `complete`, `partial`, `rejected`, `superseded` |
| `timestamp` | ISO8601 | Completion timestamp |
| `attestations` | array | Cryptographic proofs (min 1) |
| `artifacts` | array | Output artifacts with checksums |

### Attestation Types

| Type | Description |
|------|-------------|
| `git-commit` | Git SHA as proof |
| `test-pass` | Test suite execution proof |
| `review-approval` | Code review sign-off |
| `manual-sign` | Human signature |
| `checksum` | File integrity hash |
| `signature` | Cryptographic signature |

### Example Receipt

```json
{
  "id": "RCPT-a1b2c3d4",
  "wihId": "P2-T0200",
  "status": "complete",
  "timestamp": "2026-01-31T20:15:00Z",
  "duration": 300000,
  "agent": "Kernel-Architect",
  "attestations": [
    {
      "type": "git-commit",
      "value": "abc123def456",
      "agent": "Kernel-Architect",
      "timestamp": "2026-01-31T20:15:00Z"
    },
    {
      "type": "test-pass",
      "value": "routing.test.ts:12 passed",
      "agent": "vitest"
    }
  ],
  "artifacts": [
    {
      "path": "packages/a2r-kernel/src/schemas/wih.schema.json",
      "checksum": "a1b2c3d4e5f6...",
      "type": "schema"
    }
  ],
  "metrics": {
    "linesAdded": 150,
    "linesRemoved": 0,
    "filesChanged": 1,
    "testsPassed": 12,
    "testsFailed": 0
  },
  "notes": "Schema validates against JSON Schema Draft 07"
}
```

---

## Contract 3: Routing Function Interface

**Purpose:** Pluggable decision functions for tool execution and file access.

### Type Signature

```typescript
type RoutingFunction<TContext, TResult> = (
  context: TContext,
  kernel: A2RKernel
) => TResult | Promise<TResult>;

type RoutingDecision = 'allow' | 'deny' | 'modify' | 'delegate';

interface RoutingResult {
  decision: RoutingDecision;
  reason?: string;
  modifiedParams?: Record<string, unknown>;
  delegateTo?: string;
  auditLog?: Record<string, unknown>;
}
```

### Tool Context

```typescript
interface ToolContext {
  toolName: string;
  toolParams: Record<string, unknown>;
  sessionId: string;
  agentId: string;
  workspaceRoot: string;
  wihId?: string;
}
```

### File Context

```typescript
interface FileContext {
  operation: 'read' | 'write' | 'delete' | 'execute';
  path: string;
  resolvedPath?: string;
  sessionId: string;
  agentId: string;
  wihId?: string;
}
```

### Built-in Routers

| Router | Purpose | Location |
|--------|---------|----------|
| `preToolUseRouter` | Tool allowlist/denylist | `src/routing/index.ts` |
| `wihGatedRouter` | Enforce "no work without ticket" | `src/routing/index.ts` |
| `fileAccessRouter` | Path traversal protection | `src/routing/index.ts` |
| `readOnlyFileRouter` | Read-only mode enforcement | `src/routing/index.ts` |

---

## Contract 4: Runtime Integration Points

### Seam 1: Session Spawn (src/gateway/client.ts:94-99)

**Injection Point:** Gateway client initialization

```typescript
// Runtime: src/gateway/client.ts
class GatewayClient {
  constructor(config: GatewayConfig) {
    // A2R INJECTION POINT
    // Inject WIH initialization here
    this.kernel = config.a2rKernel;
    this.wihId = config.initialWihId;
  }
}
```

**A2R Contract:**
- Kernel must provide `createSession(wihId)` method
- Session creation blocked if no valid WIH

### Seam 2: Tool Execution (src/agents/tool-policy.ts)

**Injection Point:** Tool invocation pipeline

```typescript
// A2R Wrapper
async function a2rToolWrapper(
  toolName: string,
  params: unknown,
  context: ToolContext
): Promise<unknown> {
  // 1. Pre-flight routing
  const decision = await kernel.routeToolUse(context);
  
  if (decision.decision === 'deny') {
    throw new Error(`Tool ${toolName} denied: ${decision.reason}`);
  }
  
  if (decision.decision === 'delegate') {
    return await delegateToLawLayer(toolName, params, decision);
  }
  
  // 2. Execute original tool
  const result = await originalTool.execute(
    decision.modifiedParams || params
  );
  
  // 3. Post-flight routing
  await kernel.routePostToolUse({ ...context, result });
  
  return result;
}
```

### Seam 3: File Access (src/infra/fs-safe.ts:38-100)

**Injection Point:** File operation wrapper

```typescript
// Runtime: src/infra/fs-safe.ts
export async function openFileWithinRoot(params: {
  rootDir: string;
  relativePath: string;
}): Promise<FileHandle> {
  // A2R INJECTION POINT
  const routing = await kernel.routeFileAccess({
    operation: 'read',
    path: params.relativePath,
    resolvedPath: path.resolve(params.rootDir, params.relativePath),
    workspaceRoot: params.rootDir,
    // ... session context
  });
  
  if (routing.decision !== 'allow') {
    throw new SafeOpenError("a2r-denied", routing.reason);
  }
  
  // ... original implementation
}
```

---

## Version Compatibility

| A2R Kernel | Runtime | Contract Version |
|------------|----------|------------------|
| 1.0.x | >= 0.1.0 | 1.0.0 |

---

## Migration Notes

### From 0.x to 1.0.0

- `taskId` renamed to `wihId`
- Added `routing` configuration object
- Receipt `signatures` renamed to `attestations`
- Routing functions now require `kernel` parameter

---

## Validation

Validate schemas using:

```bash
cd packages/a2r-kernel
pnpm test              # Run unit tests
pnpm typecheck         # TypeScript validation
```

---

## References

- WIH Schema: `packages/a2r-kernel/src/schemas/wih.schema.json`
- Receipt Schema: `packages/a2r-kernel/src/schemas/receipt.schema.json`
- Types: `packages/a2r-kernel/src/types/index.ts`
- Routing: `packages/a2r-kernel/src/routing/index.ts`
- Implementation: `packages/a2r-kernel/src/index.ts`
