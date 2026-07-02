# Agent Creation & Spin-Up Checklist

Every new agent or agent type in the Allternit platform must explicitly touch every item below. No stubs, no mock data, no commented-out code, no fallback logic.

## 1. Canonical schema & identity

- [ ] Assign a stable `id` and `version`.
- [ ] Set `name`, `description`, `agent_type` (`orchestrator` | `sub-agent` | `worker` | `specialist` | `reviewer`).
- [ ] If sub-agent, set `parent_agent_id` pointing to a real orchestrator.
- [ ] Set `category` and `tags` for discovery.
- [ ] Set `model`, `provider`, `temperature`, `max_iterations`.
- [ ] Provide `system_prompt` and `capabilities`.

## 2. Registry contract

- [ ] `AgentDefinition` in `services/orchestration/control-plane/unified-registry/registry/src/agents/agents.rs` matches the canonical shape.
- [ ] `HarnessConfig` uses the canonical SDK shape (`mode` + `byok`/`cloud`/`local`/`subprocess`), not flat `api_key`/`ollama_url` fields.
- [ ] `enabled_modes` lists every surface this agent is allowed to run on: `chat`, `cowork`, `code`, `browser`, `design`.
- [ ] `trust_tier`, `write_scope`, and `data_classification` are explicit.
- [ ] The registry stores/returns `definition_json` containing the full canonical object.

## 3. Harness configuration

- [ ] UI forms (`CreateAgentForm`, `EditAgentForm`, `AgentDetailView`) use the canonical `HarnessConfig` shape.
- [ ] `byok` supports per-provider `apiKey` + optional `baseURL` (`anthropic`, `openai`, `google`).
- [ ] `cloud` requires `baseURL` + `accessToken` with optional `refreshToken`.
- [ ] `local` only takes `baseURL`.
- [ ] `subprocess` takes `command`, optional `cwd`, and `env` key/value map.
- [ ] Per-agent harness is loaded by the runtime loop (`cmd/gizzi-code/src/runtime/loop/*`).
- [ ] `TERMINAL_SERVER_URL` / gizzi cron service can read the agent harness at execution time.

## 4. Workspace artifacts

- [ ] Agent creation triggers workspace initialization (`/api/v1/agents/:id/workspace/initialize`).
- [ ] Generated documents include identity, role card, hard bans, escalation, voice rules, and workspace layers.
- [ ] The 5-layer workspace manifest (`cognitive`, `identity`, `governance`, `skills`, `business`) is persisted.

## 5. Character layer

- [ ] `characterLayer` is populated with `setup`, `temperament`, `specialtySkills`, `personalityTraits`, `backstory`.
- [ ] `roleCard` includes `domain`, `definitionOfDone`, `hardBans`, `escalation`, `metrics`.
- [ ] `voice` config includes `style`, `rules`, `microBans`, and `tone`.
- [ ] Hard-ban categories map to `ENHANCED_HARD_BAN_CATEGORIES`.

## 6. Allowed surfaces & skills

- [ ] `allowedSurfaces` contains only surfaces the agent is certified for.
- [ ] `allowedSkills` and `allowedTools` are explicit and validated against available registry entries.
- [ ] The nav/rail/routes expose the agent on each allowed surface.

## 7. Mode surface wiring

For every surface the agent supports, the following must be present:

| Surface | Required wiring |
|---------|-----------------|
| `chat` | `ChatView`, `ChatComposer`, `useSurfaceAgentSelection('chat')`, agent selector, harness-aware model picker, permission/question bars, attachment parity, `useModeCanvasBridge`. |
| `cowork` | `CoworkRoot`, `CoworkSessionStore`, DAG/WIH lifecycle, runs/timeline, harness config panel, approval/question modals, `useSurfaceAgentSelection('cowork')`. |
| `code` | `CodeCanvas`, `CodeSessionStore`, agent selector, attachments, permission/question bars, `useSurfaceAgentSelection('code')`, `useModeCanvasBridge`. |
| `browser` | `OperatorBrowserView` (or browser surface), agent selector, harness config, task/run integration. |
| `design` | `DesignModeView`, `DesignSessionStore`, agent selector, harness config, `useModeCanvasBridge`. |

## 8. Routines, loops, and goals

- [ ] Database migration exists for `goals`, `routines`, `loops`, `routine_runs`.
- [ ] Backend REST routes expose CRUD + run under `/api/v1/automation/*`.
- [ ] gizzi-code cron service can receive schedule/run calls (`TERMINAL_SERVER_URL`).
- [ ] Platform UI lists goals, routines, loops, and run history (`surfaces/ai.allternit.com/src/views/automation/*`).
- [ ] Nav/rail/routes register the automation surface.

## 9. Tests & verification

- [ ] `cargo check -p allternit-api` passes with zero errors in changed code.
- [ ] `cargo check -p allternit-registry` passes.
- [ ] `cargo test -p allternit-api --lib` passes.
- [ ] `pnpm typecheck:fast` in `surfaces/ai.allternit.com` passes.
- [ ] `bun run typecheck` in `cmd/gizzi-code` passes for the files touched (increase `--max-old-space-size` if OOM).
- [ ] No new warnings from unused imports or dead code introduced by the change.

## 10. Documentation

- [ ] This checklist is updated if any new required field or surface is introduced.
- [ ] `AGENTS.md` references this checklist for anyone spinning up a new agent.
- [ ] Inline code comments describe new behavior, not old behavior.
