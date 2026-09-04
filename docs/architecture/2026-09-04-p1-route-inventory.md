# P1 Route Inventory — control-plane handlers for allternit-api routes

- **Date:** 2026-09-04
- **Branch:** `session/routing` (worktree `allternit-session-routing`)
- **Status:** Draft for P1 planning. Analysis only — no source changes.
- **Scope:** `surfaces/ai.allternit.com/src` (web client) × `cmd/allternit-api` (:8013, "the gateway") × `cmd/allternit-cloud-api` (control plane).

## How to read this doc

- **Client paths** were extracted mechanically from every quoted `/api/…`/`/rails/…` literal and template-literal prefix in `surfaces/ai.allternit.com/src` (`.ts`/`.tsx`, excluding `*.test.*`, mocks, stories, fixtures), then normalized (`:param` and `${…}` → `{X}`). Methods were sniffed from the call site (`api.get/post/…`, `fetch(... method: …)`, `EventSource`); `?` means the extractor could not prove the method.
- **Ownership** was computed by rebuilding the effective route set of each backend: for :8013, every `.route(...)` literal in each module file resolved through its mount point in `cmd/allternit-api/src/main.rs` (the `v1_routes` merge list → `/api/v1`, per-module `.nest(...)` → prefix, plain `.merge(...)` → literal is already absolute); for cloud-api, literals are absolute in `cmd/allternit-cloud-api/src/lib.rs` and `routes/*.rs`. All load-bearing rows (flagged namespaces, orphans, both-claimed paths) were then verified by hand against the source; per-row evidence is in the §2 table.
- **Env flags** (all in `surfaces/ai.allternit.com/src/lib/env.ts`):

| Flag helper | Env var | Gate namespace |
|---|---|---|
| `isRunnerAiChatEnabled()` (env.ts:137) | `NEXT_PUBLIC_ALLTERNIT_RUNNER_CHAT` | `POST /api/chat` (runner chat) |
| `isRunnerOperatorModeEnabled()` (env.ts:126) | `NEXT_PUBLIC_ALLTERNIT_RUNNER_OPERATOR` | `POST /api/v1/operator/execute` + events |
| `isAgentSessionsApiEnabled()` (env.ts:149) | `NEXT_PUBLIC_ALLTERNIT_AGENT_SESSIONS_API` | `/api/v1/agent-sessions*`, canvases |
| `isOfficeApiEnabled()` (env.ts:160) | `NEXT_PUBLIC_ALLTERNIT_OFFICE_API` | `/api/v1/office/bindings` |
| `isBetaApiEnabled()` (env.ts:172) | `NEXT_PUBLIC_ALLTERNIT_BETA_API` | `/api/v1/beta/*` |
| `isRailsApiEnabled()` (env.ts:184) | `NEXT_PUBLIC_ALLTERNIT_RAILS_API` | `/api/rails/*` |
| `isRuntimeApiEnabled()` (env.ts:187, added by parallel work during this analysis) | `NEXT_PUBLIC_ALLTERNIT_RUNTIME_API` | `/api/v1/runtime/*` |

The first six default **OFF** because the handlers live only on :8013, which is not publicly reachable — they are exactly the P1 target set.

## Counts (TL;DR)

- **522 distinct client-called paths** (after dropping 13 non-route helper literals such as `/api`, `/api/v1`, `/api/*` used as base-URL building blocks).
- Ownership split: **:8013 only 269 · cloud-api only 28 · both 12 · orphan 213**.
- Orphans are dominated by three buckets: ~26 contract-only oRPC spec paths (`/api/bots/:botId/goals…`, no fetch transport wired), ~25 rails-service-shaped paths (`/api/rails/plan…` etc. that only the standalone rails service on :3011 serves, not the :8013 `/api/rails` router), and ~20 genuinely unserved paths (`/api/chat`, `/api/v1/operator/*`, `/api/v1/sessions*`, `/api/v1/photon/*`).

---

## 1. Web client call inventory

Every distinct API path called from `surfaces/ai.allternit.com/src`, grouped by namespace. Caller is the first observed call site (multiple call sites were collapsed). Flag column uses the helpers from `src/lib/env.ts` (see table above); `—` means the call is live/ungated today.


#### `a2ui` (9)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/a2ui/actions` | `integration/a2ui-client.ts:148` | — |
| GET | `/api/v1/a2ui/capsules` | `integration/a2ui-client.ts:202` | — |
| ? | `/api/v1/a2ui/capsules/{X}` | `integration/a2ui-client.ts:209` | — |
| ? | `/api/v1/a2ui/capsules/{X}/launch` | `integration/a2ui-client.ts:226` | — |
| POST | `/api/v1/a2ui/generate` | `integration/a2ui-client.ts:253` | — |
| ? | `/api/v1/a2ui/sessions` | `integration/a2ui-client.ts:97` | — |
| DELETE | `/api/v1/a2ui/sessions/{X}` | `integration/a2ui-client.ts:110` | — |
| ? | `/api/v1/a2ui/sessions/{X}/data` | `integration/a2ui-client.ts:127` | — |
| GET | `/api/v1/a2ui/sessions?chat_id={X}` | `integration/a2ui-client.ts:117` | — |

#### `aci` (5)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| POST | `/api/aci/approve/{X}` | `capsules/browser/browserAgent.store.ts:910` | — |
| POST | `/api/aci/approve/{X}?deny=true` | `capsules/browser/browserAgent.store.ts:919` | — |
| GET/POST | `/api/aci/run` | `capsules/browser/browserAgent.store.ts:530` | — |
| POST | `/api/aci/stop/{X}` | `capsules/browser/browserAgent.store.ts:883` | — |
| SSE | `/api/aci/stream/{X}` | `capsules/browser/browserAgent.store.ts:546` | — |

#### `admin` (5)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/admin/fabric/nodes` | `lib/cloud-console-api.ts:192` | — |
| ? | `/api/v1/admin/fabric/nodes/enrollment-token` | `lib/cloud-console-api.ts:175` | — |
| ? | `/api/v1/admin/fabric/nodes/enrollment-tokens` | `lib/cloud-console-api.ts:182` | — |
| ? | `/api/v1/admin/fabric/nodes/{X}/approve` | `lib/cloud-console-api.ts:198` | — |
| ? | `/api/v1/admin/fabric/nodes/{X}/reject` | `lib/cloud-console-api.ts:204` | — |

#### `agent-chat` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/agent-chat` | `lib/agents/native-agent-api.ts:28` | — |

#### `agent-control` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/agent-control` | `lib/agents/scheduled-jobs.service.ts:87` | AGENT_SESSIONS |

#### `agent-email` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/agent-email/status` | `lib/bots/agent-identity.service.ts:52` | — |

#### `agent-runtimes` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/agent-runtimes` | `views/runtime/AgentRuntimeDashboard.tsx:45` | — |
| DELETE | `/api/v1/agent-runtimes?id={X}` | `views/runtime/AgentRuntimeDashboard.tsx:67` | — |

#### `agent-sessions` (9)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/agent-sessions` | `lib/env.ts:142` | — |
| ? | `/api/v1/agent-sessions/sync` | `lib/agents/mode-session-store.ts:2218` | AGENT_SESSIONS |
| GET, POST | `/api/v1/agent-sessions/{X}/canvases` | `lib/agents/native-agent-api.ts:1019` | AGENT_SESSIONS |
| GET/PATCH/DELETE | `/api/v1/agent-sessions/{X}` | `lib/agents/native-agent-api.ts:501` | AGENT_SESSIONS |
| GET, POST | `/api/v1/agent-sessions/{X}/messages` | `lib/agents/native-agent-api.ts:609` | AGENT_SESSIONS |
| POST | `/api/v1/agent-sessions/{X}/abort` | `lib/agents/native-agent-api.ts:881` | AGENT_SESSIONS |
| POST | `/api/v1/agent-sessions/{X}/revert` | `lib/agents/native-agent-api.ts:1123` | AGENT_SESSIONS |
| POST | `/api/v1/agent-sessions/{X}/unrevert` | `lib/agents/native-agent-api.ts:1133` | AGENT_SESSIONS |
| POST | `/api/v1/agent-sessions/{X}/compact` | `lib/agents/native-agent-api.ts:1142` | AGENT_SESSIONS |

#### `agent-templates` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/agent-templates` | `lib/agents/agent-advanced.store.ts:550` | — |
| DELETE | `/api/v1/agent-templates/{X}` | `lib/agents/agent-advanced.store.ts:587` | — |

#### `agents` (35)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/agents` | `integration/api-client.ts:887` | — |
| GET/POST | `/api/v1/agents/from-template` | `lib/agents/agent-advanced.store.ts:602` | — |
| GET/POST | `/api/v1/agents/metrics?{X}` | `lib/agents/agent-metrics.store.ts:53` | — |
| GET/POST | `/api/v1/agents/operations/benchmarks/history` | `views/settings/AgentOpsPanel.tsx:149` | — |
| GET/POST | `/api/v1/agents/operations/evaluations` | `views/settings/AgentOpsPanel.tsx:125` | — |
| GET/POST | `/api/v1/agents/operations/evaluations/{X}/results` | `views/settings/AgentOpsPanel.tsx:144` | — |
| POST | `/api/v1/agents/operations/evaluations/{X}/run` | `views/settings/AgentOpsPanel.tsx:139` | — |
| GET/POST | `/api/v1/agents/operations/factory/tasks` | `views/settings/AgentOpsPanel.tsx:154` | — |
| POST | `/api/v1/agents/operations/factory/tasks/{X}/changes/{X}/approve` | `views/settings/AgentOpsPanel.tsx:168` | — |
| POST | `/api/v1/agents/operations/factory/tasks/{X}/changes/{X}/reject` | `views/settings/AgentOpsPanel.tsx:173` | — |
| POST | `/api/v1/agents/operations/gc/agents/{X}/run?projectId={X}` | `views/settings/AgentOpsPanel.tsx:230` | — |
| POST | `/api/v1/agents/operations/gc/cleanup?projectId={X}` | `views/settings/AgentOpsPanel.tsx:220` | — |
| GET/POST | `/api/v1/agents/operations/gc/history?projectId={X}` | `views/settings/AgentOpsPanel.tsx:225` | — |
| GET/POST | `/api/v1/agents/operations/gc/policies/{X}?projectId={X}` | `views/settings/AgentOpsPanel.tsx:211` | — |
| GET/POST | `/api/v1/agents/operations/gc/policies?projectId={X}` | `views/settings/AgentOpsPanel.tsx:206` | — |
| GET/POST | `/api/v1/agents/operations/gc/queue?projectId={X}` | `views/settings/AgentOpsPanel.tsx:201` | — |
| GET/POST | `/api/v1/agents/prototype` | `views/AgentStudioView.tsx:172` | — |
| GET/POST | `/api/v1/agents/test` | `components/agents/AgentTestingPlayground.tsx:145` | — |
| ? | `/api/v1/agents/{X}` | `integration/api-client.ts:902` | — |
| GET/POST | `/api/v1/agents/{X}/config` | `lib/agents/agent-advanced.store.ts:633` | — |
| ? | `/api/v1/agents/{X}/connectors/resolve` | `lib/agents/agent-connectors-resolver.ts:42` | — |
| ? | `/api/v1/agents/{X}/identity/email` | `lib/bots/agent-identity.service.ts:29` | — |
| ? | `/api/v1/agents/{X}/identity/phone` | `lib/bots/agent-identity.service.ts:36` | — |
| ? | `/api/v1/agents/{X}/identity/wallet` | `lib/bots/agent-wallet-factory.ts:44` | — |
| ? | `/api/v1/agents/{X}/runs` | `integration/api-client.ts:925` | — |
| ? | `/api/v1/agents/{X}/runtime/provision` | `lib/agent-cloud-api.ts:47` | — |
| ? | `/api/v1/agents/{X}/runtime/terminate` | `lib/agent-cloud-api.ts:56` | — |
| ? | `/api/v1/agents/{X}/secrets/resolve` | `lib/agents/agent-secrets-resolver.ts:44` | — |
| GET/POST | `/api/v1/agents/{X}/subagents` | `lib/agents/agent-advanced.store.ts:171` | — |
| GET/POST | `/api/v1/agents/{X}/subagents/{X}` | `lib/agents/agent-advanced.store.ts:205` | — |
| GET/POST | `/api/v1/agents/{X}/subagents/{X}/spawn` | `lib/agents/agent-advanced.store.ts:246` | — |
| GET/POST | `/api/v1/agents/{X}/workflows` | `lib/agents/agent-advanced.store.ts:429` | — |
| GET/POST | `/api/v1/agents/{X}/workflows/{X}` | `lib/agents/agent-advanced.store.ts:465` | — |
| GET/POST | `/api/v1/agents/{X}/workflows/{X}/execute` | `lib/agents/agent-advanced.store.ts:507` | — |
| POST | `/api/v1/agents/{X}/workspace/initialize` | `views/agent-view/components/CreateAgentForm.tsx:594` | — |

#### `analytics` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| POST | `/api/analytics/csp-violation` | `lib/ai/mcp/sandbox-client.ts:202` | — |

#### `approvals` (5)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET | `/api/v1/approvals/pending` | `lib/governance/policy.service.ts:203` | — |
| GET | `/api/v1/approvals/{X}` | `lib/governance/policy.service.ts:210` | — |
| POST | `/api/v1/approvals/{X}/cancel` | `lib/governance/policy.service.ts:227` | — |
| POST | `/api/v1/approvals/{X}/decision` | `lib/governance/policy.service.ts:217` | — |
| POST | `/api/v1/approvals/{X}/escalate` | `lib/governance/policy.service.ts:234` | — |

#### `articles` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/articles?status=published` | `views/discovery/hooks/useDiscoveryFeed.ts:50` | — |

#### `artifacts` (7)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/artifacts` | `services/artifacts-api.ts:103` | — |
| GET/POST | `/api/v1/artifacts/search?{X}` | `services/artifacts-api.ts:173` | — |
| GET/POST | `/api/v1/artifacts/stats` | `services/artifacts-api.ts:179` | — |
| GET/POST | `/api/v1/artifacts/{X}` | `services/artifacts-api.ts:113` | — |
| GET/POST | `/api/v1/artifacts/{X}/revisions` | `services/artifacts-api.ts:165` | — |
| GET/POST | `/api/v1/artifacts/{X}/sections` | `services/artifacts-api.ts:138` | — |
| ? | `/api/v1/artifacts/{X}/sections/{X}` | `services/artifacts-api.ts:153` | — |

#### `audit-logs` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/audit-logs` | `services/autopilot.ts:495` | — |
| GET/POST | `/api/v1/audit-logs?taskId={X}&page={X}&limit=20` | `views/cowork/AuditLogViewer.tsx:42` | — |

#### `automation` (12)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/automation/goals` | `lib/automation-api.ts:28` | — |
| DELETE | `/api/v1/automation/goals/{X}` | `lib/automation-api.ts:36` | — |
| ? | `/api/v1/automation/goals/{X}/children` | `lib/automation-api.ts:48` | — |
| ? | `/api/v1/automation/local-schedules` | `lib/automation-api.ts:84` | — |
| ? | `/api/v1/automation/loops` | `lib/automation-api.ts:80` | — |
| DELETE | `/api/v1/automation/loops/{X}` | `lib/automation-api.ts:92` | — |
| ? | `/api/v1/automation/loops/{X}/run` | `lib/automation-api.ts:100` | — |
| ? | `/api/v1/automation/routines` | `lib/automation-api.ts:52` | — |
| DELETE | `/api/v1/automation/routines/{X}` | `lib/automation-api.ts:60` | — |
| ? | `/api/v1/automation/routines/{X}/metrics` | `lib/automation-api.ts:76` | — |
| ? | `/api/v1/automation/routines/{X}/run` | `lib/automation-api.ts:68` | — |
| ? | `/api/v1/automation/routines/{X}/runs` | `lib/automation-api.ts:72` | — |

#### `bb` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/bb` | `lib/agents/bb-sync.ts:63` | — |
| ? | `/api/v1/bb/projects` | `views/bb/bb-project.store.ts:3` | — |

#### `benchmarks` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/benchmarks/computer-use-leaderboard` | `pages/BenchmarkLeaderboardPage.tsx:45` | — |

#### `beta` (5)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/beta/*` | `lib/env.ts:165` | — |
| ? | `/api/v1/beta/research` | `lib/cowork/useResearchThread.ts:36` | BETA |
| GET/POST | `/api/v1/beta/sessions/{X}/events/list` | `views/AllternitPlaygroundView.tsx:57` | BETA |
| GET/POST | `/api/v1/beta/sessions/{X}/memory/search?q={X}` | `views/AllternitPlaygroundView.tsx:52` | BETA |
| GET/POST | `/api/v1/beta/sessions/{X}/run` | `views/AllternitPlaygroundView.tsx:62` | BETA |

#### `billing` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/billing/credits` | `lib/hosted-compute.ts:93` | — |

#### `board-items` (5)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/board-items` | `stores/board.store.ts:108` | — |
| DELETE, GET/POST | `/api/v1/board-items/{X}` | `stores/board.store.ts:130` | — |
| GET/POST | `/api/v1/board-items/{X}/assign` | `stores/board.store.ts:164` | — |
| GET/POST | `/api/v1/board-items/{X}/comments` | `stores/board.store.ts:185` | — |
| GET/POST | `/api/v1/board-items?workspaceId={X}` | `stores/board.store.ts:84` | — |

#### `board-stream` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/board-stream/{X}` | `stores/board.store.ts:208` | — |

#### `bots` (33)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/bots` | `lib/bots/orpc-contracts.ts:322` | — |
| ? | `/api/bots/{X}` | `lib/bots/orpc-contracts.ts:329` | — |
| ? | `/api/bots/{X}/delegations` | `lib/bots/orpc-contracts.ts:645` | — |
| ? | `/api/bots/{X}/delegations/{X}/approve` | `lib/bots/orpc-contracts.ts:662` | — |
| ? | `/api/bots/{X}/goals` | `lib/bots/orpc-contracts.ts:454` | — |
| ? | `/api/bots/{X}/goals/{X}` | `lib/bots/orpc-contracts.ts:461` | — |
| ? | `/api/bots/{X}/goals/{X}/cancel` | `lib/bots/orpc-contracts.ts:495` | — |
| ? | `/api/bots/{X}/goals/{X}/plan` | `lib/bots/orpc-contracts.ts:506` | — |
| ? | `/api/bots/{X}/goals/{X}/plan/accept` | `lib/bots/orpc-contracts.ts:528` | — |
| ? | `/api/bots/{X}/goals/{X}/plan/edit` | `lib/bots/orpc-contracts.ts:535` | — |
| ? | `/api/bots/{X}/goals/{X}/tasks` | `lib/bots/orpc-contracts.ts:554` | — |
| ? | `/api/bots/{X}/goals/{X}/tasks/{X}` | `lib/bots/orpc-contracts.ts:561` | — |
| ? | `/api/bots/{X}/goals/{X}/tasks/{X}/attempts` | `lib/bots/orpc-contracts.ts:596` | — |
| ? | `/api/bots/{X}/goals/{X}/tasks/{X}/attempts/{X}` | `lib/bots/orpc-contracts.ts:610` | — |
| ? | `/api/bots/{X}/goals/{X}/tasks/{X}/attempts/{X}/cancel` | `lib/bots/orpc-contracts.ts:617` | — |
| ? | `/api/bots/{X}/goals/{X}/tasks/{X}/validate` | `lib/bots/orpc-contracts.ts:580` | — |
| ? | `/api/bots/{X}/goals/{X}/tasks/{X}/validations` | `lib/bots/orpc-contracts.ts:634` | — |
| ? | `/api/bots/{X}/operational-state` | `lib/bots/orpc-contracts.ts:364` | — |
| ? | `/api/bots/{X}/operational-state/rebuild` | `lib/bots/orpc-contracts.ts:371` | — |
| ? | `/api/bots/{X}/routines` | `lib/bots/orpc-contracts.ts:383` | — |
| ? | `/api/bots/{X}/routines/{X}` | `lib/bots/orpc-contracts.ts:397` | — |
| ? | `/api/bots/{X}/routines/{X}/trigger` | `lib/bots/orpc-contracts.ts:411` | — |
| ? | `/api/bots/{X}/runs` | `lib/bots/orpc-contracts.ts:422` | — |
| ? | `/api/bots/{X}/spawn` | `lib/bots/orpc-contracts.ts:357` | — |
| ? | `/api/v1/bots/{X}/desktop/deprovision` | `lib/desktop-cloud-api.ts:178` | — |
| ? | `/api/v1/bots/{X}/desktop/files/download?sandbox_id={X}&path={X}` | `lib/desktop-cloud-api.ts:240` | — |
| ? | `/api/v1/bots/{X}/desktop/files/upload?sandbox_id={X}&path={X}` | `lib/desktop-cloud-api.ts:257` | — |
| ? | `/api/v1/bots/{X}/desktop/keyboard?sandbox_id={X}` | `lib/desktop-cloud-api.ts:233` | — |
| ? | `/api/v1/bots/{X}/desktop/mouse?sandbox_id={X}` | `lib/desktop-cloud-api.ts:226` | — |
| ? | `/api/v1/bots/{X}/desktop/screenshot?sandbox_id={X}` | `lib/desktop-cloud-api.ts:207` | — |
| ? | `/api/v1/bots/{X}/desktop/shell?sandbox_id={X}` | `lib/desktop-cloud-api.ts:219` | — |
| ? | `/api/v1/bots/{X}/desktop/start` | `lib/desktop-cloud-api.ts:170` | — |
| ? | `/api/v1/bots/{X}/desktop/stop` | `lib/desktop-cloud-api.ts:174` | — |

#### `brains` (3)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/brains` | `services/brain-api.ts:43` | — |
| ? | `/api/v1/brains/{X}/models/validate` | `integration/api-client.ts:1060` | — |
| GET/POST | `/api/v1/brains/{X}/pages` | `services/brain-api.ts:49` | — |

#### `browser` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/browser/capture` | `capsules/browser/extension-sidepanel/useBrowserCapture.ts:28` | — |

#### `canvases` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET | `/api/v1/canvases` | `lib/agents/native-agent-api.ts:1019` | AGENT_SESSIONS |
| GET, PATCH, DELETE | `/api/v1/canvases/{X}` | `lib/agents/native-agent-api.ts:1052` | AGENT_SESSIONS |

#### `capsules` (4)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/capsules` | `integration/api-client.ts:863` | — |
| ? | `/api/v1/capsules/{X}` | `integration/api-client.ts:859` | — |
| ? | `/api/v1/capsules/{X}/execute` | `integration/api-client.ts:875` | — |
| ? | `/api/v1/capsules/{X}/verify` | `integration/api-client.ts:879` | — |

| ? | `/api/v1/capsules{X}` | `integration/api-client.ts:855` | — |

#### `certifications` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/certifications` | `views/CertificationsPanel.tsx:53` | — |

#### `chat` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/chat` | `lib/ai/rust-stream-adapter.ts:1911` | — |
| ? | `/api/chat?chatId={X}` | `lib/ai/rust-stream-adapter.ts:1945` | — |

#### `checkpoints` (4)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/checkpoints` | `views/dag/Checkpointing.tsx:66` | — |
| GET/POST | `/api/checkpoints/commit` | `views/dag/Checkpointing.tsx:88` | — |
| GET/POST | `/api/checkpoints/tag` | `views/dag/Checkpointing.tsx:125` | — |
| POST | `/api/checkpoints/{X}/restore` | `views/dag/Checkpointing.tsx:168` | — |


#### `cli-tools` (4)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| POST | `/api/v1/cli-tools/check` | `plugins/cli-tools.api.ts:214` | — |
| POST | `/api/v1/cli-tools/discover` | `plugins/cli-tools.api.ts:238` | — |
| GET | `/api/v1/cli-tools` | `plugins/cli-tools.api.ts:53` | — |
| GET | `/api/v1/cli-tools/installed` | `plugins/cli-tools.api.ts:53` | — |

#### `cloud` (5)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/cloud/wizard/deployments` | `views/settings/CloudInstancesPanel.tsx:5` | — |
| ? | `/api/v1/cloud/wizard/deployments/{X}` | `views/settings/CloudInstancesPanel.tsx:380` | — |
| ? | `/api/v1/cloud/wizard/deployments/{X}/advance` | `views/settings/CloudInstancesPanel.tsx:372` | — |
| ? | `/api/v1/cloud/wizard/deployments/{X}/bootstrap` | `views/settings/CloudInstancesPanel.tsx:468` | — |
| ? | `/api/v1/cloud/wizard/deployments/{X}/cancel` | `views/settings/CloudInstancesPanel.tsx:505` | — |

#### `cloud-credentials` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/cloud-credentials` | `lib/design/cloud-credentials.ts:42` | — |

#### `coding` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| POST | `/api/coding` | `components/onboarding/OnboardingFlow.tsx:1691` | — |

#### `computers` (5)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/computers` | `lib/computers-api.ts:4` | — |
| ? | `/api/v1/computers/{X}` | `lib/computers-api.ts:99` | — |
| ? | `/api/v1/computers/{X}/delete` | `lib/computers-api.ts:117` | — |
| ? | `/api/v1/computers/{X}/start` | `lib/computers-api.ts:109` | — |
| ? | `/api/v1/computers/{X}/stop` | `lib/computers-api.ts:113` | — |

#### `connectors` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/connectors` | `plugins/marketplaceApi.ts:721` | — |

#### `conversations` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/conversations` | `api/conversations.ts:87` | — |

#### `courses` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/courses` | `views/labs/main/useLabsManager.ts:33` | — |

#### `cowork` (12)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/cowork/approvals` | `lib/agents/permission-store.ts:105` | — |
| GET/POST | `/api/v1/cowork/memory` | `lib/agents/agent-cowork-integration.ts:124` | — |
| ? | `/api/v1/cowork/memory/search?query={X}&limit=10` | `views/design/DesignSessionStore.ts:121` | — |
| ? | `/api/v1/cowork/memory?limit=10&format=context` | `views/design/DesignSessionStore.ts:122` | — |
| GET/POST | `/api/v1/cowork/personas` | `views/cowork/CoworkRoot.tsx:268` | — |
| GET/POST | `/api/v1/cowork/projects` | `views/settings/AgentOpsPanel.tsx:178` | — |
| GET/POST | `/api/v1/cowork/projects/{X}` | `views/settings/AgentOpsPanel.tsx:192` | — |
| GET/POST | `/api/v1/cowork/sessions` | `views/cowork/CoworkSessionStore.ts:118` | — |
| DELETE, GET/POST | `/api/v1/cowork/sessions/{X}` | `lib/cowork/useCoworkSession.ts:40` | — |
| GET/POST | `/api/v1/cowork/sessions?limit=30` | `lib/cowork/useCoworkSession.ts:28` | — |
| GET/POST | `/api/v1/cowork/tasks` | `lib/agents/agent-heartbeat-executor.ts:414` | — |
| GET/POST | `/api/v1/cowork/team-execute` | `lib/cowork/useTeamSession.ts:34` | — |

#### `cowork-preferences` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/cowork-preferences` | `views/settings/CoworkPreferencesPanel.tsx:16` | — |

#### `cowork-team` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/cowork-team/parse-prd` | `lib/cowork-team/coworkTeamBridge.ts:100` | — |

#### `create-personal-access-token` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| POST | `/api/create-personal-access-token` | `views/cloud-deploy/data/providers.ts:108` | — |

#### `credits` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/credits/balance` | `lib/cloud-console-api.ts:160` | — |
| ? | `/api/v1/credits/transactions` | `lib/cloud-console-api.ts:164` | — |

#### `design` (11)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/design/adapters` | `lib/design/agent-adapters-api.ts:38` | — |
| GET/POST | `/api/design/adapters/detect` | `lib/design/agent-adapters-api.ts:44` | — |
| GET/POST | `/api/design/adapters/spawn` | `lib/design/agent-adapters-api.ts:54` | — |
| GET/POST | `/api/design/connectors/github` | `lib/design/direct-connectors.ts:52` | — |
| GET/POST | `/api/design/connectors/linear` | `lib/design/direct-connectors.ts:75` | — |
| GET/POST | `/api/design/connectors/notion` | `lib/design/direct-connectors.ts:96` | — |
| GET/POST | `/api/design/connectors/slack` | `lib/design/direct-connectors.ts:117` | — |
| GET/POST | `/api/design/import-url` | `views/design/DesignImportModal.tsx:43` | — |
| GET/POST | `/api/design/plugins/install` | `lib/design/plugin-install-scripts.ts:250` | — |
| ? | `/api/design/skills/discover` | `lib/design/design-skills-plugin.ts:4` | — |
| GET/POST | `/api/design/skills/discover?{X}` | `lib/design/skills-api.ts:117` | — |

#### `desktop-capacity` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/desktop-capacity` | `lib/desktop-cloud-api.ts:120` | — |

#### `desktop-sandboxes` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/desktop-sandboxes` | `lib/desktop-cloud-api.ts:149` | — |

#### `desktop-usage` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/desktop-usage/summary` | `lib/computers-api.ts:121` | — |

#### `dev` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/dev/openclaw/agents/discovery` | `lib/agents/openclaw-discovery.ts:109` | — |

#### `discovery` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/discovery/feed` | `views/discovery/hooks/useDiscoveryFeed.ts:90` | — |

#### `drive` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/drive/assets` | `views/canvas/components/AllternitDriveSidebar.tsx:64` | — |
| ? | `/api/v1/drive/assets?sessionId={X}` | `views/canvas/components/AllternitDriveSidebar.tsx:64` | — |

#### `enrollments` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/enrollments` | `views/labs/components/LessonPlayer.tsx:136` | — |
| GET/POST | `/api/v1/enrollments?courseId={X}&lessonId={X}` | `views/labs/components/LessonPlayer.tsx:90` | — |

#### `fabric` (4)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/fabric/resource-classes` | `lib/cloud-console-api.ts:131` | — |
| ? | `/api/v1/fabric/resources` | `lib/cloud-console-api.ts:142` | — |
| ? | `/api/v1/fabric/resources/{X}` | `lib/cloud-console-api.ts:146` | — |
| ? | `/api/v1/fabric/resources/{X}/terminate` | `lib/cloud-console-api.ts:151` | — |

#### `files` (5)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/files/write` | `plugins/fileSystem.ts:333` | — |
| GET | `/api/v1/files/list?{X}` | `lib/agents/files-api.ts:173` | — |
| GET | `/api/v1/files/exists?{X}` | `lib/agents/files-api.ts:239` | — |
| POST | `/api/v1/files/search` | `lib/agents/files-api.ts:188` | — |
| ? | `/api/v1/files/{X}?{X}` | `plugins/fileSystem.ts:179` | — |

#### `h5i` (14)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/h5i/agent-hooks/install` | `lib/h5i/client.ts:222` | — |
| GET/POST | `/api/h5i/claims/list` | `lib/h5i/client.ts:145` | — |
| GET/POST | `/api/h5i/commit` | `lib/h5i/client.ts:202` | — |
| GET/POST | `/api/h5i/context/diff` | `lib/h5i/client.ts:185` | — |
| GET/POST | `/api/h5i/context/finish` | `lib/h5i/client.ts:98` | — |
| GET/POST | `/api/h5i/context/start` | `lib/h5i/client.ts:82` | — |
| GET/POST | `/api/h5i/context/trace` | `lib/h5i/client.ts:114` | — |
| ? | `/api/h5i/files-touched-stream?workspacePath={X}` | `components/h5i/useFilesTouched.ts:28` | — |
| GET/POST | `/api/h5i/init` | `lib/h5i/client.ts:42` | — |
| GET/POST | `/api/h5i/mcp/config` | `lib/h5i/client.ts:265` | — |
| GET/POST | `/api/h5i/status` | `lib/h5i/client.ts:55` | — |
| GET/POST | `/api/h5i/summarize` | `lib/h5i/client.ts:242` | — |
| GET/POST | `/api/h5i/summary/list` | `lib/h5i/client.ts:158` | — |
| GET/POST | `/api/h5i/vibe` | `lib/h5i/client.ts:29` | — |

#### `har-derived-api` (3)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/har-derived-api/client` | `lib/model-lab/api.ts:797` | — |
| ? | `/api/har-derived-api/contracts` | `lib/api-capture/api.ts:117` | — |
| ? | `/api/har-derived-api/ingest` | `lib/model-lab/api.ts:791` | — |

#### `hosted-runtimes` (4)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/hosted-runtimes` | `lib/hosted-compute.ts:97` | — |
| ? | `/api/v1/hosted-runtimes/entitlement` | `lib/hosted-compute.ts:88` | — |
| ? | `/api/v1/hosted-runtimes/{X}/start` | `lib/hosted-compute.ts:113` | — |
| ? | `/api/v1/hosted-runtimes/{X}/stop` | `lib/hosted-compute.ts:121` | — |

#### `images` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/images/generate` | `allternit-os/programs/PresentationProgram.tsx:109` | — |

#### `inference-router` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/inference-router/cli-status` | `integration/api-client.ts:605` | — |

#### `infrastructure` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET | `/api/infrastructure` | `shell/EnvironmentSelector.tsx:28` | — |

#### `ivkge` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/ivkge` | `views/IVKGEPanel/IVKGEPanel.tsx:68` | — |

#### `lessons` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/lessons/generate` | `views/labs/main/LabsClassroomTab.tsx:76` | — |
| GET/POST | `/api/v1/lessons?status=published` | `views/labs/main/useLabsManager.ts:52` | — |

#### `library` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/library/stats` | `services/library-api.ts:64` | — |

#### `local-brain` (5)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST, POST | `/api/local-brain` | `components/models/LocalModelManager.tsx:114` | — |
| GET, GET/POST | `/api/local-brain/models` | `hooks/use-available-brain-models.ts:94` | — |
| GET | `/api/local-brain/models/search?{X}` | `services/setup-api.ts:183` | — |
| DELETE | `/api/local-brain/models/{X}` | `services/setup-api.ts:200` | — |
| GET/POST | `/api/local-brain/pull-custom` | `components/models/LocalModelManager.tsx:289` | — |

#### `local-engine` (12)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/local-engine/assess` | `lib/model-lab/api.ts:466` | — |
| ? | `/api/local-engine/catalog/refresh` | `lib/model-lab/api.ts:458` | — |
| ? | `/api/local-engine/catalog?{X}` | `lib/model-lab/api.ts:454` | — |
| ? | `/api/local-engine/health` | `lib/model-lab/api.ts:249` | — |
| ? | `/api/local-engine/models` | `lib/model-lab/api.ts:257` | — |
| ? | `/api/local-engine/models/download` | `lib/model-lab/api.ts:270` | — |
| ? | `/api/local-engine/models/import` | `lib/model-lab/api.ts:264` | — |
| ? | `/api/local-engine/recommend` | `lib/model-lab/api.ts:477` | — |
| ? | `/api/local-engine/runtimes` | `lib/model-lab/api.ts:274` | — |
| ? | `/api/local-engine/runtimes/launch` | `lib/model-lab/api.ts:281` | — |
| POST | `/api/local-engine/runtimes/{X}/stop` | `lib/model-lab/api.ts:285` | — |
| ? | `/api/local-engine/status` | `lib/model-lab/api.ts:253` | — |

#### `local-studio` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/local-studio{X}` | `lib/model-lab/api.ts:712` | — |

#### `marketplace` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/marketplace` | `lib/plugins/marketplace.ts:227` | — |

#### `mcp` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/mcp/apps` | `lib/ai/mcp/app-bridge-api.ts:3` | — |
| ? | `/api/mcp/sandbox` | `lib/ai/mcp/sandbox-client.ts:16` | — |

#### `me` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/me` | `lib/design/current-user.ts:22` | — |
| POST | `/api/v1/me/organization` | `lib/design/current-user.ts:37` | — |

#### `memory` (6)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| POST | `/api/v1/memory/consolidate` | `components/memory/MemoryVaultStats.tsx:63` | — |
| GET/POST | `/api/v1/memory/edges` | `views/MemoryKernelView.tsx:184` | — |
| GET/POST | `/api/v1/memory/entities` | `views/MemoryKernelView.tsx:183` | — |
| GET/POST | `/api/v1/memory/events` | `views/MemoryKernelView.tsx:182` | — |
| GET/POST | `/api/v1/memory/health` | `components/memory/MemoryVaultStats.tsx:41` | — |
| GET/POST | `/api/v1/memory/stats` | `components/memory/MemoryVaultStats.tsx:42` | — |

#### `moa` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/moa` | `lib/api/moa-client.ts:9` | — |

#### `model-lab` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/model-lab/jobs` | `lib/model-lab/api.ts:226` | — |
| ? | `/api/model-lab/jobs/{X}` | `lib/model-lab/api.ts:231` | — |

#### `models` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET | `/api/v1/models` | `lib/agents/agent-models.ts:10` | — |

#### `monitor` (3)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/monitor/agents` | `views/MonitorView.tsx:124` | — |
| GET/POST | `/api/v1/monitor/logs` | `views/MonitorView.tsx:125` | — |
| GET/POST | `/api/v1/monitor/system` | `views/MonitorView.tsx:126` | — |

#### `nodes` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/nodes` | `views/nodes/terminal/TerminalTabs.tsx:99` | — |
| GET/POST | `/api/v1/nodes/{X}/terminal` | `views/nodes/terminal/terminal.service.ts:304` | — |

#### `notebooks` (11)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/notebooks` | `views/research/hooks/useNotebookApi.ts:75` | — |
| ? | `/api/notebooks/{X}` | `views/research/hooks/useNotebookApi.ts:80` | — |
| ? | `/api/notebooks/{X}/canvas-sync` | `views/research/hooks/useNotebookApi.ts:160` | — |
| ? | `/api/notebooks/{X}/chat/messages` | `views/research/hooks/useNotebookApi.ts:107` | — |
| ? | `/api/notebooks/{X}/podcast` | `views/research/hooks/useNotebookApi.ts:178` | — |
| ? | `/api/notebooks/{X}/search` | `views/research/hooks/useNotebookApi.ts:148` | — |
| ? | `/api/notebooks/{X}/share` | `views/research/hooks/useNotebookApi.ts:84` | — |
| ? | `/api/notebooks/{X}/sources` | `views/research/hooks/useNotebookApi.ts:96` | — |
| ? | `/api/notebooks/{X}/sources/{X}` | `views/research/hooks/useNotebookApi.ts:103` | — |
| ? | `/api/notebooks/{X}/transform` | `views/research/hooks/useNotebookApi.ts:171` | — |
| ? | `/api/notebooks/{X}/unshare` | `views/research/hooks/useNotebookApi.ts:89` | — |

#### `oauth` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/oauth/authorize` | `pages/OAuthAuthorizePage.tsx:106` | — |
| POST | `/api/oauth/revoke-user` | `views/settings/SettingsView.tsx:949` | — |

#### `office` (3)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/office/markdown` | `views/office/MarkdownPreviewView.tsx:47` | — |
| GET/POST | `/api/office/markdown-url` | `views/office/MarkdownPreviewView.tsx:76` | — |
| GET/POST | `/api/v1/office/bindings` | `capsules/browser/BrowserCapsuleEnhanced.tsx:1226` | OFFICE |

#### `onboarding` (6)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET, GET/POST, POST | `/api/onboarding/config` | `lib/agents/mode-session-store.ts:588` | AGENT_SESSIONS |
| GET | `/api/onboarding/discover` | `services/setup-api.ts:107` | — |
| POST | `/api/onboarding/init-project` | `services/setup-api.ts:211` | — |
| POST | `/api/onboarding/provider` | `services/setup-api.ts:139` | — |
| POST | `/api/onboarding/validate-key` | `services/setup-api.ts:135` | — |
| GET/POST | `/api/v1/onboarding/provider` | `components/settings/BrainsPanel.tsx:115` | — |

#### `openclaw` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/openclaw/agents/discovery` | `integration/api-client.ts:898` | — |

#### `operator` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET | `/api/v1/operator/events/{X}` | `integration/api-client.ts:1095` | — |
| ? | `/api/v1/operator/execute` | `integration/api-client.ts:1088` | — |

#### `orchestrator` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/orchestrator` | `views/code/orchestrator.service.ts:51` | — |

#### `pages` (3)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/pages` | `services/docmost/DocmostAdapter.ts:79` | — |
| ? | `/api/pages/{X}` | `services/docmost/DocmostAdapter.ts:67` | — |
| ? | `/api/pages/{X}/revisions` | `services/docmost/DocmostAdapter.ts:106` | — |

#### `permissions` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/permissions/{X}/reply` | `lib/agents/native-agent-api.ts:1170` | — |

#### `photon` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/photon/send` | `lib/messaging/allternit-bus.service.ts:107` | — |
| ? | `/api/v1/photon/stream` | `lib/messaging/allternit-bus.service.ts:45` | — |

#### `plugins` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/plugins/marketplace/submit` | `views/plugins/PluginManager/components/PublishModals.tsx:295` | — |

#### `policies` (8)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| POST | `/api/v1/policies` | `lib/governance/policy.service.ts:68` | — |
| GET | `/api/v1/policies/violations/{X}` | `lib/governance/policy.service.ts:147` | — |
| POST | `/api/v1/policies/violations/{X}/escalate` | `lib/governance/policy.service.ts:171` | — |
| POST | `/api/v1/policies/violations/{X}/resolve` | `lib/governance/policy.service.ts:158` | — |
| DELETE, GET, PATCH | `/api/v1/policies/{X}` | `lib/governance/policy.service.ts:61` | — |
| POST | `/api/v1/policies/{X}/clone` | `lib/governance/policy.service.ts:109` | — |
| POST | `/api/v1/policies/{X}/disable` | `lib/governance/policy.service.ts:99` | — |
| POST | `/api/v1/policies/{X}/enable` | `lib/governance/policy.service.ts:92` | — |

#### `promotion` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/promotion/proposals` | `views/code/PromotionDashboardView.tsx:103` | — |
| GET/POST | `/api/v1/promotion/proposals/{X}/decision` | `views/code/PromotionDashboardView.tsx:155` | — |

#### `prompts` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/prompts/test` | `components/agents/AllternitSystemPromptEditor.tsx:51` | — |

#### `provider` (3)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/provider/huggingface/search?q={X}` | `components/models/LocalModelManager.tsx:271` | — |
| GET/POST | `/api/provider/ollama/models` | `components/models/LocalModelManager.tsx:122` | — |
| ? | `/api/v1/provider/ollama/status` | `integration/api-client.ts:1022` | — |

#### `provider-tokens` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/provider-tokens` | `views/settings/CloudInstancesPanel.tsx:11` | — |
| ? | `/api/v1/provider-tokens/{X}` | `views/settings/CloudInstancesPanel.tsx:409` | — |

#### `providers` (10)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/providers` | `integration/api-client.ts:978` | — |
| ? | `/api/v1/providers/auth/status` | `integration/api-client.ts:971` | — |
| GET/POST | `/api/v1/providers/minimax/auth/status` | `lib/agents/agent-mode-executor.ts:33` | — |
| GET/POST | `/api/v1/providers/video/generate` | `lib/agents/modes/video-generation.ts:75` | — |
| ? | `/api/v1/providers/{X}/auth/status` | `integration/api-client.ts:991` | — |
| POST | `/api/v1/providers/{X}/connect` | `components/settings/BrainsPanel.tsx:174` | — |
| POST | `/api/v1/providers/{X}/connect/confirm` | `components/settings/BrainsPanel.tsx:202` | — |
| GET | `/api/v1/providers/{X}/connect/status` | `components/settings/BrainsPanel.tsx:153` | — |
| ? | `/api/v1/providers/{X}/models` | `integration/api-client.ts:1012` | — |
| ? | `/api/v1/providers/{X}/models/validate` | `integration/api-client.ts:1040` | — |

#### `purposes` (4)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| POST | `/api/v1/purposes` | `lib/governance/policy.service.ts:277` | — |
| POST | `/api/v1/purposes/bind` | `lib/governance/policy.service.ts:326` | — |
| POST | `/api/v1/purposes/unbind` | `lib/governance/policy.service.ts:336` | — |
| DELETE, GET, PATCH | `/api/v1/purposes/{X}` | `lib/governance/policy.service.ts:264` | — |

#### `query` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/query` | `capsules/browser/observabilityService.ts:488` | — |

#### `questions` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/questions/{X}/reject` | `lib/agents/native-agent-api.ts:1207` | — |
| ? | `/api/v1/questions/{X}/reply` | `lib/agents/native-agent-api.ts:1193` | — |

#### `rails` (44)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| POST | `/api/rails/context-packs` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/context-packs/seal` | `lib/agents/rails.service.ts:379` | RAILS |
| GET | `/api/rails/context-packs/{X}` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/dags/{X}/execute` | `lib/agents/rails.service.ts:379` | RAILS |
| GET | `/api/rails/dags/{X}/render` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/gate/check` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/gate/decision` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/gate/mutate` | `lib/agents/rails.service.ts:379` | RAILS |
| GET | `/api/rails/gate/rules` | `lib/agents/rails.service.ts:379` | RAILS |
| GET | `/api/rails/gate/status` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/gate/verify` | `lib/agents/rails.service.ts:379` | RAILS |
| GET | `/api/rails/health` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/index/rebuild` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/init` | `lib/agents/rails.service.ts:379` | RAILS |
| GET, POST | `/api/rails/leases` | `lib/agents/rails.service.ts:379` | RAILS |
| DELETE, GET | `/api/rails/leases/{X}` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/leases/{X}/renew` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/ledger/tail` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/ledger/trace` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/mail/ack` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/mail/archive` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/mail/decide` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/mail/guard` | `lib/agents/rails.service.ts:379` | RAILS |
| GET | `/api/rails/mail/inbox/{X}` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/mail/reserve` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/mail/review` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/mail/share` | `lib/agents/rails.service.ts:379` | RAILS |
| GET | `/api/rails/mail/thread/{X}` | `lib/agents/rails.service.ts:379` | RAILS |
| GET, POST | `/api/rails/mail/threads` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/plan` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/plan/refine` | `lib/agents/rails.service.ts:379` | RAILS |
| GET | `/api/rails/plan/{X}` | `lib/agents/rails.service.ts:379` | RAILS |
| GET | `/api/rails/plans` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/receipts` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/receipts/write` | `lib/agents/rails.service.ts:379` | RAILS |
| GET | `/api/rails/receipts/{X}` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/runs/{X}/cancel` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/vault/archive` | `lib/agents/rails.service.ts:379` | RAILS |
| GET | `/api/rails/vault/status` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/wihs` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/wihs/pickup` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/wihs/{X}/close` | `lib/agents/rails.service.ts:379` | RAILS |
| GET | `/api/rails/wihs/{X}/context` | `lib/agents/rails.service.ts:379` | RAILS |
| POST | `/api/rails/wihs/{X}/sign` | `lib/agents/rails.service.ts:379` | RAILS |

#### `runs` (10)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/runs/{X}` | `lib/bots/orpc-contracts.ts:429` | — |
| ? | `/api/runs/{X}/cancel` | `lib/bots/orpc-contracts.ts:436` | — |
| ? | `/api/runs/{X}/retry` | `lib/bots/orpc-contracts.ts:443` | — |
| GET/POST | `/api/v1/runs` | `lib/cowork/useCoworkRuns.ts:62` | — |
| POST | `/api/v1/runs/{X}/cancel` | `lib/cowork/useCoworkRuns.ts:103` | — |
| SSE | `/api/v1/runs/{X}/events/stream` | `lib/cowork/useCoworkRunEvents.ts:25` | — |
| GET/POST | `/api/v1/runs/{X}/handoffs` | `lib/cowork/useCoworkRuns.ts:121` | — |
| GET/POST | `/api/v1/runs/{X}/jobs` | `lib/cowork/useCoworkRuns.ts:157` | — |
| POST | `/api/v1/runs/{X}/recover` | `lib/cowork/useCoworkRuns.ts:112` | — |
| POST | `/api/v1/runs/{X}/start` | `lib/cowork/useCoworkRuns.ts:94` | — |

#### `runtime` (11)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/runtime/backend` | `lib/runtime-backend-client.ts:160` | — |
| GET/POST | `/api/v1/runtime/budget` | `hooks/useBudget.ts:199` | RUNTIME |
| GET/POST | `/api/v1/runtime/budget/quota` | `hooks/useBudget.ts:254` | RUNTIME |
| ? | `/api/v1/runtime/drivers` | `hooks/useRuntimeSettings.ts:99` | RUNTIME |
| GET/POST | `/api/v1/runtime/prewarm/pool` | `hooks/usePrewarm.ts:146` | RUNTIME |
| GET/POST | `/api/v1/runtime/prewarm/status` | `hooks/usePrewarm.ts:119` | RUNTIME |
| GET/POST | `/api/v1/runtime/prewarm/warmup` | `hooks/usePrewarm.ts:167` | RUNTIME |
| GET/POST | `/api/v1/runtime/replay/sessions` | `hooks/useReplay.ts:40` | RUNTIME |
| GET/POST | `/api/v1/runtime/replay/sessions/{X}/execute` | `hooks/useReplay.ts:56` | RUNTIME |
| ? | `/api/v1/runtime/settings` | `hooks/useRuntimeSettings.ts:97` | RUNTIME |
| ? | `/api/v1/runtime/settings/reset` | `hooks/useRuntimeSettings.ts:98` | RUNTIME |

#### `runtime-devices` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/runtime-devices` | `views/settings/DevicePairingPanel.tsx:142` | — |

#### `runtime-pairings` (3)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/runtime-pairings/code/{X}` | `views/settings/DevicePairingPanel.tsx:168` | — |
| ? | `/api/v1/runtime-pairings/code/{X}/approve` | `views/settings/DevicePairingPanel.tsx:189` | — |
| ? | `/api/v1/runtime-pairings/code/{X}/deny` | `views/settings/DevicePairingPanel.tsx:213` | — |

#### `security` (6)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET | `/api/v1/security/compliance` | `lib/governance/policy.service.ts:422` | — |
| POST | `/api/v1/security/compliance/assess` | `lib/governance/policy.service.ts:429` | — |
| GET | `/api/v1/security/events/{X}` | `lib/governance/policy.service.ts:398` | — |
| POST | `/api/v1/security/events/{X}/acknowledge` | `lib/governance/policy.service.ts:405` | — |
| POST | `/api/v1/security/events/{X}/resolve` | `lib/governance/policy.service.ts:415` | — |
| GET | `/api/v1/security/overview` | `lib/governance/policy.service.ts:366` | — |

#### `sessions` (9)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/sessions` | `integration/api-client.ts:615` | — |
| GET/POST | `/api/v1/sessions/archived` | `views/ArchivedView.tsx:187` | — |
| ? | `/api/v1/sessions/{X}` | `integration/api-client.ts:652` | — |
| ? | `/api/v1/sessions/{X}/chat` | `integration/api-client.ts:664` | — |
| ? | `/api/v1/sessions/{X}/messages?limit={X}&offset={X}` | `integration/api-client.ts:671` | — |
| ? | `/api/v1/sessions/{X}/permission` | `lib/sdk.ts:75` | — |
| ? | `/api/v1/sessions/{X}/question/reject` | `lib/sdk.ts:91` | — |
| ? | `/api/v1/sessions/{X}/question/reply` | `lib/sdk.ts:85` | — |
| POST | `/api/v1/sessions/{X}/restore` | `views/ArchivedView.tsx:217` | — |

| ? | `/api/v1/sessions{X}` | `integration/api-client.ts:648` | — |

#### `skills` (4)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/skills` | `integration/api-client.ts:789` | — |
| GET/POST | `/api/v1/skills/registry` | `views/code/SkillsRegistryView.tsx:68` | — |
| ? | `/api/v1/skills/{X}` | `integration/api-client.ts:785` | — |
| ? | `/api/v1/skills/{X}/exec` | `integration/api-client.ts:804` | — |

| ? | `/api/v1/skills{X}` | `integration/api-client.ts:781` | — |

#### `spaces` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/spaces/{X}/pages` | `services/docmost/DocmostAdapter.ts:49` | — |

#### `status` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/status` | `pages/StatusPage.tsx:56` | — |

#### `swarm` (3)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/swarm` | `lib/swarm/swarm.api.ts:105` | — |
| GET/POST | `/api/v1/swarm/health` | `views/dag/SwarmMonitor.tsx:142` | — |
| GET/POST | `/api/v1/swarm/threads` | `views/dag/SwarmMonitor.tsx:134` | — |

#### `swarms` (6)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/swarms` | `lib/agents/agent-advanced.store.ts:267` | — |
| GET/POST | `/api/v1/swarms/runs/{X}/messages` | `lib/agents/agent-advanced.store.ts:390` | — |
| GET/POST | `/api/v1/swarms/{X}` | `lib/agents/agent-advanced.store.ts:301` | — |
| GET/POST | `/api/v1/swarms/{X}/agents` | `lib/agents/agent-advanced.store.ts:334` | — |
| GET/POST | `/api/v1/swarms/{X}/agents/{X}` | `lib/agents/agent-advanced.store.ts:352` | — |
| GET/POST | `/api/v1/swarms/{X}/runs` | `lib/agents/agent-advanced.store.ts:368` | — |

#### `tasks` (8)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/tasks` | `views/cowork/useTaskStore.ts:195` | — |
| ? | `/api/v1/tasks/stream?workspace_id={X}` | `views/cowork/hooks/useTaskRealtime.ts:14` | — |
| ? | `/api/v1/tasks/stream?workspace_id={X}&token={X}` | `views/cowork/hooks/useTaskRealtime.ts:13` | — |
| DELETE, GET/POST | `/api/v1/tasks/{X}` | `views/cowork/useTaskStore.ts:223` | — |
| GET/POST | `/api/v1/tasks/{X}/assign` | `views/cowork/useTaskStore.ts:397` | — |
| GET/POST | `/api/v1/tasks/{X}/audit-logs` | `views/cowork/CoworkRightRail.tsx:621` | — |
| GET/POST | `/api/v1/tasks/{X}/comments` | `views/cowork/useTaskStore.ts:467` | — |
| GET/POST | `/api/v1/tasks?workspace_id={X}&limit=100` | `views/cowork/hooks/useTasksAPI.ts:61` | — |

#### `team-skills` (3)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/team-skills` | `components/marketplace/TeamSkillsPanel.tsx:53` | — |
| DELETE, GET/POST | `/api/v1/team-skills/{X}` | `components/marketplace/TeamSkillsPanel.tsx:74` | — |
| GET/POST | `/api/v1/team-skills?workspaceId={X}` | `components/marketplace/TeamSkillsPanel.tsx:39` | — |

#### `terminal` (8)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/terminal/sessions/{X}/status` | `views/nodes/terminal/terminal.service.ts:269` | — |
| ? | `/api/v1/terminal/{X}` | `views/nodes/terminal/terminal.service.ts:726` | — |
| ? | `/api/v1/terminal/{X}/files/download?path={X}` | `views/nodes/terminal/terminal.service.ts:865` | — |
| ? | `/api/v1/terminal/{X}/files/list?path={X}` | `views/nodes/terminal/terminal.service.ts:785` | — |
| ? | `/api/v1/terminal/{X}/files/mkdir?path={X}` | `views/nodes/terminal/terminal.service.ts:920` | — |
| ? | `/api/v1/terminal/{X}/files/stat?path={X}` | `views/nodes/terminal/terminal.service.ts:944` | — |
| ? | `/api/v1/terminal/{X}/files/upload?path={X}` | `views/nodes/terminal/terminal.service.ts:844` | — |
| ? | `/api/v1/terminal/{X}/files?path={X}` | `views/nodes/terminal/terminal.service.ts:896` | — |

#### `tokens` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET | `/api/tokens` | `views/cloud-deploy/data/providers.ts:87` | — |

#### `tools` (4)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/tools` | `integration/api-client.ts:944` | — |
| GET/POST | `/api/v1/tools/execute` | `stores/recording.store.ts:44` | — |
| ? | `/api/v1/tools/{X}` | `integration/api-client.ts:948` | — |
| ? | `/api/v1/tools/{X}/execute` | `integration/api-client.ts:952` | — |

#### `udemy` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/udemy/search` | `views/catalog/main/useCatalogManager.ts:71` | — |

#### `usage` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/usage/summary` | `integration/api-client.ts:1113` | — |
| GET/POST | `/api/v1/usage/summary?{X}` | `lib/enterprise-usage.ts:30` | — |

#### `verification` (5)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/verification` | `services/visualVerificationApi.ts:87` | — |
| GET/POST | `/api/verification/{X}` | `hooks/useVisualVerification.ts:80` | — |
| GET/POST | `/api/verification/{X}/bypass` | `hooks/useVisualVerification.ts:98` | — |
| GET/POST | `/api/verification/{X}/start` | `hooks/useVisualVerification.ts:88` | — |
| GET/POST | `/api/verification/{X}/trend?days={X}` | `hooks/useVisualVerification.ts:109` | — |

#### `voice` (1)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/voice` | `lib/agents/voice.service.ts:14` | — |

#### `web-proxy` (2)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/web-proxy` | `lib/platform.ts:24` | — |
| ? | `/api/web-proxy?url={X}` | `lib/platform.ts:29` | — |

#### `webhook-triggers` (3)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| ? | `/api/v1/webhook-triggers` | `lib/webhook-api.ts:52` | — |
| DELETE | `/api/v1/webhook-triggers/{X}` | `lib/webhook-api.ts:69` | — |
| ? | `/api/v1/webhook-triggers/{X}/deliveries` | `lib/webhook-api.ts:93` | — |

#### `workflows` (9)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/workflows` | `integration/api-client.ts:815` | — |
| POST | `/api/v1/workflows/runs/{X}/pause` | `lib/agents/agent-advanced.store.ts:531` | — |
| POST | `/api/v1/workflows/runs/{X}/resume` | `lib/agents/agent-advanced.store.ts:539` | — |
| ? | `/api/v1/workflows/validate` | `integration/api-client.ts:835` | — |
| DELETE | `/api/v1/workflows/{X}` | `integration/api-client.ts:819` | — |
| GET/POST | `/api/v1/workflows/{X}/execute` | `hooks/useWorkflow.ts:188` | — |
| GET/POST | `/api/v1/workflows/{X}/executions/{X}/cancel` | `hooks/useWorkflow.ts:214` | — |
| ? | `/api/v1/workflows/{X}/run` | `integration/api-client.ts:842` | — |
| ? | `/api/v1/workflows/{X}/runs` | `integration/api-client.ts:846` | — |

#### `workspace` (3)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/workspace/exports` | `views/cowork/ExportsView.tsx:38` | — |
| GET/POST | `/api/v1/workspace/files` | `views/cowork/FilesView.tsx:81` | — |
| GET/POST | `/api/v1/workspace/tables` | `views/cowork/TablesView.tsx:21` | — |

#### `workspaces` (5)

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET/POST | `/api/v1/workspaces` | `stores/workspace.store.ts:66` | — |
| GET/POST | `/api/v1/workspaces/join?token={X}` | `stores/workspace.store.ts:101` | — |
| GET/POST | `/api/v1/workspaces/{X}/invites` | `stores/workspace.store.ts:114` | — |
| GET/POST | `/api/v1/workspaces/{X}/members` | `stores/workspace.store.ts:146` | — |
| GET/POST | `/api/v1/workspaces/{X}/members?id={X}` | `stores/workspace.store.ts:128` | — |

#### `v1 (gizzi direct)` (5)

Paths below bypass both Rust backends — the client talks to gizzi-code's native HTTP surface (`GATEWAY_BASE_URL` + Basic auth). Listed for completeness; they are not P1 targets.

| Method | Path | Caller (file:line) | Env flag |
|---|---|---|---|
| GET | `/v1/session/list` | `pages/SessionsPage.tsx:56` | — |
| GET | `/v1/session/status` | `pages/SessionsPage.tsx:57` | — |
| SSE | `/v1/global/event` | `pages/SessionsPage.tsx:78` | — |
| GET | `/v1/session/{X}/replay` | `pages/SessionsPage.tsx:229` | — |
| GET | `/v1/session/{X}/support-bundle` | `pages/SessionsPage.tsx:256` | — |


---

## 2. Backend ownership

### 2.1 Namespace matrix

Counts of distinct client-called paths per namespace and owner.

| Namespace | :8013 only | cloud only | both | orphan | Total |
|---|---|---|---|---|---|
| `a2ui` | 0 | 0 | 0 | 9 | 9 |
| `aci` | 5 | 0 | 0 | 0 | 5 |
| `admin` | 5 | 0 | 0 | 0 | 5 |
| `agent-chat` | 1 | 0 | 0 | 0 | 1 |
| `agent-control` | 0 | 0 | 0 | 1 | 1 |
| `agent-email` | 1 | 0 | 0 | 0 | 1 |
| `agent-runtimes` | 2 | 0 | 0 | 0 | 2 |
| `agent-sessions` | 9 | 0 | 0 | 0 | 9 |
| `agent-templates` | 2 | 0 | 0 | 0 | 2 |
| `agents` | 35 | 0 | 0 | 0 | 35 |
| `analytics` | 1 | 0 | 0 | 0 | 1 |
| `approvals` | 0 | 5 | 0 | 0 | 5 |
| `articles` | 1 | 0 | 0 | 0 | 1 |
| `artifacts` | 7 | 0 | 0 | 0 | 7 |
| `audit-logs` | 2 | 0 | 0 | 0 | 2 |
| `automation` | 12 | 0 | 0 | 0 | 12 |
| `bb` | 1 | 0 | 0 | 1 | 2 |
| `benchmarks` | 0 | 0 | 0 | 1 | 1 |
| `beta` | 4 | 0 | 0 | 1 | 5 |
| `billing` | 0 | 1 | 0 | 0 | 1 |
| `board-items` | 5 | 0 | 0 | 0 | 5 |
| `board-stream` | 1 | 0 | 0 | 0 | 1 |
| `bots` | 9 | 0 | 0 | 24 | 33 |
| `brains` | 3 | 0 | 0 | 0 | 3 |
| `browser` | 0 | 0 | 0 | 1 | 1 |
| `canvases` | 2 | 0 | 0 | 0 | 2 |
| `capsules` | 0 | 0 | 0 | 4 | 4 |
| `capsules{X}` | 0 | 0 | 0 | 1 | 1 |
| `certifications` | 1 | 0 | 0 | 0 | 1 |
| `chat` | 0 | 0 | 0 | 2 | 2 |
| `checkpoints` | 4 | 0 | 0 | 0 | 4 |
| `cli-tools` | 2 | 0 | 0 | 2 | 4 |
| `cloud` | 0 | 0 | 0 | 5 | 5 |
| `cloud-credentials` | 1 | 0 | 0 | 0 | 1 |
| `coding` | 0 | 0 | 0 | 1 | 1 |
| `computers` | 0 | 0 | 0 | 5 | 5 |
| `connectors` | 1 | 0 | 0 | 0 | 1 |
| `conversations` | 1 | 0 | 0 | 0 | 1 |
| `courses` | 1 | 0 | 0 | 0 | 1 |
| `cowork` | 12 | 0 | 0 | 0 | 12 |
| `cowork-preferences` | 1 | 0 | 0 | 0 | 1 |
| `cowork-team` | 1 | 0 | 0 | 0 | 1 |
| `create-personal-access-token` | 0 | 0 | 0 | 1 | 1 |
| `credits` | 0 | 0 | 0 | 2 | 2 |
| `design` | 10 | 0 | 0 | 1 | 11 |
| `desktop-capacity` | 0 | 0 | 0 | 1 | 1 |
| `desktop-sandboxes` | 0 | 0 | 0 | 1 | 1 |
| `desktop-usage` | 0 | 0 | 0 | 1 | 1 |
| `dev` | 0 | 0 | 0 | 1 | 1 |
| `discovery` | 0 | 0 | 0 | 1 | 1 |
| `drive` | 0 | 0 | 0 | 2 | 2 |
| `enrollments` | 2 | 0 | 0 | 0 | 2 |
| `fabric` | 0 | 0 | 0 | 4 | 4 |
| `files` | 4 | 0 | 0 | 1 | 5 |
| `global` | 0 | 0 | 0 | 1 | 1 |
| `h5i` | 13 | 0 | 0 | 1 | 14 |
| `har-derived-api` | 3 | 0 | 0 | 0 | 3 |
| `hosted-runtimes` | 0 | 4 | 0 | 0 | 4 |
| `images` | 0 | 0 | 0 | 1 | 1 |
| `inference-router` | 1 | 0 | 0 | 0 | 1 |
| `infrastructure` | 0 | 0 | 0 | 1 | 1 |
| `ivkge` | 0 | 0 | 0 | 1 | 1 |
| `lessons` | 2 | 0 | 0 | 0 | 2 |
| `library` | 1 | 0 | 0 | 0 | 1 |
| `local-brain` | 5 | 0 | 0 | 0 | 5 |
| `local-engine` | 12 | 0 | 0 | 0 | 12 |
| `local-studio{X}` | 1 | 0 | 0 | 0 | 1 |
| `marketplace` | 0 | 0 | 0 | 1 | 1 |
| `mcp` | 0 | 0 | 0 | 2 | 2 |
| `me` | 2 | 0 | 0 | 0 | 2 |
| `memory` | 6 | 0 | 0 | 0 | 6 |
| `moa` | 0 | 0 | 0 | 1 | 1 |
| `model-lab` | 0 | 0 | 0 | 2 | 2 |
| `models` | 1 | 0 | 0 | 0 | 1 |
| `monitor` | 0 | 0 | 0 | 3 | 3 |
| `nodes` | 0 | 0 | 0 | 2 | 2 |
| `notebooks` | 0 | 0 | 0 | 11 | 11 |
| `oauth` | 2 | 0 | 0 | 0 | 2 |
| `office` | 3 | 0 | 0 | 0 | 3 |
| `onboarding` | 5 | 0 | 0 | 1 | 6 |
| `openclaw` | 0 | 0 | 0 | 1 | 1 |
| `operator` | 0 | 0 | 0 | 2 | 2 |
| `orchestrator` | 1 | 0 | 0 | 0 | 1 |
| `pages` | 0 | 0 | 0 | 3 | 3 |
| `permissions` | 0 | 0 | 0 | 1 | 1 |
| `photon` | 0 | 0 | 0 | 2 | 2 |
| `plugins` | 0 | 0 | 0 | 1 | 1 |
| `policies` | 0 | 0 | 0 | 8 | 8 |
| `promotion` | 0 | 0 | 0 | 2 | 2 |
| `prompts` | 0 | 0 | 0 | 1 | 1 |
| `provider` | 2 | 0 | 0 | 1 | 3 |
| `provider-tokens` | 0 | 2 | 0 | 0 | 2 |
| `providers` | 0 | 10 | 0 | 0 | 10 |
| `purposes` | 0 | 0 | 0 | 4 | 4 |
| `query` | 0 | 0 | 0 | 1 | 1 |
| `questions` | 0 | 0 | 0 | 2 | 2 |
| `rails` | 17 | 0 | 0 | 27 | 44 |
| `runs` | 0 | 0 | 6 | 4 | 10 |
| `runtime` | 1 | 0 | 0 | 10 | 11 |
| `runtime-devices` | 0 | 1 | 0 | 0 | 1 |
| `runtime-pairings` | 0 | 3 | 0 | 0 | 3 |
| `security` | 0 | 0 | 0 | 6 | 6 |
| `session` | 0 | 0 | 0 | 4 | 4 |
| `sessions` | 0 | 0 | 0 | 9 | 9 |
| `sessions{X}` | 0 | 0 | 0 | 1 | 1 |
| `skills` | 4 | 0 | 0 | 0 | 4 |
| `skills{X}` | 1 | 0 | 0 | 0 | 1 |
| `spaces` | 0 | 0 | 0 | 1 | 1 |
| `status` | 0 | 0 | 0 | 1 | 1 |
| `swarm` | 2 | 0 | 0 | 1 | 3 |
| `swarms` | 6 | 0 | 0 | 0 | 6 |
| `tasks` | 0 | 2 | 6 | 0 | 8 |
| `team-skills` | 3 | 0 | 0 | 0 | 3 |
| `terminal` | 0 | 0 | 0 | 8 | 8 |
| `tokens` | 0 | 0 | 0 | 1 | 1 |
| `tools` | 4 | 0 | 0 | 0 | 4 |
| `udemy` | 1 | 0 | 0 | 0 | 1 |
| `usage` | 2 | 0 | 0 | 0 | 2 |
| `verification` | 0 | 0 | 0 | 5 | 5 |
| `voice` | 0 | 0 | 0 | 1 | 1 |
| `web-proxy` | 2 | 0 | 0 | 0 | 2 |
| `webhook-triggers` | 3 | 0 | 0 | 0 | 3 |
| `workflows` | 9 | 0 | 0 | 0 | 9 |
| `workspace` | 0 | 0 | 0 | 3 | 3 |
| `workspaces` | 5 | 0 | 0 | 0 | 5 |

### 2.2 Per-path ownership

`Owner` = `8013` | `cloud` | `both` | `orphan`. Evidence cites the owning route file on each backend.

| Path | :8013 | cloud-api | Owner | Evidence |
|---|---|---|---|---|
| `/api/aci/approve/{X}` | ✓ | — | **8013** | 8013 `aci_routes.rs` |
| `/api/aci/approve/{X}?deny=true` | ✓ | — | **8013** | 8013 `aci_routes.rs` |
| `/api/aci/run` | ✓ | — | **8013** | 8013 `aci_routes.rs` |
| `/api/aci/stop/{X}` | ✓ | — | **8013** | 8013 `aci_routes.rs` |
| `/api/aci/stream/{X}` | ✓ | — | **8013** | 8013 `aci_routes.rs` |
| `/api/agent-chat` | ✓ | — | **8013** | 8013 `v1_routes.rs` |
| `/api/agent-control` | — | — | **orphan** | — |
| `/api/analytics/csp-violation` | ✓ | — | **8013** | 8013 `analytics_routes.rs` |
| `/api/bots` | — | — | **orphan** | — |
| `/api/bots/{X}` | — | — | **orphan** | — |
| `/api/bots/{X}/delegations` | — | — | **orphan** | — |
| `/api/bots/{X}/delegations/{X}/approve` | — | — | **orphan** | — |
| `/api/bots/{X}/goals` | — | — | **orphan** | — |
| `/api/bots/{X}/goals/{X}` | — | — | **orphan** | — |
| `/api/bots/{X}/goals/{X}/cancel` | — | — | **orphan** | — |
| `/api/bots/{X}/goals/{X}/plan` | — | — | **orphan** | — |
| `/api/bots/{X}/goals/{X}/plan/accept` | — | — | **orphan** | — |
| `/api/bots/{X}/goals/{X}/plan/edit` | — | — | **orphan** | — |
| `/api/bots/{X}/goals/{X}/tasks` | — | — | **orphan** | — |
| `/api/bots/{X}/goals/{X}/tasks/{X}` | — | — | **orphan** | — |
| `/api/bots/{X}/goals/{X}/tasks/{X}/attempts` | — | — | **orphan** | — |
| `/api/bots/{X}/goals/{X}/tasks/{X}/attempts/{X}` | — | — | **orphan** | — |
| `/api/bots/{X}/goals/{X}/tasks/{X}/attempts/{X}/cancel` | — | — | **orphan** | — |
| `/api/bots/{X}/goals/{X}/tasks/{X}/validate` | — | — | **orphan** | — |
| `/api/bots/{X}/goals/{X}/tasks/{X}/validations` | — | — | **orphan** | — |
| `/api/bots/{X}/operational-state` | — | — | **orphan** | — |
| `/api/bots/{X}/operational-state/rebuild` | — | — | **orphan** | — |
| `/api/bots/{X}/routines` | — | — | **orphan** | — |
| `/api/bots/{X}/routines/{X}` | — | — | **orphan** | — |
| `/api/bots/{X}/routines/{X}/trigger` | — | — | **orphan** | — |
| `/api/bots/{X}/runs` | — | — | **orphan** | — |
| `/api/bots/{X}/spawn` | — | — | **orphan** | — |
| `/api/browser/capture` | — | — | **orphan** | — |
| `/api/chat` | — | — | **orphan** | — |
| `/api/chat?chatId={X}` | — | — | **orphan** | — |
| `/api/checkpoints` | ✓ | — | **8013** | 8013 `checkpoints_routes.rs` |
| `/api/checkpoints/commit` | ✓ | — | **8013** | 8013 `checkpoints_routes.rs` |
| `/api/checkpoints/tag` | ✓ | — | **8013** | 8013 `checkpoints_routes.rs` |
| `/api/checkpoints/{X}/restore` | ✓ | — | **8013** | 8013 `checkpoints_routes.rs` |
| `/api/coding` | — | — | **orphan** | — |
| `/api/create-personal-access-token` | — | — | **orphan** | — |
| `/api/design/adapters` | ✓ | — | **8013** | 8013 `design_connector_routes.rs` |
| `/api/design/adapters/detect` | ✓ | — | **8013** | 8013 `design_connector_routes.rs` |
| `/api/design/adapters/spawn` | ✓ | — | **8013** | 8013 `design_connector_routes.rs` |
| `/api/design/connectors/github` | ✓ | — | **8013** | 8013 `design_connector_routes.rs` |
| `/api/design/connectors/linear` | ✓ | — | **8013** | 8013 `design_connector_routes.rs` |
| `/api/design/connectors/notion` | ✓ | — | **8013** | 8013 `design_connector_routes.rs` |
| `/api/design/connectors/slack` | ✓ | — | **8013** | 8013 `design_connector_routes.rs` |
| `/api/design/import-url` | — | — | **orphan** | — |
| `/api/design/plugins/install` | ✓ | — | **8013** | 8013 `design_connector_routes.rs` |
| `/api/design/skills/discover` | ✓ | — | **8013** | 8013 `design_connector_routes.rs` |
| `/api/design/skills/discover?{X}` | ✓ | — | **8013** | 8013 `design_connector_routes.rs` |
| `/api/dev/openclaw/agents/discovery` | — | — | **orphan** | — |
| `/api/h5i/agent-hooks/install` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/h5i/claims/list` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/h5i/commit` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/h5i/context/diff` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/h5i/context/finish` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/h5i/context/start` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/h5i/context/trace` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/h5i/files-touched-stream?workspacePath={X}` | — | — | **orphan** | — |
| `/api/h5i/init` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/h5i/mcp/config` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/h5i/status` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/h5i/summarize` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/h5i/summary/list` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/h5i/vibe` | ✓ | — | **8013** | 8013 `h5i_routes.rs` |
| `/api/har-derived-api/client` | ✓ | — | **8013** | 8013 `har_api_routes.rs` |
| `/api/har-derived-api/contracts` | ✓ | — | **8013** | 8013 `har_api_routes.rs` |
| `/api/har-derived-api/ingest` | ✓ | — | **8013** | 8013 `har_api_routes.rs` |
| `/api/infrastructure` | — | — | **orphan** | — |
| `/api/local-brain` | ✓ | — | **8013** | 8013 `local_brain_routes.rs` |
| `/api/local-brain/models` | ✓ | — | **8013** | 8013 `local_brain_routes.rs` |
| `/api/local-brain/models/search?{X}` | ✓ | — | **8013** | 8013 `local_brain_routes.rs` |
| `/api/local-brain/models/{X}` | ✓ | — | **8013** | 8013 `local_brain_routes.rs` |
| `/api/local-brain/pull-custom` | ✓ | — | **8013** | 8013 `local_brain_routes.rs` |
| `/api/local-engine/assess` | ✓ | — | **8013** | 8013 `local_engine_routes.rs` |
| `/api/local-engine/catalog/refresh` | ✓ | — | **8013** | 8013 `local_engine_routes.rs` |
| `/api/local-engine/catalog?{X}` | ✓ | — | **8013** | 8013 `local_engine_routes.rs` |
| `/api/local-engine/health` | ✓ | — | **8013** | 8013 `local_engine_routes.rs` |
| `/api/local-engine/models` | ✓ | — | **8013** | 8013 `local_engine_routes.rs` |
| `/api/local-engine/models/download` | ✓ | — | **8013** | 8013 `local_engine_routes.rs` |
| `/api/local-engine/models/import` | ✓ | — | **8013** | 8013 `local_engine_routes.rs` |
| `/api/local-engine/recommend` | ✓ | — | **8013** | 8013 `local_engine_routes.rs` |
| `/api/local-engine/runtimes` | ✓ | — | **8013** | 8013 `local_engine_routes.rs` |
| `/api/local-engine/runtimes/launch` | ✓ | — | **8013** | 8013 `local_engine_routes.rs` |
| `/api/local-engine/runtimes/{X}/stop` | ✓ | — | **8013** | 8013 `local_engine_routes.rs` |
| `/api/local-engine/status` | ✓ | — | **8013** | 8013 `local_engine_routes.rs` |
| `/api/local-studio{X}` | ✓ | — | **8013** | 8013 `local_studio_routes.rs` (multi-segment `${path}` template: /api/local-studio/v1/…) |
| `/api/mcp/apps` | — | — | **orphan** | — |
| `/api/mcp/sandbox` | — | — | **orphan** | — |
| `/api/moa` | — | — | **orphan** | — |
| `/api/model-lab/jobs` | — | — | **orphan** | — |
| `/api/model-lab/jobs/{X}` | — | — | **orphan** | — |
| `/api/notebooks` | — | — | **orphan** | — |
| `/api/notebooks/{X}` | — | — | **orphan** | — |
| `/api/notebooks/{X}/canvas-sync` | — | — | **orphan** | — |
| `/api/notebooks/{X}/chat/messages` | — | — | **orphan** | — |
| `/api/notebooks/{X}/podcast` | — | — | **orphan** | — |
| `/api/notebooks/{X}/search` | — | — | **orphan** | — |
| `/api/notebooks/{X}/share` | — | — | **orphan** | — |
| `/api/notebooks/{X}/sources` | — | — | **orphan** | — |
| `/api/notebooks/{X}/sources/{X}` | — | — | **orphan** | — |
| `/api/notebooks/{X}/transform` | — | — | **orphan** | — |
| `/api/notebooks/{X}/unshare` | — | — | **orphan** | — |
| `/api/oauth/authorize` | ✓ | — | **8013** | 8013 `oauth_routes.rs` |
| `/api/oauth/revoke-user` | ✓ | — | **8013** | 8013 `oauth_routes.rs` |
| `/api/office/markdown` | ✓ | — | **8013** | 8013 `office_engine_routes.rs` |
| `/api/office/markdown-url` | ✓ | — | **8013** | 8013 `office_engine_routes.rs` |
| `/api/onboarding/config` | ✓ | — | **8013** | 8013 `onboarding_routes.rs` |
| `/api/onboarding/discover` | ✓ | — | **8013** | 8013 `onboarding_routes.rs` |
| `/api/onboarding/init-project` | ✓ | — | **8013** | 8013 `onboarding_routes.rs` |
| `/api/onboarding/provider` | ✓ | — | **8013** | 8013 `onboarding_routes.rs` |
| `/api/onboarding/validate-key` | ✓ | — | **8013** | 8013 `onboarding_routes.rs` |
| `/api/pages` | — | — | **orphan** | — |
| `/api/pages/{X}` | — | — | **orphan** | — |
| `/api/pages/{X}/revisions` | — | — | **orphan** | — |
| `/api/provider/huggingface/search?q={X}` | ✓ | — | **8013** | 8013 `provider_routes.rs` |
| `/api/provider/ollama/models` | ✓ | — | **8013** | 8013 `provider_routes.rs` |
| `/api/rails/context-packs` | — | — | **orphan** | rails-svc /v1/context-pack/seal only |
| `/api/rails/context-packs/seal` | — | — | **orphan** | rails-svc only |
| `/api/rails/context-packs/{X}` | — | — | **orphan** | rails-svc only |
| `/api/rails/dags/{X}/execute` | — | — | **orphan** | rails-svc only |
| `/api/rails/dags/{X}/render` | — | — | **orphan** | rails-svc only |
| `/api/rails/gate/check` | — | — | **orphan** | 8013 router has only /gate/evaluate |
| `/api/rails/gate/decision` | — | — | **orphan** | 8013 router has only /gate/evaluate |
| `/api/rails/gate/mutate` | — | — | **orphan** | 8013 router has only /gate/evaluate |
| `/api/rails/gate/rules` | — | — | **orphan** | 8013 router has only /gate/evaluate |
| `/api/rails/gate/status` | — | — | **orphan** | 8013 router has only /gate/evaluate (mod.rs:273) |
| `/api/rails/gate/verify` | — | — | **orphan** | 8013 router has only /gate/evaluate |
| `/api/rails/health` | ✓ | — | **8013** | rails/mod.rs:201 |
| `/api/rails/index/rebuild` | — | — | **orphan** | rails-svc only |
| `/api/rails/init` | — | — | **orphan** | rails-svc :3011 /v1/init only |
| `/api/rails/leases` | — | — | **orphan** | 8013 router has POST /leases only (mod.rs:264) |
| `/api/rails/leases/{X}` | — | — | **orphan** | not on 8013 router |
| `/api/rails/leases/{X}/renew` | — | — | **orphan** | not on 8013 router |
| `/api/rails/ledger/tail` | ✓ | — | **8013** | rails/mod.rs:215 |
| `/api/rails/ledger/trace` | — | — | **orphan** | rails-svc only |
| `/api/rails/mail/ack` | ✓ | — | **8013** | rails/mod.rs:222 |
| `/api/rails/mail/archive` | — | — | **orphan** | rails-svc only |
| `/api/rails/mail/decide` | ✓ | — | **8013** | rails/mod.rs:224 |
| `/api/rails/mail/guard` | — | — | **orphan** | rails-svc only |
| `/api/rails/mail/inbox/{X}` | ✓ | — | **8013** | rails/mod.rs:228 |
| `/api/rails/mail/reserve` | — | — | **orphan** | rails-svc only |
| `/api/rails/mail/review` | — | — | **orphan** | rails-svc only |
| `/api/rails/mail/share` | ✓ | — | **8013** | rails/mod.rs:223 |
| `/api/rails/mail/thread/{X}` | ✓ | — | **8013** | rails/mod.rs:221 |
| `/api/rails/mail/threads` | ✓ | — | **8013** | rails/mod.rs:220 |
| `/api/rails/plan` | — | — | **orphan** | rails-svc :3011 only |
| `/api/rails/plan/refine` | — | — | **orphan** | rails-svc only |
| `/api/rails/plan/{X}` | — | — | **orphan** | rails-svc /v1/plan/:dag_id only |
| `/api/rails/plans` | — | — | **orphan** | rails-svc :3011 only |
| `/api/rails/receipts` | ✓ | — | **8013** | rails/mod.rs:216 |
| `/api/rails/receipts/write` | ✓ | — | **8013** | rails/mod.rs:217 |
| `/api/rails/receipts/{X}` | — | — | **orphan** | not on 8013 router |
| `/api/rails/runs/{X}/cancel` | — | — | **orphan** | rails-svc only |
| `/api/rails/vault/archive` | ✓ | — | **8013** | rails/mod.rs:276 |
| `/api/rails/vault/status` | ✓ | — | **8013** | rails/mod.rs:275 |
| `/api/rails/wihs` | ✓ | — | **8013** | rails/mod.rs:235 |
| `/api/rails/wihs/pickup` | ✓ | — | **8013** | rails/mod.rs:236 |
| `/api/rails/wihs/{X}/close` | ✓ | — | **8013** | rails/mod.rs:239 |
| `/api/rails/wihs/{X}/context` | ✓ | — | **8013** | rails/mod.rs:237 |
| `/api/rails/wihs/{X}/sign` | ✓ | — | **8013** | rails/mod.rs:238 |
| `/api/runs/{X}` | — | — | **orphan** | — |
| `/api/runs/{X}/cancel` | — | — | **orphan** | — |
| `/api/runs/{X}/retry` | — | — | **orphan** | — |
| `/api/spaces/{X}/pages` | — | — | **orphan** | — |
| `/api/status` | — | — | **orphan** | — |
| `/api/tokens` | — | — | **orphan** | — |
| `/api/v1/a2ui/actions` | — | — | **orphan** | — |
| `/api/v1/a2ui/capsules` | — | — | **orphan** | — |
| `/api/v1/a2ui/capsules/{X}` | — | — | **orphan** | — |
| `/api/v1/a2ui/capsules/{X}/launch` | — | — | **orphan** | — |
| `/api/v1/a2ui/generate` | — | — | **orphan** | — |
| `/api/v1/a2ui/sessions` | — | — | **orphan** | — |
| `/api/v1/a2ui/sessions/{X}` | — | — | **orphan** | — |
| `/api/v1/a2ui/sessions/{X}/data` | — | — | **orphan** | — |
| `/api/v1/a2ui/sessions?chat_id={X}` | — | — | **orphan** | — |
| `/api/v1/admin/fabric/nodes` | ✓ | — | **8013** | 8013 `fabric_node_routes.rs` |
| `/api/v1/admin/fabric/nodes/enrollment-token` | ✓ | — | **8013** | 8013 `fabric_node_routes.rs` |
| `/api/v1/admin/fabric/nodes/enrollment-tokens` | ✓ | — | **8013** | 8013 `fabric_node_routes.rs` |
| `/api/v1/admin/fabric/nodes/{X}/approve` | ✓ | — | **8013** | 8013 `fabric_node_routes.rs` |
| `/api/v1/admin/fabric/nodes/{X}/reject` | ✓ | — | **8013** | 8013 `fabric_node_routes.rs` |
| `/api/v1/agent-email/status` | ✓ | — | **8013** | 8013 `agent_email_routes.rs` |
| `/api/v1/agent-runtimes` | ✓ | — | **8013** | 8013 `agent_runtime_routes.rs` |
| `/api/v1/agent-runtimes?id={X}` | ✓ | — | **8013** | 8013 `agent_runtime_routes.rs` |
| `/api/v1/agent-sessions` | ✓ | — | **8013** | 8013 `agent_session_routes.rs` |
| `/api/v1/agent-sessions/sync` | ✓ | — | **8013** | 8013 `agent_session_routes.rs` |
| `/api/v1/agent-sessions/{X}` | ✓ | — | **8013** | 8013 `agent_session_routes.rs` |
| `/api/v1/agent-sessions/{X}/abort` | ✓ | — | **8013** | 8013 `agent_session_routes.rs` |
| `/api/v1/agent-sessions/{X}/compact` | ✓ | — | **8013** | 8013 `agent_session_routes.rs` |
| `/api/v1/agent-sessions/{X}/messages` | ✓ | — | **8013** | 8013 `agent_session_routes.rs` |
| `/api/v1/agent-sessions/{X}/revert` | ✓ | — | **8013** | 8013 `agent_session_routes.rs` |
| `/api/v1/agent-sessions/{X}/unrevert` | ✓ | — | **8013** | 8013 `agent_session_routes.rs` |
| `/api/v1/agent-sessions/{X}/canvases` | ✓ | — | **8013** | canvas_routes.rs:63 |
| `/api/v1/agent-templates` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agent-templates/{X}` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/from-template` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/metrics?{X}` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/operations/benchmarks/history` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/operations/evaluations` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/operations/evaluations/{X}/results` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/operations/evaluations/{X}/run` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/operations/factory/tasks` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/operations/factory/tasks/{X}/changes/{X}/approve` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/operations/factory/tasks/{X}/changes/{X}/reject` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/operations/gc/agents/{X}/run?projectId={X}` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/operations/gc/cleanup?projectId={X}` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/operations/gc/history?projectId={X}` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/operations/gc/policies/{X}?projectId={X}` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/operations/gc/policies?projectId={X}` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/operations/gc/queue?projectId={X}` | ✓ | — | **8013** | 8013 `agent_operations_routes.rs` |
| `/api/v1/agents/prototype` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/test` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/config` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/connectors/resolve` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/identity/email` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/identity/phone` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/identity/wallet` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/runs` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/runtime/provision` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/runtime/terminate` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/secrets/resolve` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/subagents` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/subagents/{X}` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/subagents/{X}/spawn` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/workflows` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/workflows/{X}` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/workflows/{X}/execute` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/agents/{X}/workspace/initialize` | ✓ | — | **8013** | 8013 `agent_routes.rs` |
| `/api/v1/approvals/pending` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/approvals/{X}` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/approvals/{X}/cancel` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/approvals/{X}/decision` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/approvals/{X}/escalate` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/articles?status=published` | ✓ | — | **8013** | 8013 `alabs_routes.rs` |
| `/api/v1/artifacts` | ✓ | — | **8013** | 8013 `artifact_routes.rs` |
| `/api/v1/artifacts/search?{X}` | ✓ | — | **8013** | 8013 `artifact_routes.rs` |
| `/api/v1/artifacts/stats` | ✓ | — | **8013** | 8013 `artifact_routes.rs` |
| `/api/v1/artifacts/{X}` | ✓ | — | **8013** | 8013 `artifact_routes.rs` |
| `/api/v1/artifacts/{X}/revisions` | ✓ | — | **8013** | 8013 `artifact_routes.rs` |
| `/api/v1/artifacts/{X}/sections` | ✓ | — | **8013** | 8013 `artifact_routes.rs` |
| `/api/v1/artifacts/{X}/sections/{X}` | ✓ | — | **8013** | 8013 `artifact_routes.rs` |
| `/api/v1/audit-logs` | ✓ | — | **8013** | 8013 `audit_log_routes.rs` |
| `/api/v1/audit-logs?taskId={X}&page={X}&limit=20` | ✓ | — | **8013** | 8013 `audit_log_routes.rs` |
| `/api/v1/automation/goals` | ✓ | — | **8013** | 8013 `automation_routes.rs` |
| `/api/v1/automation/goals/{X}` | ✓ | — | **8013** | 8013 `automation_routes.rs` |
| `/api/v1/automation/goals/{X}/children` | ✓ | — | **8013** | 8013 `automation_routes.rs` |
| `/api/v1/automation/local-schedules` | ✓ | — | **8013** | 8013 `automation_routes.rs` |
| `/api/v1/automation/loops` | ✓ | — | **8013** | 8013 `automation_routes.rs` |
| `/api/v1/automation/loops/{X}` | ✓ | — | **8013** | 8013 `automation_routes.rs` |
| `/api/v1/automation/loops/{X}/run` | ✓ | — | **8013** | 8013 `automation_routes.rs` |
| `/api/v1/automation/routines` | ✓ | — | **8013** | 8013 `automation_routes.rs` |
| `/api/v1/automation/routines/{X}` | ✓ | — | **8013** | 8013 `automation_routes.rs` |
| `/api/v1/automation/routines/{X}/metrics` | ✓ | — | **8013** | 8013 `automation_routes.rs` |
| `/api/v1/automation/routines/{X}/run` | ✓ | — | **8013** | 8013 `automation_routes.rs` |
| `/api/v1/automation/routines/{X}/runs` | ✓ | — | **8013** | 8013 `automation_routes.rs` |
| `/api/v1/bb` | — | — | **orphan** | — |
| `/api/v1/bb/projects` | ✓ | — | **8013** | 8013 `bb/routes.rs` |
| `/api/v1/benchmarks/computer-use-leaderboard` | — | — | **orphan** | — |
| `/api/v1/beta/*` | — | — | **orphan** | — |
| `/api/v1/beta/research` | ✓ | — | **8013** | 8013 `research_task_routes.rs` |
| `/api/v1/beta/sessions/{X}/events/list` | ✓ | — | **8013** | 8013 `beta_session_routes.rs` |
| `/api/v1/beta/sessions/{X}/memory/search?q={X}` | ✓ | — | **8013** | 8013 `beta_session_routes.rs` |
| `/api/v1/beta/sessions/{X}/run` | ✓ | — | **8013** | 8013 `beta_session_routes.rs` |
| `/api/v1/billing/credits` | — | ✓ | **cloud** | cloud `routes/billing_credits.rs` |
| `/api/v1/board-items` | ✓ | — | **8013** | 8013 `board_routes.rs` |
| `/api/v1/board-items/{X}` | ✓ | — | **8013** | 8013 `board_routes.rs` |
| `/api/v1/board-items/{X}/assign` | ✓ | — | **8013** | 8013 `board_routes.rs` |
| `/api/v1/board-items/{X}/comments` | ✓ | — | **8013** | 8013 `board_routes.rs` |
| `/api/v1/board-items?workspaceId={X}` | ✓ | — | **8013** | 8013 `board_routes.rs` |
| `/api/v1/board-stream/{X}` | ✓ | — | **8013** | 8013 `board_stream_routes.rs` |
| `/api/v1/bots/{X}/desktop/deprovision` | ✓ | — | **8013** | 8013 `bot_desktop_routes.rs` |
| `/api/v1/bots/{X}/desktop/files/download?sandbox_id={X}&path={X}` | ✓ | — | **8013** | 8013 `bot_desktop_routes.rs` |
| `/api/v1/bots/{X}/desktop/files/upload?sandbox_id={X}&path={X}` | ✓ | — | **8013** | 8013 `bot_desktop_routes.rs` |
| `/api/v1/bots/{X}/desktop/keyboard?sandbox_id={X}` | ✓ | — | **8013** | 8013 `bot_desktop_routes.rs` |
| `/api/v1/bots/{X}/desktop/mouse?sandbox_id={X}` | ✓ | — | **8013** | 8013 `bot_desktop_routes.rs` |
| `/api/v1/bots/{X}/desktop/screenshot?sandbox_id={X}` | ✓ | — | **8013** | 8013 `bot_desktop_routes.rs` |
| `/api/v1/bots/{X}/desktop/shell?sandbox_id={X}` | ✓ | — | **8013** | 8013 `bot_desktop_routes.rs` |
| `/api/v1/bots/{X}/desktop/start` | ✓ | — | **8013** | 8013 `bot_desktop_routes.rs` |
| `/api/v1/bots/{X}/desktop/stop` | ✓ | — | **8013** | 8013 `bot_desktop_routes.rs` |
| `/api/v1/brains` | ✓ | — | **8013** | 8013 `brain_routes.rs` |
| `/api/v1/brains/{X}/models/validate` | ✓ | — | **8013** | 8013 `brain_routes.rs` |
| `/api/v1/brains/{X}/pages` | ✓ | — | **8013** | 8013 `brain_routes.rs` |
| `/api/v1/canvases` | ✓ | — | **8013** | canvas_routes.rs:61 |
| `/api/v1/canvases/{X}` | ✓ | — | **8013** | canvas_routes.rs:67 |
| `/api/v1/capsules` | — | — | **orphan** | — |
| `/api/v1/capsules/{X}` | — | — | **orphan** | — |
| `/api/v1/capsules/{X}/execute` | — | — | **orphan** | — |
| `/api/v1/capsules/{X}/verify` | — | — | **orphan** | — |
| `/api/v1/capsules{X}` | — | — | **orphan** | — |
| `/api/v1/certifications` | ✓ | — | **8013** | 8013 `alabs_routes.rs` |
| `/api/v1/cloud-credentials` | ✓ | — | **8013** | 8013 `cloud_credentials_routes.rs` |
| `/api/v1/cloud/wizard/deployments` | — | — | **orphan** | — |
| `/api/v1/cli-tools` | ✓ | — | **8013** | 8013 `v1_routes.rs` (stub) |
| `/api/v1/cli-tools/check` | — | — | **orphan** | stub-only on :8013 (`/cli-tools`, `/cli-tools/installed`) |
| `/api/v1/cli-tools/discover` | — | — | **orphan** | stub-only on :8013 |
| `/api/v1/cli-tools/installed` | ✓ | — | **8013** | 8013 `v1_routes.rs` (stub) |
| `/api/v1/cloud/wizard/deployments/{X}` | — | — | **orphan** | — |
| `/api/v1/cloud/wizard/deployments/{X}/advance` | — | — | **orphan** | — |
| `/api/v1/cloud/wizard/deployments/{X}/bootstrap` | — | — | **orphan** | — |
| `/api/v1/cloud/wizard/deployments/{X}/cancel` | — | — | **orphan** | — |
| `/api/v1/computers` | — | — | **orphan** | — |
| `/api/v1/computers/{X}` | — | — | **orphan** | — |
| `/api/v1/computers/{X}/delete` | — | — | **orphan** | — |
| `/api/v1/computers/{X}/start` | — | — | **orphan** | — |
| `/api/v1/computers/{X}/stop` | — | — | **orphan** | — |
| `/api/v1/connectors` | ✓ | — | **8013** | 8013 `connector_routes.rs` |
| `/api/v1/conversations` | ✓ | — | **8013** | 8013 `conversation_routes.rs` |
| `/api/v1/courses` | ✓ | — | **8013** | 8013 `alabs_routes.rs` |
| `/api/v1/cowork-preferences` | ✓ | — | **8013** | 8013 `cowork_preferences_routes.rs` |
| `/api/v1/cowork-team/parse-prd` | ✓ | — | **8013** | 8013 `cowork_team_routes.rs` |
| `/api/v1/cowork/approvals` | ✓ | — | **8013** | 8013 `cowork_routes.rs` |
| `/api/v1/cowork/memory` | ✓ | — | **8013** | 8013 `cowork_routes.rs` |
| `/api/v1/cowork/memory/search?query={X}&limit=10` | ✓ | — | **8013** | 8013 `cowork_routes.rs` |
| `/api/v1/cowork/memory?limit=10&format=context` | ✓ | — | **8013** | 8013 `cowork_routes.rs` |
| `/api/v1/cowork/personas` | ✓ | — | **8013** | 8013 `cowork_routes.rs` |
| `/api/v1/cowork/projects` | ✓ | — | **8013** | 8013 `cowork_routes.rs` |
| `/api/v1/cowork/projects/{X}` | ✓ | — | **8013** | 8013 `cowork_routes.rs` |
| `/api/v1/cowork/sessions` | ✓ | — | **8013** | 8013 `cowork_routes.rs` |
| `/api/v1/cowork/sessions/{X}` | ✓ | — | **8013** | 8013 `cowork_routes.rs` |
| `/api/v1/cowork/sessions?limit=30` | ✓ | — | **8013** | 8013 `cowork_routes.rs` |
| `/api/v1/cowork/tasks` | ✓ | — | **8013** | 8013 `cowork_routes.rs` |
| `/api/v1/cowork/team-execute` | ✓ | — | **8013** | 8013 `cowork_routes.rs` |
| `/api/v1/credits/balance` | — | — | **orphan** | — |
| `/api/v1/credits/transactions` | — | — | **orphan** | — |
| `/api/v1/desktop-capacity` | — | — | **orphan** | — |
| `/api/v1/desktop-sandboxes` | — | — | **orphan** | — |
| `/api/v1/desktop-usage/summary` | — | — | **orphan** | — |
| `/api/v1/discovery/feed` | — | — | **orphan** | — |
| `/api/v1/drive/assets` | — | — | **orphan** | — |
| `/api/v1/drive/assets?sessionId={X}` | — | — | **orphan** | — |
| `/api/v1/enrollments` | ✓ | — | **8013** | 8013 `alabs_routes.rs` |
| `/api/v1/enrollments?courseId={X}&lessonId={X}` | ✓ | — | **8013** | 8013 `alabs_routes.rs` |
| `/api/v1/fabric/resource-classes` | — | — | **orphan** | — |
| `/api/v1/fabric/resources` | — | — | **orphan** | — |
| `/api/v1/fabric/resources/{X}` | — | — | **orphan** | — |
| `/api/v1/fabric/resources/{X}/terminate` | — | — | **orphan** | — |
| `/api/v1/files/write` | ✓ | — | **8013** | 8013 `file_routes.rs` |
| `/api/v1/files/{X}?{X}` | ✓ | — | **8013** | 8013 `file_routes.rs` |
| `/api/v1/files/exists?{X}` | ✓ | — | **8013** | 8013 `file_routes.rs` |
| `/api/v1/files/list?{X}` | ✓ | — | **8013** | 8013 `file_routes.rs` |
| `/api/v1/files/search` | — | — | **orphan** | not on 8013 `file_routes.rs` |
| `/api/v1/hosted-runtimes` | — | ✓ | **cloud** | cloud `routes/hosted_runtimes.rs` |
| `/api/v1/hosted-runtimes/entitlement` | — | ✓ | **cloud** | cloud `routes/hosted_runtimes.rs` |
| `/api/v1/hosted-runtimes/{X}/start` | — | ✓ | **cloud** | cloud `routes/hosted_runtimes.rs` |
| `/api/v1/hosted-runtimes/{X}/stop` | — | ✓ | **cloud** | cloud `routes/hosted_runtimes.rs` |
| `/api/v1/images/generate` | — | — | **orphan** | — |
| `/api/v1/inference-router/cli-status` | ✓ | — | **8013** | 8013 `inference_router_routes.rs` |
| `/api/v1/ivkge` | — | — | **orphan** | — |
| `/api/v1/lessons/generate` | ✓ | — | **8013** | 8013 `alabs_routes.rs` |
| `/api/v1/lessons?status=published` | ✓ | — | **8013** | 8013 `alabs_routes.rs` |
| `/api/v1/library/stats` | ✓ | — | **8013** | 8013 `library_routes.rs` |
| `/api/v1/marketplace` | — | — | **orphan** | — |
| `/api/v1/me` | ✓ | — | **8013** | 8013 `me_routes.rs` |
| `/api/v1/me/organization` | ✓ | — | **8013** | 8013 `me_routes.rs` |
| `/api/v1/memory/consolidate` | ✓ | — | **8013** | 8013 `memory_routes.rs` |
| `/api/v1/memory/edges` | ✓ | — | **8013** | 8013 `memory_routes.rs` |
| `/api/v1/memory/entities` | ✓ | — | **8013** | 8013 `memory_routes.rs` |
| `/api/v1/memory/events` | ✓ | — | **8013** | 8013 `memory_routes.rs` |
| `/api/v1/memory/health` | ✓ | — | **8013** | 8013 `memory_routes.rs` |
| `/api/v1/memory/stats` | ✓ | — | **8013** | 8013 `memory_routes.rs` |
| `/api/v1/models` | ✓ | — | **8013** | 8013 `v1_routes.rs` |
| `/api/v1/monitor/agents` | — | — | **orphan** | — |
| `/api/v1/monitor/logs` | — | — | **orphan** | — |
| `/api/v1/monitor/system` | — | — | **orphan** | — |
| `/api/v1/nodes` | — | — | **orphan** | — |
| `/api/v1/nodes/{X}/terminal` | — | — | **orphan** | — |
| `/api/v1/office/bindings` | ✓ | — | **8013** | 8013 `office_routes.rs` |
| `/api/v1/onboarding/provider` | — | — | **orphan** | — |
| `/api/v1/openclaw/agents/discovery` | — | — | **orphan** | — |
| `/api/v1/operator/events/{X}` | — | — | **orphan** | — |
| `/api/v1/operator/execute` | — | — | **orphan** | — |
| `/api/v1/orchestrator` | ✓ | — | **8013** | 8013 `orchestrator_routes.rs` |
| `/api/v1/permissions/{X}/reply` | — | — | **orphan** | — |
| `/api/v1/photon/send` | — | — | **orphan** | — |
| `/api/v1/photon/stream` | — | — | **orphan** | — |
| `/api/v1/plugins/marketplace/submit` | — | — | **orphan** | — |
| `/api/v1/policies` | — | — | **orphan** | — |
| `/api/v1/policies/violations/{X}` | — | — | **orphan** | — |
| `/api/v1/policies/violations/{X}/escalate` | — | — | **orphan** | — |
| `/api/v1/policies/violations/{X}/resolve` | — | — | **orphan** | — |
| `/api/v1/policies/{X}` | — | — | **orphan** | — |
| `/api/v1/policies/{X}/clone` | — | — | **orphan** | — |
| `/api/v1/policies/{X}/disable` | — | — | **orphan** | — |
| `/api/v1/policies/{X}/enable` | — | — | **orphan** | — |
| `/api/v1/promotion/proposals` | — | — | **orphan** | — |
| `/api/v1/promotion/proposals/{X}/decision` | — | — | **orphan** | — |
| `/api/v1/prompts/test` | — | — | **orphan** | — |
| `/api/v1/provider-tokens` | — | ✓ | **cloud** | cloud `routes/providers.rs` |
| `/api/v1/provider-tokens/{X}` | — | ✓ | **cloud** | cloud `routes/providers.rs` |
| `/api/v1/provider/ollama/status` | — | — | **orphan** | — |
| `/api/v1/providers` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/providers/auth/status` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/providers/minimax/auth/status` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/providers/video/generate` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/providers/{X}/auth/status` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/providers/{X}/connect` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/providers/{X}/connect/confirm` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/providers/{X}/connect/status` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/providers/{X}/models` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/providers/{X}/models/validate` | — | ✓ | **cloud** | cloud `lib.rs` |
| `/api/v1/purposes` | — | — | **orphan** | — |
| `/api/v1/purposes/bind` | — | — | **orphan** | — |
| `/api/v1/purposes/unbind` | — | — | **orphan** | — |
| `/api/v1/purposes/{X}` | — | — | **orphan** | — |
| `/api/v1/query` | — | — | **orphan** | — |
| `/api/v1/questions/{X}/reject` | — | — | **orphan** | — |
| `/api/v1/questions/{X}/reply` | — | — | **orphan** | — |
| `/api/v1/runs` | ✓ | ✓ | **both** | 8013 `rails/routes_cowork.rs`; cloud `lib.rs` |
| `/api/v1/runs/{X}/cancel` | ✓ | ✓ | **both** | 8013 `rails/routes_cowork.rs`; cloud `lib.rs` |
| `/api/v1/runs/{X}/events/stream` | ✓ | ✓ | **both** | 8013 `rails/routes_cowork.rs`; cloud `lib.rs` |
| `/api/v1/runs/{X}/handoffs` | ✓ | ✓ | **both** | 8013 `rails/routes_cowork.rs`; cloud `lib.rs` |
| `/api/v1/runs/{X}/jobs` | ✓ | ✓ | **both** | 8013 `rails/routes_cowork.rs`; cloud `lib.rs` |
| `/api/v1/runs/{X}/recover` | — | — | **orphan** | — |
| `/api/v1/runs/{X}/start` | ✓ | ✓ | **both** | 8013 `rails/routes_cowork.rs`; cloud `lib.rs` |
| `/api/v1/runtime-devices` | — | ✓ | **cloud** | cloud `routes/runtime_pairing.rs` |
| `/api/v1/runtime-pairings/code/{X}` | — | ✓ | **cloud** | cloud `routes/runtime_pairing.rs` |
| `/api/v1/runtime-pairings/code/{X}/approve` | — | ✓ | **cloud** | cloud `routes/runtime_pairing.rs` |
| `/api/v1/runtime-pairings/code/{X}/deny` | — | ✓ | **cloud** | cloud `routes/runtime_pairing.rs` |
| `/api/v1/runtime/backend` | ✓ | — | **8013** | 8013 `runtime_backend_routes.rs` |
| `/api/v1/runtime/budget` | — | — | **orphan** | — |
| `/api/v1/runtime/budget/quota` | — | — | **orphan** | — |
| `/api/v1/runtime/drivers` | — | — | **orphan** | — |
| `/api/v1/runtime/prewarm/pool` | — | — | **orphan** | — |
| `/api/v1/runtime/prewarm/status` | — | — | **orphan** | — |
| `/api/v1/runtime/prewarm/warmup` | — | — | **orphan** | — |
| `/api/v1/runtime/replay/sessions` | — | — | **orphan** | — |
| `/api/v1/runtime/replay/sessions/{X}/execute` | — | — | **orphan** | — |
| `/api/v1/runtime/settings` | — | — | **orphan** | — |
| `/api/v1/runtime/settings/reset` | — | — | **orphan** | — |
| `/api/v1/security/compliance` | — | — | **orphan** | — |
| `/api/v1/security/compliance/assess` | — | — | **orphan** | — |
| `/api/v1/security/events/{X}` | — | — | **orphan** | — |
| `/api/v1/security/events/{X}/acknowledge` | — | — | **orphan** | — |
| `/api/v1/security/events/{X}/resolve` | — | — | **orphan** | — |
| `/api/v1/security/overview` | — | — | **orphan** | — |
| `/api/v1/sessions` | — | — | **orphan** | — |
| `/api/v1/sessions/archived` | — | — | **orphan** | — |
| `/api/v1/sessions/{X}` | — | — | **orphan** | — |
| `/api/v1/sessions/{X}/chat` | — | — | **orphan** | — |
| `/api/v1/sessions/{X}/messages?limit={X}&offset={X}` | — | — | **orphan** | — |
| `/api/v1/sessions/{X}/permission` | — | — | **orphan** | — |
| `/api/v1/sessions/{X}/question/reject` | — | — | **orphan** | — |
| `/api/v1/sessions/{X}/question/reply` | — | — | **orphan** | — |
| `/api/v1/sessions/{X}/restore` | — | — | **orphan** | — |
| `/api/v1/sessions{X}` | — | — | **orphan** | — |
| `/api/v1/skills` | ✓ | — | **8013** | 8013 `skills_routes.rs` |
| `/api/v1/skills/registry` | ✓ | — | **8013** | 8013 `skills_routes.rs` |
| `/api/v1/skills/{X}` | ✓ | — | **8013** | 8013 `skills_routes.rs` |
| `/api/v1/skills/{X}/exec` | ✓ | — | **8013** | 8013 `skills_routes.rs` |
| `/api/v1/skills{X}` | ✓ | — | **8013** | 8013 `skills_routes.rs` (query-template variant of /api/v1/skills) |
| `/api/v1/swarm` | — | — | **orphan** | — |
| `/api/v1/swarm/health` | ✓ | — | **8013** | 8013 `swarm_routes.rs` |
| `/api/v1/swarm/threads` | ✓ | — | **8013** | 8013 `swarm_routes.rs` |
| `/api/v1/swarms` | ✓ | — | **8013** | 8013 `swarm_routes.rs` |
| `/api/v1/swarms/runs/{X}/messages` | ✓ | — | **8013** | 8013 `swarm_routes.rs` |
| `/api/v1/swarms/{X}` | ✓ | — | **8013** | 8013 `swarm_routes.rs` |
| `/api/v1/swarms/{X}/agents` | ✓ | — | **8013** | 8013 `swarm_routes.rs` |
| `/api/v1/swarms/{X}/agents/{X}` | ✓ | — | **8013** | 8013 `swarm_routes.rs` |
| `/api/v1/swarms/{X}/runs` | ✓ | — | **8013** | 8013 `swarm_routes.rs` |
| `/api/v1/tasks` | ✓ | ✓ | **both** | 8013 `task_routes.rs`; cloud `routes/tasks.rs` |
| `/api/v1/tasks/stream?workspace_id={X}` | — | ✓ | **cloud** | cloud `routes/tasks.rs` |
| `/api/v1/tasks/stream?workspace_id={X}&token={X}` | — | ✓ | **cloud** | cloud `routes/tasks.rs` |
| `/api/v1/tasks/{X}` | ✓ | ✓ | **both** | 8013 `task_routes.rs`; cloud `routes/tasks.rs` |
| `/api/v1/tasks/{X}/assign` | ✓ | ✓ | **both** | 8013 `task_routes.rs`; cloud `routes/tasks.rs` |
| `/api/v1/tasks/{X}/audit-logs` | ✓ | ✓ | **both** | 8013 `task_routes.rs`; cloud `routes/tasks.rs` |
| `/api/v1/tasks/{X}/comments` | ✓ | ✓ | **both** | 8013 `task_routes.rs`; cloud `routes/tasks.rs` |
| `/api/v1/tasks?workspace_id={X}&limit=100` | ✓ | ✓ | **both** | 8013 `task_routes.rs`; cloud `routes/tasks.rs` |
| `/api/v1/team-skills` | ✓ | — | **8013** | 8013 `team_skill_routes.rs` |
| `/api/v1/team-skills/{X}` | ✓ | — | **8013** | 8013 `team_skill_routes.rs` |
| `/api/v1/team-skills?workspaceId={X}` | ✓ | — | **8013** | 8013 `team_skill_routes.rs` |
| `/api/v1/terminal/sessions/{X}/status` | — | — | **orphan** | — |
| `/api/v1/terminal/{X}` | — | — | **orphan** | — |
| `/api/v1/terminal/{X}/files/download?path={X}` | — | — | **orphan** | — |
| `/api/v1/terminal/{X}/files/list?path={X}` | — | — | **orphan** | — |
| `/api/v1/terminal/{X}/files/mkdir?path={X}` | — | — | **orphan** | — |
| `/api/v1/terminal/{X}/files/stat?path={X}` | — | — | **orphan** | — |
| `/api/v1/terminal/{X}/files/upload?path={X}` | — | — | **orphan** | — |
| `/api/v1/terminal/{X}/files?path={X}` | — | — | **orphan** | — |
| `/api/v1/tools` | ✓ | — | **8013** | 8013 `tool_routes.rs` |
| `/api/v1/tools/execute` | ✓ | — | **8013** | 8013 `tool_routes.rs` |
| `/api/v1/tools/{X}` | ✓ | — | **8013** | 8013 `tool_routes.rs` |
| `/api/v1/tools/{X}/execute` | ✓ | — | **8013** | 8013 `tool_routes.rs` |
| `/api/v1/udemy/search` | ✓ | — | **8013** | 8013 `udemy_routes.rs` |
| `/api/v1/usage/summary` | ✓ | — | **8013** | 8013 `usage_routes.rs` |
| `/api/v1/usage/summary?{X}` | ✓ | — | **8013** | 8013 `usage_routes.rs` |
| `/api/v1/voice` | — | — | **orphan** | — |
| `/api/v1/webhook-triggers` | ✓ | — | **8013** | 8013 `webhook_trigger_routes.rs` |
| `/api/v1/webhook-triggers/{X}` | ✓ | — | **8013** | 8013 `webhook_trigger_routes.rs` |
| `/api/v1/webhook-triggers/{X}/deliveries` | ✓ | — | **8013** | 8013 `webhook_trigger_routes.rs` |
| `/api/v1/workflows` | ✓ | — | **8013** | 8013 `workflow_routes.rs` |
| `/api/v1/workflows/runs/{X}/pause` | ✓ | — | **8013** | 8013 `workflow_routes.rs` |
| `/api/v1/workflows/runs/{X}/resume` | ✓ | — | **8013** | 8013 `workflow_routes.rs` |
| `/api/v1/workflows/validate` | ✓ | — | **8013** | 8013 `workflow_routes.rs` |
| `/api/v1/workflows/{X}` | ✓ | — | **8013** | 8013 `workflow_routes.rs` |
| `/api/v1/workflows/{X}/execute` | ✓ | — | **8013** | 8013 `workflow_routes.rs` |
| `/api/v1/workflows/{X}/executions/{X}/cancel` | ✓ | — | **8013** | 8013 `workflow_routes.rs` |
| `/api/v1/workflows/{X}/run` | ✓ | — | **8013** | 8013 `workflow_routes.rs` |
| `/api/v1/workflows/{X}/runs` | ✓ | — | **8013** | 8013 `workflow_routes.rs` |
| `/api/v1/workspace/exports` | — | — | **orphan** | — |
| `/api/v1/workspace/files` | — | — | **orphan** | — |
| `/api/v1/workspace/tables` | — | — | **orphan** | — |
| `/api/v1/workspaces` | ✓ | — | **8013** | 8013 `workspace_routes.rs` |
| `/api/v1/workspaces/join?token={X}` | ✓ | — | **8013** | 8013 `workspace_routes.rs` |
| `/api/v1/workspaces/{X}/invites` | ✓ | — | **8013** | 8013 `workspace_routes.rs` |
| `/api/v1/workspaces/{X}/members` | ✓ | — | **8013** | 8013 `workspace_routes.rs` |
| `/api/v1/workspaces/{X}/members?id={X}` | ✓ | — | **8013** | 8013 `workspace_routes.rs` |
| `/api/verification` | — | — | **orphan** | — |
| `/api/verification/{X}` | — | — | **orphan** | — |
| `/api/verification/{X}/bypass` | — | — | **orphan** | — |
| `/api/verification/{X}/start` | — | — | **orphan** | — |
| `/api/verification/{X}/trend?days={X}` | — | — | **orphan** | — |
| `/api/web-proxy` | ✓ | — | **8013** | 8013 `web_proxy_routes.rs` |
| `/v1/global/event` | — | — | **orphan** | gizzi-code native surface; client connects directly (Basic auth), bypasses both Rust backends |
| `/v1/session/list` | — | — | **orphan** | gizzi-code native surface |
| `/v1/session/status` | — | — | **orphan** | gizzi-code native surface |
| `/v1/session/{X}/replay` | — | — | **orphan** | gizzi-code native surface |
| `/v1/session/{X}/support-bundle` | — | — | **orphan** | gizzi-code native surface |
| `/api/web-proxy?url={X}` | ✓ | — | **8013** | 8013 `web_proxy_routes.rs` |


### 2.3 Orphans (neither backend serves them)

- `/api/agent-control` (lib/agents/scheduled-jobs.service.ts:87)
- `/api/bots` (lib/bots/orpc-contracts.ts:322)
- `/api/bots/{X}` (lib/bots/orpc-contracts.ts:329) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/delegations` (lib/bots/orpc-contracts.ts:645) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/delegations/{X}/approve` (lib/bots/orpc-contracts.ts:662) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals` (lib/bots/orpc-contracts.ts:454) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals/{X}` (lib/bots/orpc-contracts.ts:461) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals/{X}/cancel` (lib/bots/orpc-contracts.ts:495) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals/{X}/plan` (lib/bots/orpc-contracts.ts:506) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals/{X}/plan/accept` (lib/bots/orpc-contracts.ts:528) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals/{X}/plan/edit` (lib/bots/orpc-contracts.ts:535) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals/{X}/tasks` (lib/bots/orpc-contracts.ts:554) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals/{X}/tasks/{X}` (lib/bots/orpc-contracts.ts:561) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals/{X}/tasks/{X}/attempts` (lib/bots/orpc-contracts.ts:596) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals/{X}/tasks/{X}/attempts/{X}` (lib/bots/orpc-contracts.ts:610) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals/{X}/tasks/{X}/attempts/{X}/cancel` (lib/bots/orpc-contracts.ts:617) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals/{X}/tasks/{X}/validate` (lib/bots/orpc-contracts.ts:580) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/goals/{X}/tasks/{X}/validations` (lib/bots/orpc-contracts.ts:634) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/operational-state` (lib/bots/orpc-contracts.ts:364) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/operational-state/rebuild` (lib/bots/orpc-contracts.ts:371) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/routines` (lib/bots/orpc-contracts.ts:383) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/routines/{X}` (lib/bots/orpc-contracts.ts:397) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/routines/{X}/trigger` (lib/bots/orpc-contracts.ts:411) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/runs` (lib/bots/orpc-contracts.ts:422) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/bots/{X}/spawn` (lib/bots/orpc-contracts.ts:357) — contract-only (orpc-contracts.ts spec; no fetch transport wired)
- `/api/browser/capture` (capsules/browser/extension-sidepanel/useBrowserCapture.ts:28)
- `/api/chat` (lib/ai/rust-stream-adapter.ts:1911)
- `/api/chat?chatId={X}` (lib/ai/rust-stream-adapter.ts:1945)
- `/api/coding` (components/onboarding/OnboardingFlow.tsx:1691)
- `/api/create-personal-access-token` (views/cloud-deploy/data/providers.ts:108)
- `/api/design/import-url` (views/design/DesignImportModal.tsx:43)
- `/api/dev/openclaw/agents/discovery` (lib/agents/openclaw-discovery.ts:109)
- `/api/h5i/files-touched-stream?workspacePath={X}` (components/h5i/useFilesTouched.ts:28)
- `/api/infrastructure` (shell/EnvironmentSelector.tsx:28)
- `/api/mcp/apps` (lib/ai/mcp/app-bridge-api.ts:3)
- `/api/mcp/sandbox` (lib/ai/mcp/sandbox-client.ts:16)
- `/api/moa` (lib/api/moa-client.ts:9)
- `/api/model-lab/jobs` (lib/model-lab/api.ts:226)
- `/api/model-lab/jobs/{X}` (lib/model-lab/api.ts:231)
- `/api/notebooks` (views/research/hooks/useNotebookApi.ts:75)
- `/api/notebooks/{X}` (views/research/hooks/useNotebookApi.ts:80)
- `/api/notebooks/{X}/canvas-sync` (views/research/hooks/useNotebookApi.ts:160)
- `/api/notebooks/{X}/chat/messages` (views/research/hooks/useNotebookApi.ts:107)
- `/api/notebooks/{X}/podcast` (views/research/hooks/useNotebookApi.ts:178)
- `/api/notebooks/{X}/search` (views/research/hooks/useNotebookApi.ts:148)
- `/api/notebooks/{X}/share` (views/research/hooks/useNotebookApi.ts:84)
- `/api/notebooks/{X}/sources` (views/research/hooks/useNotebookApi.ts:96)
- `/api/notebooks/{X}/sources/{X}` (views/research/hooks/useNotebookApi.ts:103)
- `/api/notebooks/{X}/transform` (views/research/hooks/useNotebookApi.ts:171)
- `/api/notebooks/{X}/unshare` (views/research/hooks/useNotebookApi.ts:89)
- `/api/pages` (services/docmost/DocmostAdapter.ts:79)
- `/api/pages/{X}` (services/docmost/DocmostAdapter.ts:67)
- `/api/pages/{X}/revisions` (services/docmost/DocmostAdapter.ts:106)
- `/api/rails/context-packs` (lib/agents/rails.service.ts:379)
- `/api/rails/context-packs/seal` (lib/agents/rails.service.ts:379)
- `/api/rails/context-packs/{X}` (lib/agents/rails.service.ts:379)
- `/api/rails/dags/{X}/execute` (lib/agents/rails.service.ts:379)
- `/api/rails/dags/{X}/render` (lib/agents/rails.service.ts:379)
- `/api/rails/gate/check` (lib/agents/rails.service.ts:379)
- `/api/rails/gate/decision` (lib/agents/rails.service.ts:379)
- `/api/rails/gate/mutate` (lib/agents/rails.service.ts:379)
- `/api/rails/gate/rules` (lib/agents/rails.service.ts:379)
- `/api/rails/gate/status` (lib/agents/rails.service.ts:379)
- `/api/rails/gate/verify` (lib/agents/rails.service.ts:379)
- `/api/rails/index/rebuild` (lib/agents/rails.service.ts:379)
- `/api/rails/init` (lib/agents/rails.service.ts:379)
- `/api/rails/leases` (lib/agents/rails.service.ts:379)
- `/api/rails/leases/{X}` (lib/agents/rails.service.ts:379)
- `/api/rails/leases/{X}/renew` (lib/agents/rails.service.ts:379)
- `/api/rails/ledger/trace` (lib/agents/rails.service.ts:379)
- `/api/rails/mail/archive` (lib/agents/rails.service.ts:379)
- `/api/rails/mail/guard` (lib/agents/rails.service.ts:379)
- `/api/rails/mail/reserve` (lib/agents/rails.service.ts:379)
- `/api/rails/mail/review` (lib/agents/rails.service.ts:379)
- `/api/rails/plan` (lib/agents/rails.service.ts:379)
- `/api/rails/plan/refine` (lib/agents/rails.service.ts:379)
- `/api/rails/plan/{X}` (lib/agents/rails.service.ts:379)
- `/api/rails/plans` (lib/agents/rails.service.ts:379)
- `/api/rails/receipts/{X}` (lib/agents/rails.service.ts:379)
- `/api/rails/runs/{X}/cancel` (lib/agents/rails.service.ts:379)
- `/api/runs/{X}` (lib/bots/orpc-contracts.ts:429)
- `/api/runs/{X}/cancel` (lib/bots/orpc-contracts.ts:436)
- `/api/runs/{X}/retry` (lib/bots/orpc-contracts.ts:443)
- `/api/spaces/{X}/pages` (services/docmost/DocmostAdapter.ts:49)
- `/api/status` (pages/StatusPage.tsx:56)
- `/api/tokens` (views/cloud-deploy/data/providers.ts:87)
- `/api/v1/a2ui/actions` (integration/a2ui-client.ts:148)
- `/api/v1/a2ui/capsules` (integration/a2ui-client.ts:202)
- `/api/v1/a2ui/capsules/{X}` (integration/a2ui-client.ts:209)
- `/api/v1/a2ui/capsules/{X}/launch` (integration/a2ui-client.ts:226)
- `/api/v1/a2ui/generate` (integration/a2ui-client.ts:253)
- `/api/v1/a2ui/sessions` (integration/a2ui-client.ts:97)
- `/api/v1/a2ui/sessions/{X}` (integration/a2ui-client.ts:110)
- `/api/v1/a2ui/sessions/{X}/data` (integration/a2ui-client.ts:127)
- `/api/v1/a2ui/sessions?chat_id={X}` (integration/a2ui-client.ts:117)
- `/api/v1/bb` (lib/agents/bb-sync.ts:63)
- `/api/v1/benchmarks/computer-use-leaderboard` (pages/BenchmarkLeaderboardPage.tsx:45)
- `/api/v1/beta/*` (lib/env.ts:165)
- `/api/v1/capsules` (integration/api-client.ts:863)
- `/api/v1/capsules/{X}` (integration/api-client.ts:859)
- `/api/v1/capsules/{X}/execute` (integration/api-client.ts:875)
- `/api/v1/capsules/{X}/verify` (integration/api-client.ts:879)
- `/api/v1/capsules{X}` (integration/api-client.ts:855)
- `/api/v1/cloud/wizard/deployments` (views/settings/CloudInstancesPanel.tsx:5)
- `/api/v1/cloud/wizard/deployments/{X}` (views/settings/CloudInstancesPanel.tsx:380)
- `/api/v1/cloud/wizard/deployments/{X}/advance` (views/settings/CloudInstancesPanel.tsx:372)
- `/api/v1/cloud/wizard/deployments/{X}/bootstrap` (views/settings/CloudInstancesPanel.tsx:468)
- `/api/v1/cloud/wizard/deployments/{X}/cancel` (views/settings/CloudInstancesPanel.tsx:505)
- `/api/v1/computers` (lib/computers-api.ts:4)
- `/api/v1/computers/{X}` (lib/computers-api.ts:99)
- `/api/v1/computers/{X}/delete` (lib/computers-api.ts:117)
- `/api/v1/computers/{X}/start` (lib/computers-api.ts:109)
- `/api/v1/computers/{X}/stop` (lib/computers-api.ts:113)
- `/api/v1/credits/balance` (lib/cloud-console-api.ts:160)
- `/api/v1/credits/transactions` (lib/cloud-console-api.ts:164)
- `/api/v1/desktop-capacity` (lib/desktop-cloud-api.ts:120)
- `/api/v1/desktop-sandboxes` (lib/desktop-cloud-api.ts:149)
- `/api/v1/desktop-usage/summary` (lib/computers-api.ts:121)
- `/api/v1/discovery/feed` (views/discovery/hooks/useDiscoveryFeed.ts:90)
- `/api/v1/drive/assets` (views/canvas/components/AllternitDriveSidebar.tsx:64)
- `/api/v1/drive/assets?sessionId={X}` (views/canvas/components/AllternitDriveSidebar.tsx:64)
- `/api/v1/fabric/resource-classes` (lib/cloud-console-api.ts:131)
- `/api/v1/fabric/resources` (lib/cloud-console-api.ts:142)
- `/api/v1/fabric/resources/{X}` (lib/cloud-console-api.ts:146)
- `/api/v1/fabric/resources/{X}/terminate` (lib/cloud-console-api.ts:151)
- `/api/v1/images/generate` (allternit-os/programs/PresentationProgram.tsx:109)
- `/api/v1/ivkge` (views/IVKGEPanel/IVKGEPanel.tsx:68)
- `/api/v1/marketplace` (lib/plugins/marketplace.ts:227)
- `/api/v1/monitor/agents` (views/MonitorView.tsx:124)
- `/api/v1/monitor/logs` (views/MonitorView.tsx:125)
- `/api/v1/monitor/system` (views/MonitorView.tsx:126)
- `/api/v1/nodes` (views/nodes/terminal/TerminalTabs.tsx:99)
- `/api/v1/nodes/{X}/terminal` (views/nodes/terminal/terminal.service.ts:304)
- `/api/v1/onboarding/provider` (components/settings/BrainsPanel.tsx:115)
- `/api/v1/openclaw/agents/discovery` (integration/api-client.ts:898)
- `/api/v1/operator/events/{X}` (integration/api-client.ts:1095)
- `/api/v1/operator/execute` (integration/api-client.ts:1088)
- `/api/v1/permissions/{X}/reply` (lib/agents/native-agent-api.ts:1170)
- `/api/v1/photon/send` (lib/messaging/allternit-bus.service.ts:107)
- `/api/v1/photon/stream` (lib/messaging/allternit-bus.service.ts:45)
- `/api/v1/plugins/marketplace/submit` (views/plugins/PluginManager/components/PublishModals.tsx:295)
- `/api/v1/policies` (lib/governance/policy.service.ts:68)
- `/api/v1/policies/violations/{X}` (lib/governance/policy.service.ts:147)
- `/api/v1/policies/violations/{X}/escalate` (lib/governance/policy.service.ts:171)
- `/api/v1/policies/violations/{X}/resolve` (lib/governance/policy.service.ts:158)
- `/api/v1/policies/{X}` (lib/governance/policy.service.ts:61)
- `/api/v1/policies/{X}/clone` (lib/governance/policy.service.ts:109)
- `/api/v1/policies/{X}/disable` (lib/governance/policy.service.ts:99)
- `/api/v1/policies/{X}/enable` (lib/governance/policy.service.ts:92)
- `/api/v1/promotion/proposals` (views/code/PromotionDashboardView.tsx:103)
- `/api/v1/promotion/proposals/{X}/decision` (views/code/PromotionDashboardView.tsx:155)
- `/api/v1/prompts/test` (components/agents/AllternitSystemPromptEditor.tsx:51)
- `/api/v1/provider/ollama/status` (integration/api-client.ts:1022)
- `/api/v1/purposes` (lib/governance/policy.service.ts:277)
- `/api/v1/purposes/bind` (lib/governance/policy.service.ts:326)
- `/api/v1/purposes/unbind` (lib/governance/policy.service.ts:336)
- `/api/v1/purposes/{X}` (lib/governance/policy.service.ts:264)
- `/api/v1/query` (capsules/browser/observabilityService.ts:488)
- `/api/v1/questions/{X}/reject` (lib/agents/native-agent-api.ts:1207)
- `/api/v1/questions/{X}/reply` (lib/agents/native-agent-api.ts:1193)
- `/api/v1/runs/{X}/recover` (lib/cowork/useCoworkRuns.ts:112)
- `/api/v1/runtime/budget` (hooks/useBudget.ts:199)
- `/api/v1/runtime/budget/quota` (hooks/useBudget.ts:254)
- `/api/v1/runtime/drivers` (hooks/useRuntimeSettings.ts:99)
- `/api/v1/runtime/prewarm/pool` (hooks/usePrewarm.ts:146)
- `/api/v1/runtime/prewarm/status` (hooks/usePrewarm.ts:119)
- `/api/v1/runtime/prewarm/warmup` (hooks/usePrewarm.ts:167)
- `/api/v1/runtime/replay/sessions` (hooks/useReplay.ts:40)
- `/api/v1/runtime/replay/sessions/{X}/execute` (hooks/useReplay.ts:56)
- `/api/v1/runtime/settings` (hooks/useRuntimeSettings.ts:97)
- `/api/v1/runtime/settings/reset` (hooks/useRuntimeSettings.ts:98)
- `/api/v1/security/compliance` (lib/governance/policy.service.ts:422)
- `/api/v1/security/compliance/assess` (lib/governance/policy.service.ts:429)
- `/api/v1/security/events/{X}` (lib/governance/policy.service.ts:398)
- `/api/v1/security/events/{X}/acknowledge` (lib/governance/policy.service.ts:405)
- `/api/v1/security/events/{X}/resolve` (lib/governance/policy.service.ts:415)
- `/api/v1/security/overview` (lib/governance/policy.service.ts:366)
- `/api/v1/sessions` (integration/api-client.ts:615)
- `/api/v1/sessions/archived` (views/ArchivedView.tsx:187)
- `/api/v1/sessions/{X}` (integration/api-client.ts:652)
- `/api/v1/sessions/{X}/chat` (integration/api-client.ts:664)
- `/api/v1/sessions/{X}/messages?limit={X}&offset={X}` (integration/api-client.ts:671)
- `/api/v1/sessions/{X}/permission` (lib/sdk.ts:75)
- `/api/v1/sessions/{X}/question/reject` (lib/sdk.ts:91)
- `/api/v1/sessions/{X}/question/reply` (lib/sdk.ts:85)
- `/api/v1/sessions/{X}/restore` (views/ArchivedView.tsx:217)
- `/api/v1/sessions{X}` (integration/api-client.ts:648)
- `/api/v1/swarm` (lib/swarm/swarm.api.ts:105)
- `/api/v1/terminal/sessions/{X}/status` (views/nodes/terminal/terminal.service.ts:269)
- `/api/v1/terminal/{X}` (views/nodes/terminal/terminal.service.ts:726)
- `/api/v1/terminal/{X}/files/download?path={X}` (views/nodes/terminal/terminal.service.ts:865)
- `/api/v1/terminal/{X}/files/list?path={X}` (views/nodes/terminal/terminal.service.ts:785)
- `/api/v1/terminal/{X}/files/mkdir?path={X}` (views/nodes/terminal/terminal.service.ts:920)
- `/api/v1/terminal/{X}/files/stat?path={X}` (views/nodes/terminal/terminal.service.ts:944)
- `/api/v1/terminal/{X}/files/upload?path={X}` (views/nodes/terminal/terminal.service.ts:844)
- `/api/v1/terminal/{X}/files?path={X}` (views/nodes/terminal/terminal.service.ts:896)
- `/api/v1/voice` (lib/agents/voice.service.ts:14)
- `/api/v1/workspace/exports` (views/cowork/ExportsView.tsx:38)
- `/api/v1/workspace/files` (views/cowork/FilesView.tsx:81)
- `/api/v1/workspace/tables` (views/cowork/TablesView.tsx:21)
- `/api/verification` (services/visualVerificationApi.ts:87)
- `/api/verification/{X}` (hooks/useVisualVerification.ts:80)
- `/api/verification/{X}/bypass` (hooks/useVisualVerification.ts:98)
- `/api/verification/{X}/start` (hooks/useVisualVerification.ts:88)
- `/api/verification/{X}/trend?days={X}` (hooks/useVisualVerification.ts:109)
- `/api/v1/cli-tools/check` (plugins/cli-tools.api.ts:214)
- `/api/v1/cli-tools/discover` (plugins/cli-tools.api.ts:238)
- `/api/v1/files/search` (lib/agents/files-api.ts:188)
- `/v1/global/event` (pages/SessionsPage.tsx:78) — gizzi-code native surface; bypasses both Rust backends
- `/v1/session/list` (pages/SessionsPage.tsx:56) — gizzi-code native surface
- `/v1/session/status` (pages/SessionsPage.tsx:57) — gizzi-code native surface
- `/v1/session/{X}/replay` (pages/SessionsPage.tsx:229) — gizzi-code native surface
- `/v1/session/{X}/support-bundle` (pages/SessionsPage.tsx:256) — gizzi-code native surface


---

## 3. P1 handler list (proposed control-plane handlers in cloud-api)

Selection rule: paths **owned only by :8013** and called by **live (flagged or unflagged) UI**. Grouped by namespace in the priority order the platform needs: **agent-sessions/chat → jobs → office → beta → rails**.

**Universal design** — every handler below is the same four-step axum handler in `cmd/allternit-cloud-api/src/routes/`:

1. **Auth:** Clerk session via `resolve_user_scoped(&state.db, &headers, "compute")` — the same resolver the existing relay uses (`routes/runtime_relay.rs:655`).
2. **Node resolution:** look up the user's default/online data-plane node in the node registry (§4) — e.g. a `runtime_devices` row owned by the user with `status='online'`, or an explicit `?node=` override.
3. **Relay:** reuse the existing outbound-WebSocket relay (`POST /api/v1/runtime-devices/:id/proxy`, `routes/runtime_relay.rs:253`): the cloud handler forwards `{method, path, headers, body}` to the node, which runs its local :8013. The relay allow-list already covers `/api` and `/rails` (`is_allowed_runtime_path`, runtime_relay.rs:839), and responses already stream back chunk-by-chunk (`Body::from_stream`, runtime_relay.rs:738). `runtime_warming` / `runtime_offline` 503 semantics come for free (`connect_or_wake_runtime`, runtime_relay.rs:683-701).
4. **Cache nothing, transform nothing** — v1 is a faithful proxy so the web client keeps working unchanged (flags can then default ON).

### 3.1 Namespace: agent-sessions + chat (P0 — the reason P1 exists)

All served today only by `agent_session_router` (`cmd/allternit-api/src/agent_session_routes.rs:118-136`), `canvas_routes.rs:61-72`, and the chat bridge (`v1_routes.rs:462` mounts `/api/agent-chat`; the SSE bridge is `agent_chat_bridge` in `v1_routes.rs`). The session handlers are **Gizzi-backed** (HTTP to the node's gizzi runtime, `gizzi_base()` = `terminal_server_url`, default `127.0.0.1:4096`, `v1_routes.rs:89-96`) — i.e. strictly per-node stateful. Canvases are the exception: SQLite table `agent_canvases` on the node (`canvas_routes.rs:93`).

| # | Proposed cloud-api route | Method / streaming | SSE? | Stateful? | :8013 handler & data notes |
|---|---|---|---|---|---|
| 1 | `/api/v1/agent-sessions` | GET / POST | no | **stateful** (node registry → relay) | `list_sessions`/`create_session` → gizzi session list/create (`agent_session_routes.rs:533`); `CreateSessionBody` accepts `agent_id`, `origin_surface`, `ephemeral`, `metadata`, `model` (agent_session_routes.rs:139-156) |
| 2 | `/api/v1/agent-sessions/{id}` | GET / PATCH / DELETE | no | stateful | `get_session`/`update_session`/`delete_session`; gizzi `GET/PATCH/DELETE /session/:id` |
| 3 | `/api/v1/agent-sessions/{id}/messages` | GET / POST | POST reply arrives via sync SSE, not response body | stateful | `list_messages`/`send_message`; the chatId↔gizzi mapping note at `v1_routes.rs:45-72` applies (sessions created via `/api/v1/agent-sessions` already exist in gizzi) |
| 4 | `/api/v1/agent-sessions/sync` | GET | **SSE (EventSource client)** | stateful | `sync_sessions` — SSE of permission/question events; client: `native-agent-api.ts:637` `createSyncSource()`, consumed in `components/session-composer/session-composer-state.ts:139` |
| 5 | `/api/v1/agent-sessions/{id}/abort` (+ `/revert`, `/unrevert`, `/compact`) | POST | no | stateful | lifecycle ops on the gizzi session (agent_session_routes.rs:131-134) |
| 6 | `/api/agent-chat` | POST | **SSE (fetch + manual `data:` parse)** | stateful | `agent_chat_bridge` (v1_routes.rs:462); bridges to gizzi chat with in-memory `GIZZI_CHAT_SESSIONS` map (v1_routes.rs:57); reads `user_agent_preferences` + `agents` tables for model defaults (v1_routes.rs:667,680) |
| 7 | `/api/v1/agent-sessions/{id}/canvases` | GET / POST | no | stateful (SQLite `agent_canvases`) | canvas_routes.rs:63-65 |
| 8 | `/api/v1/canvases` + `/api/v1/canvases/{id}` | GET / PATCH / DELETE | no | stateful (SQLite `agent_canvases`) | canvas_routes.rs:61-72; `list_user_canvases` = newest 200 across sessions for the authed user (canvas_routes.rs:93) |

### 3.2 Namespace: jobs

| # | Proposed cloud-api route | Method / streaming | SSE? | Stateful? | Notes |
|---|---|---|---|---|---|
| 9 | `POST /api/v1/agent-sessions` (job executions) | POST | no | stateful | `executeScheduledJob` creates a session per run (`lib/agents/scheduled-jobs.service.ts:544-570`) — same handler as #1; schedules are client-side today, so P1 only needs the session-creation path |
| 10 | `/api/v1/automation/goals*`, `/automation/routines*`, `/automation/loops*`, `/automation/local-schedules` | GET/POST/PATCH/DELETE | no (`/routines/:id/run` returns JSON) | stateful | 8013 `automation_routes.rs:1942-1968` (SQLite-backed automation domain); called by `services/automation-api.ts`. Needed for scheduled-job parity server-side |
| 11 | `/api/agent-control` | POST | no | stateful | **Orphan today** — client wrapper at `lib/agents/scheduled-jobs.service.ts:87` with a "verified REST fallback". Decision needed: implement the thin control endpoint on :8013 and proxy it, or migrate the client to `/api/v1/agent-sessions`. Recommend the latter (kills a one-off namespace) |

### 3.3 Namespace: office

| # | Proposed cloud-api route | Method / streaming | SSE? | Stateful? | Notes |
|---|---|---|---|---|---|
| 12 | `/api/v1/office/bindings` (+ `/{binding_id}`) | GET | no | **stateful, node-affine** | `office_routes.rs:160-161`. Bindings live **in memory** in the :8013 process (`AppState.bindings: Vec<OfficeBinding>`, office_routes.rs:26, TTL-reaped at :207) — the handler must resolve to the node actually hosting the office session; the client's fail-closed "binding absent" semantic (env.ts:154-158) makes a wrong node indistinguishable from "no binding" |
| 13 | `/api/office/markdown`, `/api/office/markdown-url` | POST | no | stateful | `office_engine_router` proxies to the node's office engine (office_engine_routes.rs:29-30); used by `views/office/MarkdownPreviewView.tsx:47,76` |

### 3.4 Namespace: beta

| # | Proposed cloud-api route | Method / streaming | SSE? | Stateful? | Notes |
|---|---|---|---|---|---|
| 14 | `/api/v1/beta/research` (+ `/{id}`) | GET/POST/PATCH/DELETE | no | stateful (SQLite `research_tasks`) | `research_task_routes.rs:29-30`; `useResearchThread.ts:61,138` |
| 15 | `/api/v1/beta/sessions` CRUD | GET/POST | no | stateful (SQLite `beta_sessions`, `beta_session_events`, `session_files`, `beta_session_resources`, `beta_session_tool_context`) | `beta_session_routes.rs:42-71` |
| 16 | `/api/v1/beta/sessions/{id}/events/list` | GET | no (polling JSON) | stateful | beta_session_routes.rs:53; `AllternitPlaygroundView.tsx:57` |
| 17 | `/api/v1/beta/sessions/{id}/memory/search` | GET | no | stateful | beta_session_routes.rs:54 |
| 18 | `/api/v1/beta/sessions/{id}/run` | POST | **no — returns JSON, not SSE** | stateful | beta_session_routes.rs:57-61; the playground's `runPrompt` does `res.json()` (AllternitPlaygroundView.tsx:62-70) |
| 19 | `/api/v1/beta/sessions/{id}/events/ws` | GET | **WebSocket** | stateful | beta_session_routes.rs:55 — needs the socket-ticket WS relay pattern (`runtime_relay.rs:256-259`), not the request relay |

### 3.5 Namespace: rails (the `/api/rails/*` subset 8013 actually serves)

The :8013 rails router (`rails/mod.rs:197-277`) is a **different, smaller surface** than the standalone `allternit-agent-system-rails` service on :3011 (`rails/src/service.rs:2819-2901`). The web client's `rails.service.ts` speaks the :3011 shape through `/api/rails`, so only the subset below is proxyable to :8013 today; the rest are orphans needing either a :8013 shim or a client retarget (see §2.3 and §6).

| # | Proposed cloud-api route | Method | Notes |
|---|---|---|---|
| 20 | `/api/rails/wihs` (+ `/pickup`, `/{id}/context`, `/{id}/sign`, `/{id}/close`) | POST/GET | rails/mod.rs:235-239 — WIH lifecycle; `dak.store.ts`, `unified.store.ts` |
| 21 | `/api/rails/leases` (POST request, GET `/{id}`) | POST/GET | rails/mod.rs:264-265; list/renew/delete are orphans |
| 22 | `/api/rails/receipts` (+ `/write`) | POST | rails/mod.rs:216-217; `CodeCanvasTileExecutor.tsx:119` tags receipts with `node_id` |
| 23 | `/api/rails/ledger/tail` | POST | rails/mod.rs:215 |
| 24 | `/api/rails/mail/threads` (GET+POST), `/mail/thread/{id}`, `/mail/inbox/{agent}`, `/mail/ack`, `/mail/decide`, `/mail/share` | mixed | rails/mod.rs:220-228; mail monitor, comrails store, Agent Activity panel |
| 25 | `/api/rails/vault/status`, `/api/rails/vault/archive` | GET/POST | rails/mod.rs:275-276 |

**Deliberately deferred from P1** (8013-owned but not blocking the flagged surfaces): `agents` (35 paths), the `bots` store surface, `cowork`, `memory`, `swarms`, `workflows`, `skills`, `board*`, `terminal`, `h5i`, `local-brain/local-engine/local-studio`, `fabric`, desktop pools, and the rest of the 8013-only set — the same proxy recipe applies, but they have no env flag and no current public-deployment consumer pressure.

---

## 4. Node registry schema proposal (cloud-api Postgres)

**Build on what exists — do not invent a parallel concept.** Three tables plus one Headscale integration already cover ~90% of the registry:

| Existing piece | File | What it already gives us |
|---|---|---|
| `runtime_devices` | `cmd/allternit-cloud-api/migrations/011_runtime_pairing.sql` (+013/021/022/023) | user-owned node identity: `user_id`, `runtime_type CHECK ('desktop','vps','ios')`, **Ed25519 `public_key` + fingerprint**, revocable device credential (`credential_hash`, rotation grace), `capabilities`, `status ('online','offline','revoked')`, `last_seen_at`, heartbeat endpoint (`runtime_pairing.rs:198-201`) |
| `runtime_pairings` | same migration | device-code pairing flow, Clerk-approved (`runtime_pairing.rs:176-207`) |
| `gizzi_instances` | `migrations/018_gizzi_instances.sql` | user-registered node **endpoints** (`url`) — exactly the "local node behind an ephemeral URL" case, but credential-less and parallel |
| `hosted_runtime_nodes` | `migrations/025_hosted_runtime_nodes.sql` | **capacity metadata** (`docker_host`, `tailnet_ip`, `total_memory_mb`, `status`) for provisioned nodes |
| mesh enrollment | `routes/mesh.rs:1-47` | Headscale preauth keys; one Headscale user per Clerk user; `autogroup:self` isolation — the natural **addressing/routing** layer (`tailnet_ip`) |

### 4.1 Recommended shape: extend `runtime_devices`, retire the parallel tables

One registry row per user node, `kind` distinguishing how the node is reached:

```sql
-- 032_data_plane_nodes.sql
ALTER TABLE runtime_devices
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'paired'
        CHECK (kind IN ('local', 'paired', 'provisioned')),
    -- 'local'       : user's own machine (desktop app / gizzi serve --tunnel)
    -- 'paired'      : BYO VPS or long-lived box paired via device code
    -- 'provisioned' : cloud-api-hosted runtime container (hosted_runtime_instances)
    ADD COLUMN endpoint_url TEXT,               -- absorbs gizzi_instances.url (https/tunnel)
    ADD COLUMN tailnet_ip  TEXT,                -- from mesh enrollment (Headscale)
    ADD COLUMN relay_connected_at TIMESTAMPTZ,  -- last outbound WS relay attach
    ADD COLUMN capacity JSONB NOT NULL DEFAULT '{}';  -- {cores, memory_mb, gpu, disk_gb}
    -- capacity mirrors hosted_runtime_nodes.* for provisioned nodes;
    -- self-reported by the node daemon at pairing/heartbeat for local/paired.

CREATE INDEX IF NOT EXISTS idx_runtime_devices_user_online
    ON runtime_devices(user_id) WHERE status = 'online';

-- User's preferred node for control-plane routing (per surface optional).
CREATE TABLE IF NOT EXISTS user_node_preferences (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    surface    TEXT NOT NULL DEFAULT '*',       -- '*' = default; 'office', 'runner', ...
    node_id    TEXT NOT NULL REFERENCES runtime_devices(id) ON DELETE CASCADE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, surface)
);

-- Backfill + retire (kept for one release, then dropped):
INSERT INTO runtime_devices (id, user_id, name, kind, endpoint_url, status, capabilities,
                             public_key, public_key_fingerprint, credential_hash,
                             credential_expires_at, created_at, updated_at)
    SELECT 'gi_'||id, user_id, name, 'local', url, 'online', '[]',
           '', '', '', CURRENT_TIMESTAMP, created_at, updated_at
    FROM gizzi_instances;
-- hosted_runtime_nodes rows for provisioned instances become runtime_devices
-- rows kind='provisioned' with capacity backfilled; node_id on
-- hosted_runtime_instances already points at them.
```

Key mappings to existing concepts:

- **JWT verify key:** the registry's `public_key` (Ed25519, already fingerprinted at pairing — `runtime_pairing.rs:220-221`). Node-issued JWTs verify against this key; the existing device-credential flow (`allternit_runtime_…` tokens, `DEVICE_TOKEN_PREFIX` at `runtime_pairing.rs:38`) is the bootstrap that registers the key — no new auth concept.
- **Reachability:** prefer the **existing relay** (`runtime_relay.rs`) — nodes already dial outbound, so no inbound address is needed; `endpoint_url` (from `gizzi_instances`) is the fallback for direct-connect nodes; `tailnet_ip` (from `mesh.rs` enrollment) is the stable identity/address if the relay is down. Ordering relay → tailnet → endpoint_url matches the wake-on-demand semantics already implemented (`connect_or_wake_runtime`, `runtime_relay.rs:12-16`).
- **Liveness:** reuse `POST /api/v1/runtime-devices/:id/heartbeat` (`runtime_pairing.rs:198-205`) — the relay connection itself should also stamp `relay_connected_at` on attach/detach.
- **What this replaces:** nothing destructive in P1. `gizzi_instances` becomes a view over `kind='local'` rows; `hosted_runtime_nodes` remains the capacity source for provisioned nodes until backfill.

---

## 5. SSE / streaming inventory (8013-owned set)

| Endpoint | Owner | Client transport | Citation | Proxy-through-cloud-api notes |
|---|---|---|---|---|
| `GET /api/v1/agent-sessions/sync` | 8013 | **EventSource** (browser retry built-in) | `lib/agents/native-agent-api.ts:637`; consumed `components/session-composer/session-composer-state.ts:139-149` | Browser EventSource **cannot set Authorization** (called out at session-composer-state.ts:149). Two options: (a) the Clerk session cookie is same-site with cloud-api → plain EventSource works; (b) switch the client to `fetch` + `getReader()` like `streamChat` already does. The relay already streams bodies chunk-wise (`Body::from_stream`, runtime_relay.rs:738) — content-type `text/event-stream` passes through `filtered_response_headers` |
| `POST /api/agent-chat` | 8013 | **fetch POST + manual `data:` SSE parse** | `lib/agents/native-agent-api.ts:696-740` | Cleanest case: request/response relay verbatim; client parsing unchanged |
| `GET /api/v1/beta/sessions/:id/events/ws` | 8013 | **WebSocket** | `beta_session_routes.rs:55` | Needs the WS relay, not the request relay — reuse the socket-ticket pattern (`/api/v1/runtime-devices/:id/socket-ticket` + `/socket`, `runtime_relay.rs:256-259`) already used for terminals |
| `GET /api/v1/board-stream/:id` | 8013 | **EventSource** via shared `global-sse-manager` (one connection per URL, multicast listeners) | `stores/board.store.ts:208`; `lib/sse/global-sse-manager.ts:40` | Same auth constraint as agent-sessions/sync; the multicast manager means one 401 kills many widgets — fail closed cleanly |
| `GET /api/aci/stream/:id` | 8013 | **EventSource** | `capsules/browser/browserAgent.store.ts:546` | Same; ACI also has POST `/api/aci/run`, `/stop/:id`, `/approve/:id` (non-streaming) |
| `POST /api/v1/voice/tts/stream`, `/stt/stream` | 8013 | fetch, binary/audio stream (proxied to the node's voice service) | `v1_routes.rs:119-120`; client `lib/agents/voice.service.ts` | Relay-compatible; bump the per-request timeout like the video-generate special case (runtime_relay.rs:693) |
| `GET /api/v1/runs/:id/events/stream` | **both** | **EventSource** | `views/cowork/useCoworkRunEvents.ts:25` | Ownership must be settled first (cloud `runs.rs:106` vs 8013 `rails/routes_cowork.rs:933`) — recommend cloud owns it and 8013's is deprecated, or P1 proxies to the node |
| `GET /api/v1/tasks/stream` | cloud only | **EventSource** | `views/cowork/hooks/useTaskRealtime.ts:15` (reconnect comment :34) | Already public; listed because the client treats tasks/runs as one realtime family |
| `POST /api/chat` (runner chat) | **orphan** | fetch POST + SSE parse | `lib/ai/rust-stream-adapter.ts:1911-1945` | Flagged RUNNER_CHAT; the endpoint exists on neither backend (env.ts:131-136). Either add a :8013 `/api/chat` handler (an alias of `/api/agent-chat` with the runner's wire format) and proxy it, or repoint the runner to `/api/agent-chat` |
| `POST /api/v1/operator/execute` + `GET /api/v1/operator/events/:id` | **orphan** | fetch POST + SSE | `integration/api-client.ts:1088,1095`; gated `runner/runner.store.ts:348,505,611` | No backend exists (env.ts:121-124). Greenfield: define on :8013 (operator executor over gizzi), proxy like agent-chat |
| `GET /api/h5i/files-touched-stream` | **orphan** | fetch stream | `components/h5i/useFilesTouched.ts:28` | Not on either backend |
| `/stream/ws/ledger`, `/stream/ws/dag/:id/events` | 8013 | WebSocket | `stream/mod.rs:32-37` | No current web-client caller; when needed, same socket-ticket relay |
| `/ws/bots` | 8013 | WebSocket | `main.rs:716` (bot_desktop_stream_router) | Desktop-bot streaming; defer |

**Axum SSE proxying considerations for P1:**

1. **Never buffer.** The relay response path is already `Body::from_stream(ReceiverStream)` (runtime_relay.rs:738) — keep it; do not collect SSE into `String`/`Json` in the cloud handler.
2. **Idle timeouts.** The relay's `RELAY_TIMEOUT` is 90 s (runtime_relay.rs:44) measured to the response *head* — fine for SSE since headers flush immediately — but if any hop adds an idle-read timeout it kills quiet SSE channels. Node-side axum handlers should emit `KeepAlive` (axum `sse::KeepAlive`) so the connection never looks dead; alternatively special-case SSE paths with a longer/no idle timeout.
3. **Auth on EventSource.** Two of the four SSE clients are raw `EventSource` (no header injection). Decide once: Clerk session cookie on the platform domain (works with zero client changes) or migrate those two clients to fetch-streaming. The codebase already contains both patterns.
4. **One connection per URL.** `global-sse-manager.ts:4-5` dedupes EventSources per URL — proxying must preserve URL-addressable semantics (no per-widget ticketed URLs) or the dedup breaks and the connection count explodes.
5. **Reconnect = full re-listen.** EventSource auto-reconnects on drop; node handlers must treat a fresh `GET` as "replay from cursor or latest" (e.g. `sync_sessions` already sends an initial snapshot frame — keep that contract).

---

## 6. Surprises worth surfacing to the platform team

1. **`/api/v1/tasks` and `/api/v1/runs` are claimed by BOTH backends with different shapes.** cloud-api `tasks.rs`/`runs.rs` (Postgres, cowork orchestration) vs 8013 `task_routes.rs` and `rails/routes_cowork.rs` (node-local). Same paths, different data models — the deployed web client currently gets whichever backend fronts it. `/api/v1/tasks/stream` exists only on cloud; `/api/v1/runs/:id/handoffs` only on 8013; `/api/v1/runs/:id/recover` on neither.
2. **The web Rails client speaks the wrong rails' dialect.** `rails.service.ts` targets the standalone `allternit-agent-system-rails` (:3011, `/v1/*`) route shapes via `/api/rails`, but the :8013 `/api/rails` router implements a partially overlapping, differently-shaped surface. ~25 called paths 404 on the gateway today (all behind `isRailsApiEnabled`, so they fail closed — but they will 404 the moment the flag is flipped without a shim).
3. **`/api/v1/sessions*` (the non-`agent-` session family: CRUD, `/chat`, `/messages`, `/permission`, `/question/*`) is served by no Rust backend at all** — called from `integration/api-client.ts:615-671` and `lib/sdk.ts:75-100`, presumably legacy from a previous API generation.
4. **Office bindings are in-memory per process** (`office_routes.rs:26`) — any multi-node story for office needs node-affinity routing, not just a proxy.
5. **`/api/chat` vs `/api/agent-chat`:** the runner's chat path (`/api/chat`) is close to what `/api/agent-chat` does, but the wire protocols differ (env.ts:131-136) — a :8013 alias handler is ~free once P1 proxies it.
6. **The relay P1 needs already exists and is allow-listed for `/api` + `/rails`.** The P1 control plane is mostly *route registration + node resolution*, not new networking.
7. **Several 8013 routers are mounted without the `/api/v1` prefix the web client uses.** `computer_routes.rs` serves `/computers`, `fabric_resources_routes.rs` serves `/fabric/resources`, `terminal_routes` is mounted at `/terminal` — while the web client calls `/api/v1/computers*`, `/api/v1/fabric/resources*`, `/api/v1/terminal/*`. Those client calls are orphans against the current route tables even though the handlers exist; either add prefix aliases on :8013 or fix the client paths when these namespaces are proxied.
