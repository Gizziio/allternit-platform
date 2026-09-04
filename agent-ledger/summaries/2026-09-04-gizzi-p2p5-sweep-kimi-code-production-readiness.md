# gizzi-code production-readiness sweep — P2–P5 execution closeout (2026-09-04)

Session: gizzi-deploy-20260904 (orchestrator + parallel worktree agents)
Branch base: main @ 7476d5b2b → final merge HEAD: see "Final state" below.
Scope: every actionable item in reports/2026-09-03-production-readiness-gap-analysis.md
(P2–P6) in the allternit monorepo, plus corroboration addendum items.

## Verification standard

Every merge below was verified on composed main in the main checkout:
`bun run typecheck` (tsc --noEmit, sdk-dist preflight) exit 0, and
`bash script/ci-smoke-test.sh` SMOKE PASS with 0 failures. Final composed
state: see Final state.

## Merged work (chronological)

1. a1365a7fb — test: cron-automation + vault unit coverage (80 tests).
2. dee84e760 — test: sdk dist-staleness preflight (script/ensure-sdk-dist.sh,
   wired into typecheck/lint/ci-smoke) + migration-chain regression test.
3. fc42c0d20 — fix: one-shot commands force-exit after 100ms drain; denylist
   for long-lived commands (serve, web, acp, mcp serve, runtime daemon, TUI).
4. fb1b64f84 — chore: stripped @ts-nocheck from auth/server paths; CI ratchet
   (script/check-ts-nocheck.sh + baseline, continue-on-error until owner sets target).
5. 8ebc3c156 — fix: cron parser isValid/parseSchedule infinite recursion
   (stack overflow on any garbage input), validPattern char-class range bug,
   DOW comma lists in matchesDOW. +regression tests.
6. be43fed31 — feat: credential-store as the only token write path. macOS
   Keychain backend (distinct service suffix), marked 0600/0700 insecure
   fallback with one-time warning + deprecation log on Linux/Windows, inline
   api_key migration out of config.toml, central log redaction
   (src/shared/util/redact.ts) masking JWTs/sk-/Bearer/token= shapes.
7. 130f1f9e4 — feat: Windows honesty pass. Experimental labeling in README +
   runtime win32 stderr warning (GIZZI_WINDOWS_WARNING_DISABLED escape),
   marker-disciplined shell-rc uninstall (# gizzi-code begin/end), install.ps1
   audit (PATH exact match, ARM64 emulation notice, execution-policy error).
   Finding: no PowerShell $PROFILE edits existed in-repo; the corruption-risk
   path was bash/zsh/fish rc rewriting.
8. 409b295a0 — feat: telemetry governance. Field-level payload inventory;
   leaks fixed (oauth error bodies, keychain error strings, BashTool absolute
   command paths); GIZZI_TELEMETRY=off canonical opt-out + settings flag +
   `gizzi config telemetry`; first-run stderr notice; upstream Datadog sink
   disabled by default; docs/telemetry.md.
9. 6164b96a2 — fix: apiFetch default 15s AbortSignal deadline (caller signal
   wins); railsPeer heartbeat 10s deadline. +tests.
10. f9b816006 — test: unskip 182 skipped tests (224 → 42 skips; 965 → 1146
    passing). Remaining 42 documented with inline reasons. Bugs reported (not
    fixed per task scope): permission ask/reply race in
    tools/guard/permission/next.ts, Bun.which PATH snapshot, dead
    tools/mcp-servers/superpowers reference.
11. 4eb73b476 — feat: stub removal + plugin unification. 8 stub media drivers
    deleted (5 real kept), dead bundledSkills shim tree deleted (live ink-app
    implementation untouched), `gizzi debug` shadow-stub fixed (index.ts now
    re-exports real DebugCommand), channelAllowlist malformed-payload
    validation now loud. Plugin canonical path ~/.gizzi/plugins with read-only
    ~/.claude legacy fallback + migration; upstream marketplace blocked with
    coming-soon (GIZZI_ENABLE_UPSTREAM_MARKETPLACE escape hatch).
12. 7201b9f38 — fix: instance-registration full-suite flake (module-load
    freeze of GIZZI_REGISTER_INTERVAL_MS; poll-based test waits).
13. c9dee83fd — fix: web/serve auth parity (alt_ token validation via
    POST /api/v1/auth/validate with 60s cache, fail-closed), CORS hardening
    (ACAO:* removed, GIZZI_DEV_CORS gated, self-hosted-runner health binds
    127.0.0.1), empty-catch audit (~40 justified, 3 security-relevant
    upgraded to logging), execa ESM named-import fix (fresh pnpm install was
    broken — link-time failure on execa default import). +17 middleware tests.
14. 832d0c29f — chore: 2,297 dead files deleted via import-graph analysis
    (−389,822 lines; src 6,045 → 3,748 files; tsc program −36%), 8 evidence
    batches, dead-code guard test + manifest. The "2,732-file ink-app mirror"
    audit premise was corrected: ink-app is the LIVE TUI; the dead code was
    legacy root/cli strata.
15. c8f75fb18 — merge rescue: restored live debug command subtree + deps that
    the collapse had deleted as unreachable (stubs merge had just wired it
    into main.ts), re-homed `gizzi plugin migrate` onto the live
    PluginCommand.

16. fd333fdeb — feat: shell completions generated from the live yargs
    registry (no hand-maintained drift), plus production-build fix (stale
    telemetryRedact import in ink-app sink.ts).
17. 0c522579e — feat: UX pass — first-run onboarding wizard, `gizzi doctor`
    v2, `gizzi uninstall` v2, cron daemon supervision.
18. f910797cf — feat: rebrand completion — sk-ant-cc- session-token minting
    eliminated (0 remaining; `gizzi_` prefix via mintGizziSessionToken),
    @anthropic-ai/gizzi refs swept, CLAUDE_CODE_ env dual-naming triaged
    (893 → 802 refs, migration guide in docs/UPSTREAM_COMPAT.md) +
    legal/attribution audit (docs/legal-attribution.md). Merge resolved 44
    delete/update conflicts by accepting inkapp-collapse deletions
    (reachability-verified).

## Items in flight at closeout

None — all three agent tracks (perf, ux, rebrand) landed and were verified
on composed main.

## Blocked — owner-only (code complete where applicable)

- TS_AUTHKEY secret + cloud-api CI path dependency (deploy is owner-sequenced
  via scripts/deploy-contabo.sh).
- **CRITICAL deploy sequencing:** do NOT deploy the cloud-api build until the
  iOS client ships Clerk/alt_ auth; existing md5-hashed api_tokens must be
  re-minted (now sha256) in the same window.
- Secrets rotation: Clerk sk_test revocation, ProtonMail TOTP, TESTING.md
  Clerk password.
- Backend B hostname/DNS decision (memo: reports/2026-09-04-backend-b-deploy-decision.md,
  recommends allternit-api behind gateway.allternit.com).
- 3dfacility.allternit.com deploy-or-kill (site source committed; DNS+Pages
  = owner).
- macOS signing/notarization certificate lead time (start immediately).
- Hosted-runtime asset re-pin + sha256 in cloud-api on release (Rust owner).
- OAuth console login: CLI flow is client-complete but the server half
  (authorize/token/create_api_key endpoints for the CLI client) is not
  implemented in cloud-api or any deployed surface. `gizzi login` (API key)
  is the supported auth path until then.
- install.gizziio.com deploy (unified installers committed in Websites repo
  3490d14c, NOT pushed/deployed).
- Web-surface security headers / debug-route gating / ErrorBoundary (deployed
  sites — needs Websites-repo + Cloudflare access).
- Infra: off-host PG backups, restore drill, Incus 8443, clerk-proxy CORS
  (server access).
- Repo extraction to Gizziio/gizzi-code (P6): recommend post-launch; high
  blast radius pre-launch.

## Pre-existing failures NOT caused by this sweep

- 1 docker-binary lib test, 32 sqlite-on-pg integration harness tests
  (harness needs rebuild on migrations_pg).

## Non-blocking findings for follow-up

- Production artifact is 171.9 MiB vs the <100 MB target — structural
  bundle work (dead deps, code splitting); documented, not launch-blocking.
- docs.gizziio.com font/docs polish lives in the Allternit Websites repo,
  out of scope for this monorepo pass.

## Final state

Composed main HEAD: **f910797cf** (rebrand merge, final of 18 merges this
session). Verified on composed main: `bun run typecheck` exit 0 (sdk-dist
preflight included) and `bash script/ci-smoke-test.sh` → **SMOKE PASS: 103
entries green, 1,308 tests across 103 files, 0 failures**. Branch state:
all session/gizzi-* branches merged into main; worktrees cleaned up
per AGENTS.md ritual.
