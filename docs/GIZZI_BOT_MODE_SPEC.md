---
doc: spec
updated: 2026-09-07
status: approved
session: session/befe7aa3
---

# Gizzi Bot Mode — CLI parity spec

Benchmark: NousResearch Hermes Bot Mode ([docs](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode)),
cross-checked against `docs/BOT_TEAMMATES_SPEC.md` (platform track) so both
surfaces share vocabulary, failure codes, and attribution strings.

**Design principle (same as Hermes + platform): a Bot is a profile.** No new
agent runtime primitive. Bot Mode is a packaging + routing layer over gizzi-code
sessions, cron, and Rails peers.

## Decisions

- **D1 Bot home**: `~/.gizzi/bots/<name>/` — `bot.json` (identity: name,
  title, description, model pin, avatar, canonicalSession {projectPath,
  sessionId}, capabilityEpoch, createdAt), `SOUL.md` (persona/standing
  instructions), `memory/` (bot-scoped notes injected at session start).
  Distinct from config profiles (`~/.gizzi/profiles/*.json`) which remain
  config-override bundles.
- **D2 Canonical bot chat**: one pinned session per bot. `bot.json`
  canonicalSession pointer; opening the bot resumes it; compaction/forking may
  re-point the pointer (Hermes root→tip pattern). `/new` inside a canonical
  bot chat reroutes to compact (composer guard) — never forks the relationship.
- **D3 Routines**: cron jobs of type `agent` with `bot: <name>` deliver the
  prompt into the bot's canonical session (resume + turn), NOT
  `Session.createNext()`. Jobs namespaced `[bot:<name>] <label>`.
- **D4 Failure taxonomy**: exact port of the platform's 13-code closed
  vocabulary (`surfaces/ai.allternit.com/src/lib/bots/failure-reasons.ts`,
  itself verified against Hermes `bot_failure_reasons.py`). Codes:
  `provider_auth_or_access`, `provider_quota_limit`, `provider_rate_limit`,
  `provider_server_error`, `context_overflow`, `missing_config`,
  `model_unavailable`, `runtime_offline`, `queued_expired`, `delivery_timeout`,
  `target_busy`, `unknown`, + Allternit extension `agent_blocked`.
  Retry policy: transient classes retry at most once; `context_overflow`
  retries after compact; auth/quota/config never auto-retry.
- **D5 message_agent**: tool exists only in canonical bot chat sessions.
  Fire-and-forget DM into the target bot's canonical chat (local: direct wake;
  Rails peer otherwise). Attribution prefix identical to the platform:
  `Message from 🤖 <sender> (@<sender>):`. Teammate roster (names + titles)
  is injected into every canonical bot chat's system prompt; drift in roster
  or bot config bumps the capability epoch and rebuilds the injection once.
- **D6 CLI parity table**:
  | Bot Mode | gizzi-code |
  |---|---|
  | Chat with a bot | `gizzi bot chat <name> [message]` (or `-p <name>`) |
  | Bot's files/memory | `~/.gizzi/bots/<name>/` |
  | Routines | `gizzi cron list` (`[bot:<name>] …`) |
  | Create/inspect | `gizzi bot create|list|show|edit|clone|delete` |
- **D7 Non-goals** (this session): group deliberation rooms (platform Phase 4),
  cross-machine peer fabric (platform Phase 3 / `hermes peer` equivalent),
  avatar rendering in TUI, pixel pets.

## Phases (status as of 2026-09-07, all coded on session/befe7aa3)

- **B1 — Bot profile primitive** ✅: `~/.gizzi/bots/<name>/` store, `gizzi bot`
  command group (create/list/show/edit/clone/delete), SOUL.md + memory wiring.
- **B2 — Canonical bot chat** ✅: pointer resolution, `gizzi bot chat`,
  `/new`→compact composer guard, identity + persona prompt injection,
  capability epoch.
- **B3 — Routines** ✅: agent-executor `bot:` delivery path, `gizzi bot routine`,
  `[bot:<name>]` namespace, missed-run notes landing in canonical chat.
- **B4 — message_agent + failure reasons** ✅: taxonomy port, typed retry on bot
  wake, `message_agent` tool (canonical chats only), teammate roster injection.
- **B5 — TUI bots pane** ✅: `/bots` roster with presence (90s window), unread
  badges, canonical-chat open/create/delete. Known limit: REPL transcript not
  reloaded on session switch from the pane.
