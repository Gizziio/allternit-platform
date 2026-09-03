# OpenMausBot → Allternit Integration Data Model

This document maps OpenMausBot concepts onto Allternit's existing primitives so the integration stays a "merge, not a rebuild."

## Identity: Bot = Agent + BotProfile

| OpenMausBot | Allternit |
|---|---|
| `BotRecord` | `Agent` with `isBot: true` and required `botProfile` |
| `name`, `title`, `description` | `agent.name`, `agent.description`, `botProfile.displayName`, `botProfile.tagline` |
| `color`, `avatarUrl` | `botProfile.accentColor`, `botProfile.avatar` / `agent.avatar` |
| `mascotExpression` | `agent.characterLayer.avatar.mascot` + `BotAvatar.tsx` |

Key file: `surfaces/ai.allternit.com/src/lib/agents/agent.types.ts` — `Agent`, `BotProfile`, `Bot`, `AgentVMOperatorConfig`.

## Conversation: Thread = Chat Session = WIH

| OpenMausBot | Allternit |
|---|---|
| `ThreadId` + per-thread message files | `ChatSession` in `ChatSessionStore` |
| `TaskRecord` (isolated conversations per bot) | Filtered chat sessions with `metadata.isBot === true` and `metadata.agentId` |
| `Message` (`role`, `kind`, `card`, `png`) | `ChatSession.messages` with role, text, metadata parts, and agent elements |
| `resumeCursors` per instance | `ChatSession.metadata.model`, `metadata.agentModeId`, provider-native session state stored by the harness |
| Per-thread NDJSON event log | Rails WIH event ledger + `bot-activity-api` |

Key files:
- `surfaces/ai.allternit.com/src/views/chat/ChatSessionStore.ts`
- `surfaces/ai.allternit.com/src/lib/bots/useStartBotSession.ts`
- `rails/src/wih/types.rs`

## Execution: Provider / Model = Harness + Brain

| OpenMausBot | Allternit |
|---|---|
| `DriverKind` + `ProviderDriver` | `Agent.provider` enum + `Agent.harness` config + optional `brainId` |
| `ModelCatalog` | `/api/v1/brains` list + inference router |
| Local CLI providers (`claude`, `codex`) | `inference_router_routes.rs` + `cli_provider_detector.rs` (revive from abandoned worktree) |
| `ProviderAdapter.sendTurn` | gizzi-code runtime `sendMessageStream` + Rails WIH pickup/close |
| `ProviderAdapter.capabilities` | `Agent.capabilities`, `allowedTools`, `allowedSkills` |

Key files:
- `surfaces/ai.allternit.com/src/lib/bots/useStartBotSession.ts`
- `cmd/allternit-api/src/inference_router_routes.rs` (worktree reference only; needs rewrite)
- OpenMausBot `server/drivers/claude.ts`, `server/drivers/codex.ts`

## Approvals: Permission Broker = Rails Gate + Cowork

| OpenMausBot | Allternit |
|---|---|
| `request.opened` / `request.resolved` | Rails Gate `pre_tool` / `post_tool` + Cowork approval cards |
| Inline approval/question cards | New chat-native `ApprovalCard` / `QuestionCard` components |
| `autoApprove` / `alwaysAllow` | `Agent.trustTier` + Gate policy + per-tool lease |
| Local-computer block | `AgentVMOperatorConfig.networkPolicy`, host-control opt-in |

Key files:
- `rails/src/gate/gate.rs`
- `surfaces/ai.allternit.com/src/views/cowork/`

## Computer: Computer Panel = VM Operator + ACU

| OpenMausBot | Allternit |
|---|---|
| `computer: "cloud" | "vm" | "local" | "off"` | `Agent.vmOperator.enabled` + provider enum |
| Live screenshot preview | `BotDesktopView.tsx` noVNC stream / ACU gateway screenshot frames |
| "Open desktop" VNC | `vm-operator.ts` `vncUrl` |
| Cloud Box | `vmOperator.provider: 'opensandbox'` or cloud bridge |
| Local CUA host control | `cmd/allternit-desktop-provider/` + explicit opt-in |

Key files:
- `surfaces/ai.allternit.com/src/views/bots/BotDesktopView.tsx`
- `surfaces/ai.allternit.com/src/lib/bots/vm-operator.ts`
- `domains/computer-use/core/gateway/`

## Apps: Composio = Open Connector

| OpenMausBot | Allternit |
|---|---|
| Composio Sessions + marketplace | `services/open-connector/` catalog + OAuth |
| `connector` message kind | `AgentConnectorBinding` + connector tool results in chat metadata |
| Credential storage | Rails Vault + connector-sidecar; secret refs never hold plaintext in the UI |

Key files:
- `surfaces/ai.allternit.com/src/lib/agents/agent.types.ts` (`AgentConnectorBinding`)
- `services/open-connector/src/catalog-store.ts`
- `rails/src/vault/vault.rs`

## Groups / Channels

| OpenMausBot | Allternit |
|---|---|
| `GroupRecord` (members, default responder, bulletin, cwd) | `lib/bots/group-chat.types.ts` + `group-chat.store.ts` |
| Group chat UI | Missing: `GroupChatView.tsx`, `GroupChatComposer.tsx`, `GroupChatAvatar.tsx` |

Key files:
- `surfaces/ai.allternit.com/src/lib/bots/group-chat.*`

## Memory / Personality Workspace

| OpenMausBot | Allternit |
|---|---|
| Thread memory | `bot-memory-store.ts` (needs wiring into session context) |
| Personality files | `bot-workspace-store.ts` + `bot-workspace-serializer.ts` |
| Bot duplication | `bot-clone.service.ts` |

Key files:
- `surfaces/ai.allternit.com/src/lib/bots/bot-memory-store.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-workspace-store.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-clone.service.ts`

## Source of Truth

- **Canonical bot identity:** `Agent` row / API (`/api/v1/agents*`).
- **Canonical session/transcript:** `ChatSessionStore` persisted via gizzi/session API; long-term in Rails WIH ledger.
- **Canonical approvals:** Rails Gate receipts.
- **Canonical connector secrets:** Rails Vault; UI only sees opaque `vaultRef` flags.

## What's New vs. What Already Exists

Already exists in `main`:
- `Agent` + `BotProfile` types
- `BotRoster`, `BotHomeView`, `BotDesktopView`
- `useStartBotSession`, `vm-operator`
- `ChatSessionStore`, chat composer
- `group-chat.service.ts`, `group-chat.store.ts`
- `services/open-connector/` catalog
- `bot-memory-store.ts`, `bot-workspace-store.ts`, `bot-clone.service.ts`

Needs to be built or ported from OpenMausBot:
- Group chat views (`GroupChatView`, `GroupChatComposer`, `GroupChatAvatar`)
- Inline approval/question cards in chat
- Pick-a-Brain provider/model picker with local CLI detection
- Packaged team import (.md / YAML frontmatter)
- Bot memory wiring into chat context
- Voice / TTS speaker button + call mode
- Webhook triggers / routines UI
- Desktop packaging hardening

## Ralph Loop Status

Search of `main` (`rails/`, `cmd/allternit-api/`, `surfaces/`) found **no runtime code dependencies** on the old Ralph loop. References are limited to:
- `.steering/checkpoint.md` (session notes)
- `docs/IMPLEMENTATION_DAG.md` (architecture docs)
- The abandoned `allternit-session-grok-bot-0-18-integration` worktree

Bot turns in `main` currently flow through `useStartBotSession` → `ChatSessionStore.sendMessageStream` → gizzi runtime. The new goal-loop runtime from the abandoned worktree is **not merged**; it does not need to be removed from `main`. Phase 0.5 of the integration plan can be reduced to a verification task rather than a removal/port task.
