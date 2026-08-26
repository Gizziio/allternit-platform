# Bot / Group-Chat & Cloud-Desktop Integration Plan

## Goal

Ship a coherent bot experience in `surfaces/ai.allternit.com` where:
- Single-bot sessions run through the **harness-selected brain** on the real backend.
- Group chats run through the **same harness-selected brain**, produce multiple bot streams, and are surfaced correctly in the left rail / Bot Hub.
- Bot sessions never leak into Recents.
- Console errors in local dev are eliminated so real runtime bugs are visible.
- Cloud desktop is a **vmOperator target**, not a different brain. When the parallel cloud-backend agent lands, the same brain runs on a provisioned cloud desktop.

Done when:
1. `BotHomeView` shows only this bot's single-bot sessions; group chats are excluded.
2. `BotHubSessionsTab` excludes group chats and routes `chat-group-session` when appropriate.
3. `RecentsView` contains no bot/group sessions.
4. Local dev server loads without CORS/`ApiClient` failures.
5. A single-bot chat turn reaches `agent_session_routes.rs::send_message` with the agent's `harness` and `runtimeEnv` forwarded to Gizzi.
6. Group chat uses a harness-backed turn runner (not the desktop Kimi CLI bridge) and renders multi-speaker clusters.
7. `vmOperator` env vars flow from the frontend, through the backend, into Gizzi so a cloud desktop can be provisioned without changing the brain.

Stop and report if:
- The running Gizzi sidecar / backend is unreachable for more than one restart attempt.
- The parallel cloud-backend agent's branch has merge conflicts that require git mutations.
- A backend schema change is required that isn't covered by the existing migrations.

---

## Current state (verified)

| Area | Status | Key files |
|------|--------|-----------|
| Bot Hub / create bot wizard | Shipped | `src/views/AgentHub.tsx`, `src/views/agent-view/components/CreateBotForm.tsx` |
| Bot home screen | Shipped | `src/views/bots/BotHomeView.tsx` |
| Left rail bot + group-chat items | Shipped, layout already name-over-avatars | `src/shell/ShellRail.tsx:1595`, `:1681` |
| Group-chat session view | Shipped with clustering | `src/views/bots/GroupChatSessionView.tsx` |
| Recents exclusion | Shipped | `src/views/RecentsView.tsx:128-140` |
| Group chat leakage into single-bot UI | **Broken** | `BotHomeView.tsx:143-157`, `BotHubSessionsTab.tsx:70-107`, `BotHubHomeTab.tsx:27-34` |
| Console errors in dev | **Broken** | Wrong gateway / stale Vite processes / CORS to `api.allternit.com` |
| Single-bot brain | **Hack** | `src/lib/bots/bot-turn-runner.ts` calls `runKimiPrompt` (desktop Kimi CLI) instead of the agent harness |
| Group-chat brain | **Hack** | `src/lib/bots/group-chat-kimi-runner.ts` calls `runKimiPrompt` per member |
| Backend session path | Partial | `create_session` forwards `harness`; `send_message` ignores harness/runtimeEnv |
| vmOperator plumbing | **Stubbed** | Frontend builds `ALLTERNIT_VM_*` env vars; backend never forwards them |
| Cloud backend | In progress in another session | `session_00ca16bc-e1b4-442d-b3bc-2fd34d54068e` on branch `session/desktop-cloud-mvp` |

---

## Architecture correction

```
Frontend composer / bot setup
        │
        ▼
Harness selection (BYOK / cloud / local / subprocess)  ← brain stays the same
        │
        ▼
AgentContext.runtimeEnv  = harness + secrets + connectors + vmOperator
        │
        ▼
Backend /api/agent-chat or /api/v1/agent-sessions/{id}/message
        │
        ▼
Gizzi runtime receives harness + runtimeEnv
        │
        ├── brain: provider/model from harness
        └── vmOperator: ALLTERNIT_VM_* env tells Gizzi which desktop to use
```

For cloud desktop, only the `vmOperator` target changes (local OpenSandbox → cloud desktop router). The brain chosen by the harness does not change.

---

## Phases (highest ROI first)

### P0 — UI hygiene + dev environment (1 session)

*Goal: stop the bleeding so we can see real runtime behavior.*

1. Exclude `isGroupChat` sessions from:
   - `BotHomeView.tsx` `botSessions` filter
   - `BotHubSessionsTab.tsx` grouping + routing
   - `BotHubHomeTab.tsx` `sessionCountByBotId`
2. In `BotHubSessionsTab.tsx`, route `isGroupChat` sessions to `chat-group-session`.
3. Restart the correct worktree's Vite dev server on a clean port with:
   - `VITE_ALLTERNIT_GATEWAY_URL=http://127.0.0.1:8013`
   - `NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK=true`
   - kill stale 3014/3015/3016 Vite processes first
4. Verify the console is free of CORS / `ApiClient` base-failure noise.

**Verification:** load `http://127.0.0.1:3014`, open DevTools, assert zero CORS errors and zero `[ApiClient] All API bases failed`.

---

### P1 — Single-bot sessions use the real backend harness (1-2 sessions)

*Goal: remove the Kimi CLI fallback for single-bot chats.*

1. In `useStartBotSession.ts`, set `skipBackend: false` (or remove the override) so bot sessions are created via `/api/v1/agent-sessions`.
2. Ensure `mode-session-store.ts` no longer falls back to `executionPersistence: 'local'` for bot sessions when backend creation fails. If the backend fails, surface the error; do not silently degrade.
3. In `agent_session_routes.rs::send_message`, use the session's stored `harness` and forward any `runtimeEnv` from the request body into the Gizzi `/v1/session/{id}/message` payload.
4. In `chat_routes.rs::handle_agent_chat`, accept `runtimeEnv` from the flattened context and pass it to `stream_chat_through_gizzi`.
5. Update `gizzi_chat_stream.rs` to attach `runtimeEnv` to the provider/session env so the brain can see `ALLTERNIT_VM_*` and other bot credentials.
6. Delete or deprecate `src/lib/bots/bot-turn-runner.ts` and the desktop Kimi bridge path.

**Verification:**
- Create a bot, start a chat, send a message.
- Network tab shows POST to `/api/v1/agent-sessions` then `/api/v1/agent-sessions/{id}/message`.
- Response comes from Gizzi, not a local `kimi` subprocess.
- Bot replies with its configured display name.

---

### P2 — Group chat uses harness + real backend sessions (2-3 sessions)

*Goal: multi-bot conversations without the Kimi CLI hack.*

1. Keep the group definition in `group-chat.store.ts` but create the session through the real backend (`skipBackend: false`).
2. Replace `group-chat-kimi-runner.ts` with a `group-chat-turn-runner.ts` that:
   - resolves each member's `harness`
   - builds a per-member prompt containing the shared history and strict identity clause
   - calls the backend inference path (either `/api/agent-chat` for a one-shot turn or ephemeral `/api/v1/agent-sessions`) using that member's harness
   - appends each reply with `botId`/`agentName` metadata so `GroupChatSessionView` clusters speakers
3. Add an ephemeral backend session helper if needed so each bot turn has isolated context without polluting the user's group session list.
4. Ensure `GroupChatRailItem` remains name-over-avatars and the group chat opens `chat-group-session`.

**Verification:**
- Create a group chat with 2+ bots.
- Send a message; each reply is tagged with the correct bot name.
- The group chat does not appear under any single bot's home or the Bot Hub Sessions tab.

---

### P3 — vmOperator / cloud-desktop target wiring (2-3 sessions)

*Goal: cloud desktop is just another vmOperator provider.*

1. Add `cloud-desktop` to `AgentVMOperatorConfig.provider` union in `agent.types.ts`.
2. Extend `bot-runtime-env.ts` to emit `ALLTERNIT_VM_CLOUD_DESKTOP_ENDPOINT` when provider is `cloud-desktop`.
3. Forward `runtimeEnv` through the backend (already required by P1) so Gizzi receives `ALLTERNIT_VM_*` vars.
4. When the parallel agent's work lands:
   - wire `cmd/allternit-computer-cloud` substrate router as the provisioner for `cloud-desktop`
   - route `createSandbox` calls with `provider: 'cloud-desktop'` to the cloud desktop queue/API
5. Remove Docker sandbox references from the default bot setup; keep OpenSandbox and cloud-desktop as supported providers.

**Verification:**
- Configure a bot with `vmOperator.provider = 'cloud-desktop'`.
- Start a session; the request payload contains `ALLTERNIT_VM_OPERATOR_ENABLED=true` and `ALLTERNIT_VM_PROVIDER=cloud-desktop`.
- The backend provisions (or queues) a cloud desktop without changing the brain model ID.

---

### P4 — Integrate the parallel cloud-backend agent's branch (when ready)

*Goal: absorb the other agent's cloud-desktop work without destabilizing the UI/backend.*

1. Review the other agent's worktree: `/Users/joe/Desktop/Allternit/allternit-platform`, branch `session/desktop-cloud-mvp`.
2. Merge or copy the relevant pieces into this worktree:
   - `cmd/allternit-api/src/bot_desktop_queue.rs`
   - `cmd/allternit-api/src/bot_desktop_routes.rs` / `bot_desktop_mux.rs`
   - `cmd/allternit-computer-cloud/src/substrate.rs`, `router.rs`, `tart.rs`
   - migrations `V93-V98`
3. Wire the new queue/router into the `vmOperator` provisioning path.
4. Do **not** perform git mutations unless explicitly asked; apply changes as file edits in this worktree.

**Verification:** end-to-end provision → chat → deprovision of a cloud desktop bot.

---

## Agent swarm assignments

These tasks are independent enough to run in parallel once the plan is approved:

| Subagent | Scope | Deliverable |
|----------|-------|-------------|
| **Swarm-1 UI cleanup** | `BotHomeView.tsx`, `BotHubSessionsTab.tsx`, `BotHubHomeTab.tsx`, `RecentsView.tsx` | PR-quality diff with group-chat leakage fixed |
| **Swarm-2 Dev env + console errors** | Vite restart, env vars, stale process cleanup | Dev server on known port, zero CORS console errors |
| **Swarm-3 Backend message path** | `agent_session_routes.rs`, `chat_routes.rs`, `gizzi_chat_stream.rs` | `runtimeEnv` + `harness` forwarded to Gizzi |
| **Swarm-4 Single-bot backend wiring** | `useStartBotSession.ts`, `mode-session-store.ts` fallback removal | Single-bot chat uses backend, no Kimi fallback |
| **Swarm-5 Group-chat runner** | `startBotGroupChat.ts`, new `group-chat-turn-runner.ts`, `GroupChatSessionView.tsx` | Multi-bot harness-backed group chat |
| **Swarm-6 vmOperator plumbing** | `agent.types.ts`, `bot-runtime-env.ts`, cloud-desktop provider enum | `cloud-desktop` is a first-class vmOperator target |

The parent agent (this session) reviews each swarm's output, runs integration tests, and merges only clean diffs.

---

## Stop rules

- If a swarm diff does not type-check or leaves the dev server broken, reject it and ask the swarm to fix before merging.
- If Gizzi is unreachable, stop backend wiring work until the sidecar is restored.
- If the parallel cloud-backend branch cannot be merged cleanly due to conflicts in `main.rs` or migrations, report the conflicting files and wait for user direction before any git operation.
