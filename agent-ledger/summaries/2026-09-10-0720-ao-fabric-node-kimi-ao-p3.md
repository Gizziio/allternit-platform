# Attestation — session ao/fabric-node (P3 Fabric Transport node)

- Date: 2026-09-10
- Agent family: kimi (executor session + orchestrator pairing/live-verify/recovery/commit)
- Branch: `ao/fabric-node` → PR #229, merged `503d99223e`
- Queue: `rq-20260908-028` — P0, P1, P2, P3 landed

## What was done

P3 per `Products/AgentOrchestratorRuntime.md` §7: ao as a first-class Fabric
Transport node. Seven additive modules under
`infrastructure/executor/ao-engine/src/ao/fabric/`:

| Module | Contents |
|--------|----------|
| `mod.rs` | Module wiring |
| `wire.rs` | serde wire envelopes + golden-fixture tests |
| `identity.rs` | Ed25519 node identity, `~/.agent-orchestrator/fabric/identity.json` (0600, atomic write) |
| `cloud.rs` | Pairing lifecycle: create → poll exchange → rotate → heartbeat |
| `relay.rs` | Line-faithful Rust port of `cmd/agent-daemon/src/index.ts` relay client |
| `shim.rs` | axum HTTP+WS loopback shim translating the Fabric `/v1/*` surface to the engine socket API |
| `cli.rs` | `ao fabric pair\|serve\|status` |

New deps (all workspace or pinned): `axum`, `reqwest`, `tokio-tungstenite`,
`ed25519-dalek`, `rand 0.8`, `futures-util 0.3`. Dispatch at
`src/cli.rs` — `"fabric" => crate::ao::fabric::cli::run(...)`.

Shim surface: `/health`, `/status`, `/v1/remote-control/sessions` (+ `/:id`,
`/messages` POST → `pane.send_input`, `/abort` POST → ctrl+c, `/events` WS),
`/v1/permission` + `/v1/question` → empty arrays, `POST /v1/session` → 501
(ao sessions come from `ao spawn`). Sessions enumerated from
`~/.agent-orchestrator/state.json` ∩ engine `workspace.list`.

## How it works / verification

- Executor smokes: build green; wire/fixture tests pass; fork-diff guardrail PASS.
  Full evidence in worktree `allternit-ao-fabric-node/docs/AO_FABRIC_NODE_NOTES.md`.
- **Live pairing (human gate cleared 2026-09-10 ~01:28 CDT):** `ao fabric pair`
  approved in the PWA — runtime `rt_af9d675b04b24bf88b8de119e9a2b650`
  ("ao-dev-mac"), user seed@allternit.dev, token valid to 2026-12-09.
- **Live node proof:** `ao fabric serve` shim (port 8015; 8014 occupied by the
  local allternit-api gateway) serves `/v1/remote-control/sessions` listing the
  live `ao-hardgate-demo` engine session; relay log shows "Secure runtime relay
  connected"; Fabric PWA (fabrictransport.allternit.com) shows ao-dev-mac 3/3
  online with fresh heartbeat. Screenshot:
  `~/.agent-orchestrator/evidence/ao-fabric-node/pwa-node-online.png`.
- Pairs with `--runtime-type desktop` until server enum PR #220 ships (live API
  still rejects `runtimeType "ao"` with 400 — verified by direct curl).

## Incidents

- First executor session reached "implemented, live-verify blocked on human
  approval" and stalled; orchestrator completed pairing + live verification
  via a debug Chrome (CDP 9222, /tmp/chromeprof profile copy) and merged
  after resolving a `.steering/checkpoint.md` conflict (keep-both).

## Honest deferrals

- **Hard gate: PARTIAL.** ao-side scope is proven end-to-end, but PWA pickup of
  an ao session is blocked by platform-side wiring, not ao code:
  1. fabrictransport PWA calls same-origin `GET /api/v1/sessions` → 404; the
     service lives at `https://ai.allternit.com/api/v1/sessions` (200).
  2. `GET /api/v1/runtime-devices/<rt>/proxy/...` returns 401 "Invalid or
     expired token" for a Clerk session token even though the PWA's own
     runtime-list calls succeed — proxy auth wiring unresolved (platform side).
  3. Design gap: ao has no caller for the platform's existing
     `/api/v1/agent-sessions/sync` route, so ao sessions never reach the
     platform session catalog.
  These three plus two PWA bugs (SW cache-first blank shell after deploys;
  `runtime_pairing.rs` default platform URL pointing at platform.allternit.com
  instead of ai.allternit.com) are tracked as follow-up bugs.
- Server enum PR #220 (`runtimeType "ao"`) still open — required for ao-typed
  pairing on the live API.
- Node was paired under the seed@ account, not the user's Proton account
  (user said seed@ is fine; re-pair possible later via `ao fabric pair`).
