# P6a — UHP core gateway crate + `ao serve` (rq-20260908-028)

- **Date:** 2026-09-10
- **Agent:** kimi (orchestrator direct; executor phase in tmux `ao-uhp-gateway`)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/265 · merge commit `6b21256cb23f98ecb37d3c7131cb35a00226faa8`
- **Evidence:** `~/.agent-orchestrator/evidence/ao-uhp-gateway/`

## What landed

UHP (Universal Harness Protocol, spec dated 2026-08-11) core gateway support in the
ao runtime, vendored as `infrastructure/executor/uhp-gateway/` plus a new
`ao serve` subcommand in the `herdr` crate (binary `ao`):

- UHP 2026-08-11 core conformance: the vendored `protocol/conformance` suite runs
  against `ao serve` and reports **40/40 CONFORMANT** (`--class core`).
- `uhp-gateway` crate: **32/32 unit tests** (`cargo test -p uhp-gateway`).
- Gate 2 (live CLI turns): **kimi green** — stream/cancel/resume transcripts are
  real SSE with sequence numbers. claude/codex turns RED but environmental:
  claude OAuth token expired, codex usage limit until 2026-09-16. Both failures
  reproduced CLI-direct (independent of ao), documented in
  `docs/AO_UHP_GATEWAY_NOTES.md` in the PR.
- Flake claim verified in isolation: `config::io` 20/20, `detect::manifest` 59/59
  when run standalone.
- herdr diff confirmed additive-only: `ao/serve.rs` + one `cli.rs` match arm +
  help line + path dep. No behavioral change to existing commands.

## Orchestrator independent verification

I did not trust the executor's evidence. I booted `ao serve` myself on port 8421
with a mktemp data dir and re-ran `uhp-conformance --class core` → 40/40
CONFORMANT on the committed state.

## Incidents

- **GitHub Actions never created PR-event check suites** for #265 — the 161k-line
  vendored diff oversized the Actions payload. Closed/reopened the PR, pushed the
  gitleaksignore commit; only Cloudflare Pages/Vercel ran. Per the established
  merge rule (real checks green, Vercel rate-limit + Pages ignorable), real checks
  were substituted locally and the PR was merged. Push-to-main then DID fire
  gitleaks/test/validate-typography on `6b21256cb` — all **success**.
- **Gitleaks:** one vendored fixture
  (`vendor/harnessrouter-ce/gateway/tests/test_media_attack.py`, synthetic test
  key) flagged locally. Fingerprint added to `.gitleaksignore` (commit
  `ef232f828`); local `gitleaks git --log-opts origin/main..HEAD` clean.

## Honest deferrals

- Gate 2 claude/codex live turns deferred: re-run after user re-authenticates
  claude and the codex usage limit resets 2026-09-16. One-command repeat per
  `docs/AO_UHP_GATEWAY_NOTES.md`.
- Shared checkout was mid-branch (`desktop-icon-macos-a-only-cream-20260910`,
  another session); all main mutations went through a temp worktree
  (`git worktree add /tmp/allternit-main-sync main`).

## Ritual

Queue `rq-20260908-028` → `p6a_landed` (history entry with ts/event/by/note),
dashboard regenerated, brain pushed (`1d54742`), this ledger entry, worktree
`allternit-ao-uhp-gateway` removed, executor tmux session killed.
