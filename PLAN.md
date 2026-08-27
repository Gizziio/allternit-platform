# Allternit Runtime Unification Plan (Multica-style)

## Goal

Turn gizzi-code into the runtime authority for Allternit: it discovers, registers, and executes every agent CLI the user has installed, whether gizzi-code is running standalone or behind the self-hosted Allternit platform API. Take Multica's full provider list as the priority target set.

## Architecture Decision

**gizzi-code owns the runtime.** The platform API is a stateless proxy, not a second implementation.

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  ai.allternit   │────▶│  Allternit platform  │────▶│  gizzi-code runtime │
│  (surface UI)   │◀────│  API (user-hosted)   │◀────│  (user's machine)   │
└─────────────────┘     └──────────────────────┘     └──────────┬──────────┘
                                                                 │
                              ┌──────────────────────────────────┘
                              │ local / websocket / uds
                              ▼
                     ┌─────────────────┐
                     │  agent CLIs     │
                     │ claude, codex,  │
                     │ cursor, kimi, … │
                     └─────────────────┘
```

- **Local mode:** gizzi-code resolves the provider to a registered local runtime and executes through `LocalCliDriver`.
- **Platform mode:** the SDK calls the platform API, which forwards the task to the gizzi-code runtime over a WebSocket/UDS connection.
- **Remote runtimes:** a lightweight gizzi runtime daemon can run on another machine and connect inbound (WebSocket) to the platform, or outbound to a cloud instance.

This is the same shape as Multica: a local daemon next to the code spawns the agent CLIs, while the workspace UI talks to a backend that routes tasks to that daemon.

## What is Already Implemented

### Phase 1 — Persisted runtime registry

- Schema: `cmd/gizzi-code/src/runtime/runtime.sql.ts`
  - `runtime` table (id, host, transport, status, heartbeat, metadata)
  - `runtime_cli` table (CLI name, path, version, icon, provider_id)
  - `runtime_execution_log` table (task lifecycle + events)
- Migration: `cmd/gizzi-code/migration/20260818000000_runtime_registry/migration.sql`
- Service: `cmd/gizzi-code/src/runtime/runtime-service.ts`
  - CRUD, heartbeat, offline/busy marking, auto-discovery fallback.
- Heartbeat: `cmd/gizzi-code/src/runtime/runtime-heartbeat.ts`
  - Re-probes local CLIs and marks runtimes offline when they disappear.
- CLI commands: `cmd/gizzi-code/src/cli/commands/runtime/{register,list,status}.ts`
- Dashboard screen: `cmd/gizzi-code/src/screens/RuntimeDashboard.tsx`

### Phase 2 — Runtime driver abstraction

- Interface: `cmd/gizzi-code/src/runtime/runtime-driver.ts`
  - `assign`, `stream`, `abort`, `inspect` + `AgentEvent` types.
- Local driver: `cmd/gizzi-code/src/runtime/drivers/local-cli-driver.ts`
  - Warm-process mode for stream-json CLIs (Claude Code protocol).
  - One-shot mode for `claude`, `kimi`, `codex`, `agy`, `qwen`.
  - Per-process request queue, process age limit, execution logging.
- Factory / resolver: `cmd/gizzi-code/src/runtime/runtime-driver-factory.ts`
  - Resolves a provider id → registered runtime → driver.
  - Auto-discovers and persists a local runtime when none is registered.
- Thin AI SDK wrapper: `cmd/gizzi-code/src/runtime/providers/adapters/loaders/subprocess.ts`
  - `SubprocessLanguageModel` now delegates to the driver system instead of spawning CLIs itself.
  - Maps driver `AgentEvent`s to `LanguageModelV2StreamPart`s.

### Phase 3 — Remote runtime daemon + WebSocket driver

- Daemon: `cmd/gizzi-code/src/runtime/daemon/runtime-daemon.ts`
  - Bun/Hono WebSocket server (`/ws`) with token auth.
  - Auto-discovers local CLIs, registers itself, and heartbeats.
  - Delegates `assign` / `stream` / `abort` / `inspect` to `LocalCliDriver`.
- CLI command: `gizzi runtime daemon` (`cmd/gizzi-code/src/cli/commands/runtime/daemon.ts`).
- WebSocket driver: `cmd/gizzi-code/src/runtime/drivers/websocket-driver.ts`
  - Implements `RuntimeDriver` over a WebSocket with request multiplexing.
- Factory wired for `websocket` transports in `cmd/gizzi-code/src/runtime/runtime-driver-factory.ts`.

### Phase 4a — Multica provider list in the registry

All 22 Multica CLIs are now present in `cmd/gizzi-code/src/runtime/providers/discovery/subprocess.ts`:

`claude`, `codex`, `cursor-agent`, `copilot`, `opencode`, `openclaw`, `hermes`, `pi`, `agy`, `codebuddy`, `deveco`, `grok`, `kimi`, `kiro-cli`, `qodercli`, `qoderclicn`, `qwen`, `qwenpaw`, `reasonix`, `traecli`, `dsh`, `omp`.

Plus the previously supported `gemini`, `llm`, `aichat`, `ollama`, `fabric`, `chatgpt`.

Icon assets and mappings are already prepared in `surfaces/ai.allternit.com/public/icons/agent-clis/` and `surfaces/ai.allternit.com/src/lib/agent-cli-icons.ts`.

### Phase 5 — SDK runtime module + surface UI board

1. gizzi-code HTTP runtime API: `cmd/gizzi-code/src/runtime/server/routes/runtime.ts`
   - `GET /runtime`, `GET /runtime/:id`, `DELETE /runtime/:id`
   - `POST /runtime/:id/heartbeat`
   - `GET /runtime/:id/logs`
   - `POST /runtime/:id/tasks`, `GET /runtime/:id/tasks/:taskId`
   - `GET /runtime/:id/tasks/:taskId/stream` (SSE)
   - `POST /runtime/:id/tasks/:taskId/abort`
   - Mounted in `cmd/gizzi-code/src/runtime/server/server.ts` at `/runtime` and `/v1/runtime`.

2. SDK runtime client: `sdk/allternit-sdk/src/ai-runtime/runtime/index.ts`
   - `RuntimeClient` with `listRuntimes`, `getRuntime`, `deleteRuntime`, `heartbeat`, `listLogs`, `assignTask`, `streamTask`, `abortTask`, `inspectTask`.
   - Works against the platform API (`/api/v1/runtime`) or directly against gizzi-code (`/v1/runtime`).
   - Exported from `sdk/allternit-sdk/src/ai-runtime/index.ts` and `sdk/allternit-sdk/package.json` as `@allternit/sdk/runtime`.

3. Surface runtime board:
   - Component: `surfaces/ai.allternit.com/src/components/runtimes/RuntimeBoard.tsx`
   - Uses `AgentCliIcon` / `AgentCliBadge`, shows online/offline/busy status, lists CLIs, and supports quick task execution with live SSE output.
   - Page: `surfaces/ai.allternit.com/src/pages/RuntimesPage.tsx`
   - Route: `/runtimes` in `surfaces/ai.allternit.com/src/routes.tsx`.

## What Remains

### Phase 3b — UDS driver (optional)

A Unix-domain-socket transport (`uds`) can be added alongside `websocket` for local co-located platform APIs. It would reuse the same message protocol over a `Bun.connect({ unix })` socket.

### Phase 4b — Per-provider execution adapters ✅

Implemented in `cmd/gizzi-code/src/runtime/drivers/local-cli-driver.ts`:

| Provider | Mode | Status |
|----------|------|--------|
| claude | stream-json warm | supported |
| kimi | one-shot | supported |
| codex | one-shot `exec` | supported |
| qwen | one-shot | supported |
| agy | one-shot | supported |
| pi / omp | `-p --mode json` | supported |
| cursor-agent | ACP stdio | supported |
| opencode | ACP stdio | supported |
| openclaw | ACP stdio | supported |
| hermes | ACP stdio | supported |
| grok | ACP stdio | supported |
| kiro-cli | ACP stdio | supported |
| qodercli / qoderclicn / qwenpaw / traecli | ACP stdio | supported |
| reasonix | ACP stdio | supported |
| codebuddy | stream-json warm | supported |
| dsh | DSH stdio profile | explicitly unsupported (pending wire spec) |
| deveco | unknown agent protocol | explicitly unsupported (pending wire spec) |
| copilot | `gh copilot suggest` | explicitly unsupported (not an agent chat protocol) |

There is no generic one-shot fallback; unknown CLIs are rejected with a clear error. `getCliAdapterInfo` and `test/runtime/local-cli-driver.test.ts` enforce this coverage.

## SDK note

The runtime client lives in the real SDK (`sdk/allternit-sdk/src/ai-runtime/runtime/`) and is exported as `@allternit/sdk/runtime`. The deprecated `@allternit/sdk-stub` package at `sdk/` has been removed, and `@allternit/gizzi-sdk` is no longer a dependency of `cmd/gizzi-code`. The canonical SDK is `@allternit/sdk`.

The runtime module builds cleanly via `pnpm build:runtime` (or `bun run build:runtime`) and emits `dist/runtime/`. The full `@allternit/sdk` ai-runtime source passes `tsc --noEmit --project tsconfig.ai-runtime.json`. Pre-existing TypeScript errors remain in the deprecated `@allternit/gizzi-sdk` package (tolerated by its own build script) and in unrelated surface packages; they are outside the runtime unification scope.

## Verification

- `bun run typecheck` in `cmd/gizzi-code` is clean.
- `bun test test/sdk.test.ts test/runtime/local-cli-driver.test.ts test/ui/runtime-lane.test.ts test/ui/status-bar-runtime.test.ts` in `cmd/gizzi-code` passes.
- `pnpm exec tsc --noEmit --project tsconfig.ai-runtime.json` in `sdk/allternit-sdk` is clean.
- `pnpm run build:runtime` in `sdk/allternit-sdk` emits `dist/runtime/` cleanly.
- `bun test src/ai-runtime/__tests__/full-integration.test.ts` in `sdk/allternit-sdk` passes.
- `cmd/gizzi-code/src/runtime/server/routes/runtime.ts` no longer uses `// @ts-nocheck`.

## Next Action

- Confirm actual flags for `dsh` (DSH stdio profile), `deveco`, and `copilot` if headless agent chat support is required; add protocol-specific adapters or keep the explicit unsupported mapping.
- Optionally implement Phase 3b UDS driver for local co-located platform APIs.
