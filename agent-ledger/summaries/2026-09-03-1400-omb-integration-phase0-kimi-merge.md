# Merge attestation — omb-integration-phase0

**Date:** 2026-09-03
**Branch:** `session/omb-integration-phase0` → merged into `main` (`a570a1c40`)
**Final state:** Merged ✅ (uncommitted session state committed as `d0ad59e47` and pushed before merge)

## What was done

OMB Phase 0: BotRoster + GroupChatView + GroupsListView + BotChatSessionView
(`surfaces/ai.allternit.com/src/views/bots/`), chat/provider/model-picker
edits in allternit-api (`chat_routes.rs`, `gizzi_chat_stream.rs`,
`provider_routes.rs`), unified-roster hooks.

Conflict resolutions (9 files):
- Session-start flow kept omb's bot-chat-session routing (AgentHub, ShellApp,
  ShellRail, BotHubSessionsTab).
- `chat-agent-session` alias kept main's newer cowork-workspace routing
  (omb's ChatAgentSessionRouter stays defined and reachable via bot-chat-session).
- `use-available-brain-models.ts`, `model-picker.tsx`, `provider_routes.rs`,
  `ChatView.tsx` kept main's newer versions (Groq/string-priced model support,
  design tokens, kimi-k3 catalog).
- Fixed a duplicate `chat-agent-session` entry pre-existing in main's
  ViewRegistry.

## Outstanding work

- omb's bot-chat-session flow vs desktop-cloud's cowork/group-chat flow were
  reconciled again in the desktop-cloud merge (see that attestation).
