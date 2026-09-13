# Session attestation — session/botdefault2-0912 (stop restoring picker default from session metadata)

- **Date:** 2026-09-12 (night)
- **Agent family:** kimi-code
- **PR:** #443 → merge `7905badb8` (tip `e6b99fcd6`)
- **Topic:** follow-up to #439 — pre-existing bot sessions still re-pinned the
  broken model on reopen.

## What was done

#439 removed the `bot.provider/bot.model` composer fallback, but the live smoke
on desktop 1.1.1.2387 showed a remaining path: sessions created **before** that
fix carry `metadata.runtimeModelId = "openai/gpt-5-mini"` (stamped at create
time by the old broken default), and `BotChatSessionView` restored the picker
default from session metadata — so every pre-existing bot session reopened with
the unprovisioned OpenAI model and silently produced no reply.

Fix: only `bot.config.runtimeModelId` (a deliberate bot-level pin) seeds the
composer default; session metadata is ignored for that purpose. Unpinned chats
fall back to the persisted picker choice and the send path resolves the local
Kimi brain (`kimi-cli/kimi-k3`).

## Verification

- `tsc --noEmit` clean; `vitest src/views/bots` 15/15 green.
- Live desktop smoke (raw CDP against the installed app): a pre-existing Gizzi
  session reopens with **Kimi K3** selected and the bot replies — no manual
  picker switch needed.

## Notes

- Incident: mid-session macOS TCC revoked the host process's Desktop folder
  access (all reads EPERM; writes partially worked). Pause + owner re-grant
  unblocked. No repo state was affected.
- The earlier b2387 install attempt briefly copied from a stale DMG mount
  (incomplete app); reinstalled cleanly from the correct mount and verified
  (platform chunk, 1065-file connector catalog, build-info) before continuing.
- Desktop rebuilt (renderer-only change; b2370-era sidecars reused — no Rust
  changes) and re-installed over `/Applications`.
