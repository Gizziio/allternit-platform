# Kimi Code upstream tracking

Allternit uses the MIT-licensed Moonshot AI Kimi Code repository as an implementation and test
reference for selected runtime capabilities.

- Upstream: `MoonshotAI/kimi-code`
- Audited commit: `3086e47`
- Audited release: `0.27.0`
- License: MIT, Copyright 2026 Moonshot AI
- Local audit date: 2026-07-18

This file records source-derived work. An entry marked **behavioral reference** contains an
Allternit implementation informed by upstream behavior but no copied source. An entry marked
**derived** requires the upstream license/copyright notice in the derived directory and an entry in
the repository `THIRD_PARTY_NOTICES.md`.

| Allternit path | Upstream path | Kind | Notes |
|---|---|---|---|
| `cmd/gizzi-code/src/runtime/providers/error.ts` | `packages/agent-core-v2/src/errors`, `app/llmProtocol/errors.ts` | Behavioral reference | Preserve provider identity and structured error information across the session event boundary. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/session/message-v2.ts` | `packages/agent-core-v2/src/errors` | Behavioral reference | Convert plain provider and stream failures into structured session API errors instead of `Unknown`. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/tools/builtins/truncation.ts` | `packages/agent-core-v2/src/agent/toolResultTruncation` | Behavioral reference | Prevent provider-native structured MCP content from bypassing spill-to-disk truncation. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/tools/mcp/bundled.ts` | `packages/agent-core-v2/src/agent/mcp` | Behavioral reference | Make MCP startup local-first and omit unavailable optional servers instead of blocking startup. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/providers/adapters/models.ts`, `provider.ts` | `apps/kimi-code/scripts/update-catalog.mjs`, provider catalog flows | Behavioral reference | Validate catalog entries independently, preserve healthy providers, reject corrupt refreshes, and fail visibly when a pinned model is unavailable. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/automation/goal-engine.ts`, goal tools and migrations | `packages/agent-core-v2/src/agent/goal` | Behavioral reference | Merge hard budgets, crash demotion, one-active-goal ownership, queue promotion, tool-signaled outcomes, and the three-turn blocked audit into Allternit's milestone/validation engine. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/tools/guard/permission/next.ts`, `runtime/loop/agent.ts` | `packages/agent-core-v2/src/agent/permissionPolicy`, `tool/path-access.ts` | Behavioral reference | Make cross-policy precedence explicit so configured denial survives session approvals/auto mode, auto cannot ask questions, dontAsk denies unresolved prompts, and sensitive/git-control paths require review by default. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/agents/adaptive-run-batch.ts` | `packages/agent-core-v2/src/session/swarm/agentRunBatch.ts` | Derived | Isolated adaptive burst/ramp scheduler with provider-rate-limit capacity control, same-agent retry, cancellation, timeout, and ordered partial results; adapted to an Allternit launcher contract. |
| `cmd/gizzi-code/src/runtime/agents/subagent-run-contract.ts`, `runtime/tools/builtins/task.ts`, agent config | `packages/agent-core-v2/src/session/subagent`, `app/agentProfileCatalog` | Behavioral reference | Require parent ownership and profile continuity on resume, inherit durable permission mode, and issue bounded continuation turns when a profile's final handoff is too brief. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/session/background-task.ts`, `session/prompt.ts`, `cli/commands/run.ts` | `packages/agent-core-v2/src/agent/task`, `apps/kimi-code/src/cli/v2/run-v2-print.ts` | Behavioral reference | Durable task ownership/terminal states, completion-driven synthetic steering, and explicit print exit/drain/steer ceilings over Allternit's canonical session loop. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/tools/builtins/agent-swarm.ts` | `packages/agent-core-v2/src/session/swarm/sessionSwarmService.ts` | Behavioral reference | Connect the derived adaptive batch scheduler to Allternit's child-session launcher, preserving parent/profile ownership, same-session retry, summary policy, cancellation, and ordered partial results. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/skills/skill.ts`, `growth.ts`, `importer.ts` | `packages/agent-core-v2/src/app/skillCatalog` | Behavioral reference | Deterministic source precedence and collision diagnostics, bounded opt-in sub-skills, conservative import previews, and versioned evaluate/approve/activate/rollback. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/session/context-projector.ts`, `trace.ts`, `support-bundle.ts`, `compaction.ts` | `packages/agent-core-v2/src/agent/contextProjector`, `fullCompaction`, `app/sessionExport` | Behavioral reference | Pure wire-valid repair, cursor replay/request traces, bounded redacted ZIP export, and empty/truncated/overflow compaction recovery with durable TODO preservation. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/tools/mcp/index.ts`, `auth.ts`, server MCP routes | `packages/agent-core-v2/src/agent/mcp`, `packages/oauth` | Behavioral reference | PKCE/state OAuth, atomic URL-bound credentials with revocation tombstones, explicit auth lifecycle routes, qualified collision-safe tool names, and preserved server/tool identity. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/tools/builtins/read.ts`, `session/processor.ts` | `packages/agent-core-v2/src/agent/media`, Kimi Code read/media tools | Behavioral reference | Bounded image normalization, region reads, explicit full-resolution refusal, and read-side provider recovery that never mutates durable history. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/integrations/acp/agent.ts` | `packages/acp-adapter/src/config-options.ts`, `server.ts` | Behavioral reference | Add unified model/thinking/mode config options and update notifications while retaining legacy fields for older ACP clients. No upstream source copied. |
| `cmd/gizzi-code/sdks/vscode`, platform session/permission/tool UI files | `apps/vscode`, `apps/kimi-code/src/tui` | Behavioral reference | Workspace/selection editor bridge, readiness/reconnect status, per-session scroll restoration, minimizable approvals, delayed background affordance, and working-directory presentation. No upstream source copied. |
| `cmd/gizzi-code/script/native-assets.mjs`, build pipeline, file watcher resolver | `apps/kimi-code/scripts/native` | Behavioral reference | Ship platform-native `.node` dependencies as hashed sidecars and resolve them before package fallback, adapting Kimi's SEA asset-manifest principle to the existing Bun compiler. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/telemetry` | `packages/agent-core-v2/src/app/telemetry`, `packages/telemetry` | Behavioral reference | Typed reviewed event registry, bounded pre-sink queue, explicit opt-outs, and outbound identity/URL/token/path cleaning. No upstream source copied. |
| `surfaces/ai.allternit.com/src/pages/SessionsPage.tsx` | `apps/kimi-inspect` | Behavioral reference | Add a live cursor/head trace inspector and redacted support export to the existing session surface. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/tools/{dispatch,dedupe,selection}.ts`, session tool resolution | `packages/agent-core-v2/src/agent/{toolExecutor,toolDedupe,toolSelect}` | Behavioral reference | Route primary and MCP calls through one lifecycle boundary, coalesce exact same-step side effects, issue staged repeat guidance, and optionally defer MCP schemas until selected. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/hooks`, session/permission/compaction/subagent/background hook points | `packages/agent-core-v2/src/{agent,session}/externalHooks` | Behavioral reference | Implement the sixteen-event lifecycle, fail-open command semantics, exit-code blocking, concurrent deduplicated hook execution, and event-target matching. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/session/context-accounting.ts` | `packages/agent-core-v2/src/agent/contextMemory` | Behavioral reference | Centralize estimated/provider context accounting across messages, system prompts, schemas, cache, reserved output, and remaining model window. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/protocol`, server protocol middleware and AsyncAPI | `packages/protocol`, `packages/klient`, `packages/kap-server` | Behavioral reference | Add versioned envelopes/errors/pages/WS controls, one HTTP/in-memory session facade, transport conformance, request IDs, safe errors, Host checks, rate limits, and event/replay documentation. No upstream source copied. |
| `cmd/gizzi-code/src/runtime/workspace/registry.ts` | `packages/agent-core-v2/src/app/workspaceRegistry` | Behavioral reference | Cross-process locked atomic registry updates, canonical path/alias folding, legacy duplicate healing, and reversible soft deletion. No upstream source copied. |
| `cmd/gizzi-code/test/provider/protocol-goldens.test.ts`, provider decision record | `packages/kosong` | Behavioral reference | Retain Allternit's broader adapter boundary but make Kimi/OpenAI/Anthropic/Google goldens the replacement gate for any future protocol engine. No upstream source copied. |

## Update procedure

1. Record the exact upstream commit before copying or adapting behavior.
2. Port upstream tests or create equivalent fixtures before changing runtime ownership.
3. Keep copied/derived modules isolated enough to diff against upstream.
4. Mark copied code as **derived** in the table above and update `THIRD_PARTY_NOTICES.md`.
5. Review upstream changes monthly while Kimi-derived work is active.
