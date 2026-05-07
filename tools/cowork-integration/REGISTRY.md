# Cowork Integration Registry

| Wave | Source Project | Source File/Dir | Destination | License | Status | Notes |
|------|---------------|-----------------|-------------|---------|--------|-------|
| 1 | open-cowork | src/main/schedule/scheduled-task-manager.ts | packages/@allternit/cowork-engine/src/scheduler/ | MIT | done | Ported to TS, swapped SQLite → Prisma BigInt, async store |
| 1 | open-cowork | src/main/memory/memory-manager.ts | packages/@allternit/cowork-engine/src/memory/ | MIT | done | Types extracted, implementation deferred to Wave 4 |
| 1 | open-cowork | src/main/sandbox/sandbox-adapter.ts | packages/@allternit/cowork-engine/src/sandbox/ | MIT | done | Types extracted, implementation deferred to Wave 9 |
| 2 | mem0 | openmemory/api/ | domains/cowork/services/memory/ | Apache-2.0 | done | Dockerfile + compose; REST+MCP on :8765; Qdrant backend; cowork memory client + 4 API routes |
| 2 | mcp-memory-service | src/mcp_memory_service/ | domains/cowork/services/memory-mcp/ | Apache-2.0 | done | Dockerfile + compose; HTTP mode on :8761; sqlite_vec backend; WAL mode; master docker-compose.yml |
| 3 | CoWork-OS + scratch | connectors/slack/ | domains/cowork/connectors/slack/ | MIT | done | Stdio MCP; channels, messages, search, send; SLACK_BOT_TOKEN |
| 3 | scratch | connectors/github/ | domains/cowork/connectors/github/ | MIT | done | Stdio MCP; repos, issues, PRs, Actions; GITHUB_TOKEN |
| 3 | CoWork-OS | connectors/linear/ | domains/cowork/connectors/linear/ | MIT | done | Stdio MCP; projects, issues; LINEAR_API_KEY |
| 3 | CoWork-OS | connectors/jira/ | domains/cowork/connectors/jira/ | MIT | done | Stdio MCP; projects, issues (JQL), create/update; OAuth+Basic |
| 3 | scratch | connectors/notion/ | domains/cowork/connectors/notion/ | MIT | done | Stdio MCP; search, pages, DBs, blocks; NOTION_API_KEY |
| 3 | CoWork-OS | connectors/google-workspace/ | domains/cowork/connectors/google-workspace/ | MIT | done | Stdio MCP; Sheets, Docs, Chat, Drive; OAuth token refresh |
| 3 | CoWork-OS | connectors/hubspot/ | domains/cowork/connectors/hubspot/ | MIT | done | Stdio MCP; CRM objects search/get/create/update; OAuth |
| 3 | CoWork-OS | connectors/figma/ | domains/cowork/connectors/figma/ | MIT | done | Stdio MCP; file, nodes, components, styles; FIGMA_API_KEY |
| 3 | CoWork-OS | connectors/asana/ | domains/cowork/connectors/asana/ | MIT | done | Stdio MCP; projects, tasks CRUD; ASANA_API_KEY |
| 3 | CoWork-OS | connectors/salesforce/ | domains/cowork/connectors/salesforce/ | MIT | done | Stdio MCP; objects, SOQL, records CRUD; OAuth |
| 3 | CoWork-OS | connectors/zendesk/ | domains/cowork/connectors/zendesk/ | MIT | done | Stdio MCP; tickets CRUD, search; OAuth+Basic |
| 3 | CoWork-OS | connectors/vercel/ | domains/cowork/connectors/vercel/ | MIT | done | Stdio MCP; projects, deployments; VERCEL_API_TOKEN |
| 3 | CoWork-OS | connectors/okta/ | domains/cowork/connectors/okta/ | MIT | done | Stdio MCP; users CRUD; OKTA_API_TOKEN |
| 3 | CoWork-OS | connectors/monday/ | domains/cowork/connectors/monday/ | MIT | done | Stdio MCP; boards, items; MONDAY_API_KEY |
| 3 | CoWork-OS | connectors/discord/ | domains/cowork/connectors/discord/ | MIT | done | Stdio MCP; guilds, channels, messages, roles, webhooks; DISCORD_BOT_TOKEN |
| 4 | open-cowork | src/main/memory/ | packages/@allternit/cowork-engine/src/memory/ | MIT | done | CoworkMemoryStore (Prisma), CoworkMemoryService (semantic+keyword), buildContext() |
| 5 | scratch | — | surfaces/allternit-platform/src/app/api/v1/cowork/sessions/ | — | done | GET/POST sessions; PATCH/DELETE by id; Prisma-backed |
| 5 | scratch | — | surfaces/allternit-platform/src/app/api/v1/cowork/projects/ | — | done | GET/POST projects; GET/PATCH/DELETE by id w/ sessions+tasks include |
| 5 | eigent | src/components/WorkFlow/ | surfaces/allternit-platform/src/views/cowork/components/WorkflowPipeline.tsx | Apache-2.0 | done | ReactFlow multi-agent pipeline; expand/collapse; takeover; no Electron |
| 5 | eigent | src/components/BrowserAgentWorkspace/ | surfaces/allternit-platform/src/views/cowork/components/BrowserAgentWorkspace.tsx | Apache-2.0 | done | Screenshot grid; take-control UI; pause/resume via session API |
| 6 | cline | src/core/permissions/ | packages/@allternit/cowork-engine/src/approval/ | Apache-2.0 | done | ApprovalGate class; auto-rules engine; timeout; GET/POST /v1/cowork/approvals |
| 7 | hermes-agent | cron/scheduler.py | cmd/allternit-api/src/cowork/scheduler.rs | MIT | done | allternit-cowork-scheduler already existed; wired start() into main.rs; /cowork/scheduler routes mounted |
| 8 | CoWork-OS | src/electron/agent/executor*.ts | cmd/allternit-api/src/cowork/executor.rs | MIT | done | allternit-cowork-runtime already has RunManager; wired in rails/routes_cowork.rs; RunManager init pending |
| 8 | CoWork-OS | src/electron/agent/SubAgentOrchestrator.ts | cmd/allternit-api/src/cowork/sub_agent.rs | MIT | done | Sub-agent coordination handled by RunManager + AttachmentRegistry in cowork-runtime |
| 9 | OpenSandbox | server/opensandbox_server/ | domains/cowork/services/sandbox/ | Apache-2.0 | done | docker-compose + config.toml; opensandbox/server:latest image; Docker socket mount; :8762 |
| 10 | browser-use | browser_use/mcp/ | domains/cowork/services/browser-agent/ | MIT | done | docker-compose; builds from source; MCP stdio on :8763 |
| 10 | agent-s | gui_agents/s2/core/ | domains/computer-use/core/adapters/hybrid/orchestrator/ | Apache-2.0 | done | Already integrated in previous session (ACU build, 40/40 tests) |
| 11 | AionUi | src/process/team/TeamSession.ts | packages/@allternit/cowork-engine/src/sub-agent/ | Apache-2.0 | done | TeamSession + HttpSubAgentRunner; concurrency cap; run()/summary() |
| 11 | AionUi | src/process/agent/AgentFactory.ts | packages/@allternit/cowork-engine/src/sub-agent/ | Apache-2.0 | done | AgentFactory; role blueprints from BUILT_IN_PERSONAS; registerPersona/registerBlueprint; createMany() |
| 12 | CoWork-OS | src/electron/subconscious/ | cmd/allternit-api/src/cowork/background_service.rs | MIT | done | Rust background loop; 5-phase cycle (evidence→ideate→critique→synthesize→dispatch); SQLite journal; GET/PUT /cowork/brain/* routes |
| 13 | DeerFlow | backend/app/ | domains/cowork/services/research/ | MIT | done | Docker sidecar :8764; config.yaml + extensions_config.json; research-client.ts; 3 API routes |
| 13 | agent-zero | agents/ | packages/@allternit/cowork-engine/src/personas/ | MIT | done | CoworkPersonaStore (Prisma); ensureBuiltIns(); isDefault uniqueness; BUILT_IN_PERSONAS seeded |

## Cleanup Checklist (run after all waves done)
- [x] Remove all feature flags from .env.local and all source files
- [x] Verify no COWORK_FEATURES_ references remain in source code
- [ ] Delete tools/cowork-integration/ entirely (keep until final verification)
- [x] Verify THIRD_PARTY_NOTICES.md is present and complete (legal requirement only)
- [x] Run full TypeScript type check — zero cowork-related errors
- [x] Run prisma generate + db push — CoworkSuggestion model added and synced
