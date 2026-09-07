# BOT_TEAMMATES_SPEC — Bots as Persistent Teammates (full build spec)

> **Status:** Approved spec, ready for phased implementation.
> **Benchmark:** Hermes Desktop Bot Mode (NousResearch/hermes-agent, MIT) — verified against source, plus Notion rail patterns.
> **Date:** 2026-09-07 · Branch: `session/bot-teammates-spec`

## 0. Why this is cheaper than it looks

Allternit already has ~80% of Hermes Bot Mode's substrate. Verified equivalents:

| Hermes | Allternit |
|---|---|
| Bot = profile (no new primitive) | ✅ Bot = Agent + `botProfile` |
| Canonical "Bot Chat" per bot | ✅ `bot-canonical-chat.service.ts` |
| Routines = `[bot:<name>]` cron landing in Bot Chat | ⚠️ `bot-routine.service.ts` exists, **no timer caller** |
| `message_agent` handoff w/ attribution | ✅ `mention-handoff.service.ts` (identical attribution string) |
| Group chats (2–6 bots, 3 rounds, 10 msgs, `pass`) | ✅ `group-chat-turn-runner.ts` (same constants), but local-only |
| Roster unread via watermarks | ⚠️ mail unread only; no roster watermarks |

The build is **wiring + trust layers + two L-sized fabrics**, not new primitives.

## Design principles (copied from Hermes' hard-won policy)

1. **Failure-safety and conflict-safety are first-class UI concerns** — typed failure codes, CAS metadata merge, fail-closed resume, guards with tests.
2. **Bots are eternal; sessions must survive drift** — capability epoch + prompt rebuild.
3. **Only persistent failures badge; transient never does; next good turn clears.**
4. **Never auto-retry auth/quota/config failures** — one retry max, transient classes only.
5. **Activity surfaces opt-in** — toasts default OFF (a busy roster turns toasts into a firehose).
6. **The rail stays sleek** — self-pruning sections, progressive disclosure (Notion), lean presence (Hermes "Active Now").

## Architecture decisions

- **AD-1 Cross-machine: direct peer model, not desktop-relay.** Hermes' desktop-held relay dies when the laptop closes; Allternit's Rust API daemon is already a persistent listener. Extend `.allternit/peers/` registry with `{url, key}`; `dm` (sync turn) vs `run/status/stop` (async + `--idempotency-key`); keys live in a gitignored env file, never the registry; document the one-way-NAT/Tailscale constraint.
- **AD-2 Group persistence: bounded projection in the Rust API.** Rooms table mirroring Hermes' limits (48KB / last 16 msgs / 1200 chars/msg), per-node `syncRevision` merge, tombstones on disband, immutable `roomId` (renames don't fork), re-seed-on-reconnect, per-member watermarks keyed `<thread>::<member>`. Rails-mail SQLite is the carrier but needs message-body + membership + revision semantics.
- **AD-3 Failure taxonomy: closed 12-code vocabulary**, adapted to Allternit's providers (hermes/openclaw/grok error shapes). Classifier precedence: auth > quota (real 401 bodies mention funds). `AUTO_RETRYABLE = {runtime_offline, delivery_timeout, rate_limit, server_error}` → one retry; `context_overflow` → compact-then-retry; all else → never. Codes ride alongside free-text end-to-end and tag completion notices.
- **AD-4 Capability epoch.** Fingerprint the bot's whole capability surface (starterPrompts, persona/SOUL, skills, connectorBindings, secretRefs presence, roster names/roles); stamp `Capability epoch: <12-hex>` into the canonical-chat system prompt; rebuild-once-per-drift in the session runner; `protocol_version` salt forces fleet-wide protocol-text adoption.
- **AD-5 Routine delivery semantics.** Output delivered **as a real inbound turn in the canonical chat** (the bot responds, where you'd talk to it anyway); `context_from: self` injects the job's previous output; per-routine KV scratchpad in the Rust API (16KB/value, 64KB/routine); **monitor-mode** jobs hash source output and skip the LLM on no-change (silent run, capped 4KB diff on change); pre-security-fix jobs force-pause behind "delete and recreate".

## Phases (each independently shippable)

### Phase 0 — Trust foundations (M)

- `classifyFailure(err)` util + reason codes threaded through `wakeBot` results and rails-mail delivery records.
- `attention` slice in `agent.store` (keyed by bot; persistent classes `provider_auth_or_access`, `provider_quota_limit`, `missing_config`, `agent_blocked` badge with per-class tooltips; cleared by next good turn; archived/hidden bots accumulate but don't display).
- Capability epoch (AD-4) in the bot session runner.
- Canonical-chat hardening: pinned id resolves root→tip across compaction (Hermes `get_compression_tip` pattern); composer guard reroutes "new chat" → compact when the canonical chat is on screen; auto-resurrect if accidentally archived.
- Store versioning: version `botProfile`/roster stores with two-phase-commit migrators (Hermes BotMeta v1→v2 pattern); sweep orphaned ephemeral group sessions.

### Phase 1 — Teammates rail + routines wired (M)

- **TEAMMATES rail section** (home mode) above PINNED: bots with recent activity (90s presence window), running turns/routines, unread mail, or attention state. Cap 6, self-prunes when quiet, "All teammates" → Bot Hub. Rows reuse the live-item idiom: avatar, name, status line ("Working…" / "⏰ ran Morning summary · 8m" / last message), hover actions (Open chat, Start session, ••• menu). Presence slice derived from lastActivity + busy flag + vm sandbox heartbeat (150s worker window).
- **Routine timer**: `runDueBotRoutines()` on a 60s interval + missed-due-on-launch; delivery semantics per AD-5.
- **Routine creation UI** in Bot Home's automation tab: frequency-first picker (once / hourly / daily / weekdays / weekly / monthly / interval / advanced raw cron) + natural-language instruction field on top; existing Goals/Routines/Loops UI stays as the advanced layer. Runs land in canonical chat with routine chip in the rail row.
- `shareAuth` semantics: new bots default to shared secretRef resolution; clone copies persona/prompts/avatar, never runs/tasks/checkpoints (Hermes' history-strip rule).

### Phase 2 — Visibility layer (S)

- **Watermark unread** for canonical chats: seed-on-mount so history never marks unread; badge = activity > watermark; refresh-in-place when the chat is focused.
- **Activity toasts** (opt-in pref, **default OFF**; "🤖 New message for \<bot\>" for DMs vs "\<bot\> has new activity" otherwise; 140-char clip; archived/hidden bots never toast but accumulate unread silently).
- **Unified Inbox rail row** (folds in the deferred rail-upgrade #5): badge = Σ mail unread + attention count + group escalations; pin-able pane listing threads newest-first (avatar, preview, relative time, unread dot); mark-all-read. Avatar asset endpoints on the Rust API so mail/inbox can show real bot pfps (rasterize deterministic avatars at write time).

### Phase 3 — Cross-machine fabric (L)

- Peer registry extension (`url` + `key` refs), `dm` / `run` / `status` / `stop` over the peer's HTTP inbox; idempotency keys make retries return the original run; 900s envelope TTL + drain; fail-fast `runtime_offline` classification.
- Union roster propagation (ghost rows with `sourceReachable/sourceMissing` status; keep-last-known on poll failure; reconcile on reconnect).
- Bot creation "on" picker when multiple connections exist.

### Phase 4 — Server-side groups (L)

- Rooms persistence per AD-2: bounded projection, revisions, tombstones, immutable roomId, re-seed on reconnect, per-member watermarks (the piece that makes 3-round deliberation cheap over long histories).
- `holds` / needs-you escalation from `@user` mentions surfaced in rail rows and the Inbox.
- Room sync across machines rides the Phase 3 fabric.

### Phase 5 — Polish (S–M)

- Roster user sections: promote `botProfile.category` to ordered sections; drag-to-section; membership stored on the bot (deleting a section can't orphan); CAS per-field revisions + `fetchedAt` fencing once botProfiles sync server-side.
- Group sessions titled `Group: <roomId>` so a same-name room recreate never resumes stale sessions.
- **Tests at Hermes density** (their single cheapest quality lever): colocated tests for mention resolution, handoff attribution string, watermark seeding, fingerprint drift rebuild, retry-class policy, routine delivery into canonical chat, projection merge.

## Gap ledger (Hermes → Allternit, from source-verified analysis)

| Gap | Hermes ref | Size |
|---|---|---|
| Cross-machine messaging fabric | `tools/bot_relay.py`, `tools/bot_mode_dm.py` | L (Phase 3) |
| Peer gateways | `hermes_cli/subcommands/peer.py` | L (Phase 3, AD-1) |
| Server-side group persistence/sync | `group-chat.ts` projection/merge | L (Phase 4, AD-2) |
| Typed failure taxonomy + retry/attention | `tools/bot_failure_reasons.py` | M (Phase 0) |
| Capability epoch / prompt rebuild | `tools/bot_mode_probe.py` | M (Phase 0) |
| Routine delivery semantics (continuity, scratchpad, monitor mode) | `cron/scheduler_delivery.py`, `cron/notepad.py`, `cron/monitor.py` | M (Phase 1) |
| Watermark unread | `roster-actions.ts` | S (Phase 2) |
| Activity toasts | `roster-actions.ts` | S (Phase 2) |
| Presence model (90s/150s windows) | `row-helpers.ts` | S (Phase 1) |
| Ghost rows / source reachability | `types.ts RosterRow` | S (Phase 3) |
| Roster user sections + CAS sync | `BotMeta.sectionId`, `mergeServerMeta` | S–M (Phase 5) |
| Avatar/asset sync | `profiles.set_asset` | S–M (Phase 2) |
| shareAuth / clone inheritance | `create-dialog.tsx`, `hermes_cli/profiles.py` | S (Phase 1) |
| Canonical-chat immortalization | `methods_profiles.py` UNIQUE + resurrect | S–M (Phase 0) |
| Migration discipline + sweeps | `data.ts` v1→v2, `session-sweep.ts` | M (Phase 0/5) |

## Explicit non-goals

- Pixel-level Hermes clone (pixel pets, kanban workers) — avatars stay Allternit's geometric/pet/image.
- Toast-by-default — policy is opt-in (Hermes ships default-OFF for a reason).
- Rebuilding the group turn engine — behavior already matches Hermes; only persistence/sync is added.
