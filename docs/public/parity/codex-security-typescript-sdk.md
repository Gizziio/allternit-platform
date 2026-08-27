# Codex Security TypeScript SDK parity

The Codex Security TypeScript SDK models preflight, scan targets, scan lifecycle, results, cancellation, and follow-up. `@allternit/sdk` has a TypeScript agent runtime, tools, providers, and managed-session APIs, but no security scanner class or security result types. The examples below show a custom composition and label missing contracts explicitly.

## Set up the SDK

Use the Allternit SDK's harness and Tool Belt for an application-owned review agent:

```typescript
import {
  AllternitHarness,
  ToolRegistry,
  NativeToolBelt,
} from '@allternit/sdk/ai-runtime'

const registry = new ToolRegistry()
const tools = new NativeToolBelt(registry)
const harness = new AllternitHarness({
  mode: 'local',
  local: { baseURL: 'http://localhost:11434' },
  permissionPolicy: {
    name: 'read-only-security-review',
    active: true,
    rules: [
      { tool: 'text_editor', action: 'deny' },
      { tool: 'bash', action: 'ask' },
    ],
  },
})
```

Consult the installed package types for the exact `HarnessConfig` accepted by the pinned SDK version. There is no `SecurityClient` export.

## Check inputs with preflight

**Not applicable / roadmap:** no security preflight API validates Git state, target ranges, language support, credentials, or expected cost. Applications should validate repository existence, immutable base/head revisions, readable selected paths, provider authentication, and sandbox policy before invoking an agent.

## Choose a scan target; Scan the working tree; Scan committed changes; Scan selected paths

The SDK has no `ScanTarget` union. Build target context in the host application with Git and pass only the intended diff/files to a read-only agent:

```typescript
type ReviewTarget =
  | { kind: 'working-tree' }
  | { kind: 'commits'; base: string; head: string }
  | { kind: 'paths'; paths: string[] }
```

Validate revisions and paths before tool execution, reject traversal outside the repository, and record the resolved commit IDs. Target discovery and diff acquisition are application responsibilities.

## Add a security knowledge base

Allternit has generic memory stores, repository instructions, web/document tools, and MCP attachments. None is a typed security knowledge base. A custom application can attach a read-only MCP server containing policies and architecture documents:

```typescript
await tools.attachMcpServer({
  serverId: 'security-kb',
  listTools: async () => [{
    name: 'read_policy',
    description: 'Read an approved security policy',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  }],
  callTool: async (_name, args) => ({ content: await policies.read(String(args.id)) }),
})
```

Attached MCP tools are namespaced and registered with strict schemas. Authorization, document provenance, and redaction remain the application's responsibility.

## Add scan and follow-up instructions

Pass a security-specific system/user instruction to the harness and include the resolved target context. Follow-up is an ordinary subsequent message in the same application session. There are no separately typed `scanInstructions` or `followUpInstructions` fields.

## Run a scan

**Not applicable / roadmap:** `AllternitHarness` can run a model/tool loop, but calling it a scan would overstate the contract. A custom implementation should require read-only tools, a closed JSON Schema for findings, explicit target metadata, confidence rules, and independent tests. Allternit's built-in, supported user workflow is `/security-review` in gizzi-code.

## Select deep mode

No security `deep` mode exists. The harness supports model choice and reasoning options, and managed sessions support token/turn/tool budgets, but these are generic inference controls rather than scan-depth or coverage guarantees.

## Track or cancel a scan

There is no SDK `Scan` handle. A service can represent the run as a managed session: create it at `POST /api/v1/beta/sessions`, append progress events, and interrupt it through the session interrupt endpoint. Archive with `DELETE /beta/sessions/:id` when complete. This supplies lifecycle plumbing, not scanner semantics or resumability.

```bash
curl -X POST http://localhost:8013/api/v1/beta/sessions \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name":"custom-security-review","budget":{"max_tokens":20000,"max_turns":25,"max_tool_calls":60}}'
```

## Work with scan results

No `Finding`, `ThreatModel`, `Patch`, `Coverage`, or `ScanResult` security types ship in the SDK. Define and validate an application-owned strict schema, and preserve provenance:

```typescript
interface SecurityFinding {
  id: string
  file: string
  line: number
  severity: 'high' | 'medium'
  category: string
  description: string
  exploitScenario: string
  recommendation: string
  confidence: number
  baseCommit: string
  headCommit: string
}
```

Treat model output as untrusted until schema validation and human review. Stable fingerprinting, status transitions, SARIF export, and patch linkage are roadmap work.

## Handle scan errors

Handle provider/authentication failures, tool denials, invalid model output, budget exhaustion, cancellation, and partial context separately. The harness middleware includes retry/fallback helpers, while the API uses stable errors such as `allternit.authentication_failed`, `allternit.permission_denied`, `allternit.rate_limited`, `allternit.budget_exceeded`, and `allternit.upstream_error`. Do not turn a partial or failed run into an empty "no findings" result.
