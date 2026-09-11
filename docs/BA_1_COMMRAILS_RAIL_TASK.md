# BA-1 Live CommRails rail — task

Read `docs/BA_1_COMMRAILS_RAIL_MAP.md` first. **Do not start BA-3.** Preserve the BA-0b crate rename already in this worktree.

You are in the allternit-platform worktree `allternit-ao-ba-0b-commrails`. You cannot read `~/Desktop/Allternit/`.

## Goal

Kill seed bots. The CommRails rail shows live roster + operational status, a Sessions section from a thin visibility DTO (empty copy if ao is down), Needs-you from waiting_approval/waiting_input + `wih:executor-*` unread mail, and executor threads stay in the inbox.

## Implement exactly

Follow the MAP. Sequence:

1. Remove `SEED_BOT_SESSIONS`; default sessions `[]`; drop persisted seed ids on hydrate.
2. Wire Bots section from `useUnifiedRoster` + `useBotOperationalStateStore`. Status is the projection only.
3. Sessions section + `GET /api/commrails/visibility` (and `/api/rails/visibility` alias) on the existing rails router. Empty arrays + "ao is not running" on failure. Do not pull ao-engine into allternit-api if that is a dep tangle.
4. Needs-you badges from operational status + unread `wih:executor-*`. Reuse existing approve/deny/mail decide. No second ao island.
5. Vitest: no seed names; roster fixture; visibility failure does not throw; executor thread prefix kept.
6. ShellRail: render the new sections if it does not already call `getSections()`.

## Hard rules

- Product is Allternit Agents / Bot Agents. CommRails is crate+CLI+rail. ao is the worker.
- No Stripe, no deploys, no Docker, no OpenAI/Anthropic wrap.
- Register 1 empty copy. No hype.
- No git commit / push / PR. `git mv` only if you must rename a file.

## Constraints

- Stay inside the MAP file list plus colocated tests.
- No workspace-wide cargo/pnpm. Allowed: vitest on the new test file; optional `cargo check -p allternit-api` if you touch the visibility route.
- No dev server.

## Done sentinel

Write `docs/BA_1_COMMRAILS_RAIL_NOTES.md`:

```yaml
---
status: done | blocked
files_changed: []
deviations: []
remaining: []
brain_updates: []
---
```

`touch docs/BA_1_COMMRAILS_RAIL_NOTES.sentinel`. Append `### ba-1-commrails-rail <ISO ts>` to `.allternit/shared-context.md` if present.
