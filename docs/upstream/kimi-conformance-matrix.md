# Kimi behavioral conformance matrix

This matrix records the durable behaviors Allternit expects after adapting the audited Kimi Code
implementation. “Test” names are source-level conformance fixtures; execution is a release gate.

| Capability | Required behavior | Conformance source |
|---|---|---|
| Provider errors | Provider/model/code/retryability survive to session errors | `test/provider/provider.test.ts`, `test/session/message-v2.test.ts` |
| Permission policy | Deny precedence, auto/dontAsk semantics, sensitive-path review | `test/permission/next.test.ts` |
| Goals | One active goal, budgets, crash demotion, completion audit, blocked threshold | goal-engine tests and `docs/upstream/background-scenarios.md` |
| Swarm | Adaptive capacity, ordered results, same-agent retry, parent ownership | adaptive scheduler and swarm tests |
| Background work | Durable terminal states, cancellation, steering, print drain limits | `test/session/background-task.test.ts` |
| Skills | Deterministic precedence/collisions, nested opt-in, governed lifecycle | `test/skill/catalog-precedence.test.ts` |
| Replay | Monotonic cursor/head, bounded page, message/part/request trace | `test/session/trace.test.ts` |
| Context projection | Reorder/synthesize/drop/merge repairs are pure and deterministic | `test/session/context-projector.test.ts` |
| Context accounting | System, messages, tool schemas, cache, reserved output, and remaining window are measured under one contract | `test/session/context-accounting.test.ts` |
| Tool execution | One dispatcher owns lifecycle hooks; same-step duplicates coalesce and cross-step repeats receive staged guidance | `test/tools/dedupe-selection.test.ts`, `docs/upstream/hook-event-map.md` |
| Dynamic tools | MCP schemas remain deferred until selected, and selected state survives later model steps/history reconstruction | `test/tools/dedupe-selection.test.ts` |
| MCP | Qualified stable names, collision suffixes, local-first bundled startup | `test/mcp/catalog.test.ts`, `test/mcp/bundled.test.ts` |
| ACP | Orthogonal model/thinking/mode selectors and dynamic thinking visibility | `test/acp/config-options.test.ts` |
| Provider protocols | Kimi, OpenAI Responses, Anthropic, and Google request transforms remain stable | `test/provider/protocol-goldens.test.ts` |
| Contract transports | HTTP and in-memory session facades produce identical canonical results and accept versioned envelopes | `test/protocol/transport-conformance.test.ts` |
| Workspace identity | Symlink/path aliases fold to one ID and deletion remains reversible | `test/workspace/registry.test.ts` |
| Agent scratchpad | Private session isolation, explicit root-session sharing, path/symlink containment, quotas, metadata-only diagnostics, and deletion cleanup | `test/session/scratchpad.test.ts` |
| Server boundary | Request/protocol IDs, safe errors, Host validation, headers, rate limits, and AsyncAPI are present | `runtime/server/server.ts` |
| Native packaging | Target-specific Parcel sidecar layout | `test/package/native-assets.test.ts` |
| Telemetry privacy | Identity, URL, tokens, and paths are removed before sink delivery | `test/telemetry/privacy.test.ts` |
| Support export | Bounded logs, secret/home redaction, explicit manifest | `docs/upstream/support-export-manifest.md` |

Release gates also require scoped `git diff --check`, JSON manifest parsing, native artifact manifest
verification, and manual VS Code/ACP smoke runs. Builds, typechecks, tests, and dev servers were not
run during implementation because repository instructions prohibit them during task work.
