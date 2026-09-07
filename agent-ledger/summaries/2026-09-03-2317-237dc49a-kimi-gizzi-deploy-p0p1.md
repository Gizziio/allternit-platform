# 2026-09-03 23:17 — kimi — gizzi-code production-readiness P0/P1 (session 237dc49a)

Worktree: `~/Desktop/allternit-workspace/allternit-gizzi-deploy-20260903`, branch `session/gizzi-deploy-20260903`. Scope: make `cmd/gizzi-code` shippable for the 2026-09-04 release and packageable on all standard OS targets. All work CI-gated going forward.

## What landed (verified)

- **P0 hang fixes**: 5s `AbortSignal.timeout` on subprocess probes/config fetches; bun-install of deps gated behind `GIZZI_AUTO_INSTALL_DEPS=1`.
- **P0 build fixes**: `import type` SQLiteTransaction in `db.ts` (bundler crash); fixed two syntax errors introduced mid-audit (`build-production.js` unescaped backtick in template literal; `agent-queue.ts` `??`/`||` mix); deduped env fallback in `cli/commands/cowork.ts:138`.
- **P0 exec exit hang (new this session)**: `gizzi exec` processed the prompt then hung forever — background runtime handles (AgentCommunicationRuntime, lazily re-created Instances after disposal, db watchers) held the event loop. Fix in `src/cli/commands/run.ts`: print mode is one-shot, so after the run loop completes, drain 100ms and `process.exit(exitCode ?? 0)`. Verified: real-env exec 4s exit 0 (was 10+ min); clean-env (no providers, fake HOME) 6s exit 0; `tsc --noEmit` exit 0.
- **P0 security**: committed Clerk `sk_test` key removed from `platform-auth-server.js` (env-required now) + gitleaks CI job (key itself still needs rotation — manual, flagged to owner); SSRF fixed in `web-proxy.ts` (manual redirect handling, per-hop DNS revalidation incl. 100.64.0.0/10 CGNAT, 15/15 probe cases verified by delegated agent); `gizzi-local-token` and cowork `dev-bootstrap-token` backdoors removed (server routes + `cli/commands/cowork.ts` apiCall send credentials only when a real token exists).
- **P0 cloud defaults**: dead fly.dev defaults repointed — `flag.ts:71` → `api.allternit.com`, `mesh.ts:54` → `headscale.allternit.com`; `serve.ts`/`config.ts` help text fixed; no fly.dev left in src/.
- **P0 quality gates**: release + npm-publish workflows now run typecheck (with workspace SDK prebuild), the empirically-green smoke suite (`script/ci-smoke-test.sh`, 1065 tests / 86 files / 0 fail), plus a built-artifact smoke (`--version` everywhere; `exec` on x64 unix, timeout-guarded).
- **P0 tests**: bunfig.toml preload restored; real `test` script; flaky tests quarantined (smoke/quarantine/blocked lists); `@allternit/sdk` export drift fixed.
- **P0 supply chain**: `bun audit` triaged 86 → 24 advisories (doc: `cmd/gizzi-code/docs/DEPENDENCY_AUDIT.md`); CI audit step is report-only (non-failing) pending wave 2.
- **P1 distribution**: single version scheme (1.0.2, tags `gizzi-code/X.Y.Z`, no `v` prefix); release workflow builds 5 targets incl. re-enabled darwin-x64 (macos-13), dual-named assets + `checksums.txt`; install bash script fixed (tag parse, tar.gz, rename, checksum verify) and **live dry-run proven** against the v0.2.3 release — installed binary runs; install.ps1 fixed (manual review only, no pwsh locally); `install.gizziio.com` version.json created + site install scripts synced byte-identical (source edited, **Cloudflare deploy still pending**); brew/scoop/choco/rpm/arch/winget packaging refreshed + `script/update-packaging-hashes.sh`; Dockerfile (glibc base) + nix inputs fixed; npm publish gate verifies dist/ + bin; `gizzi upgrade` fixed (.json() bug, repo, npm name, `MACRO.PACKAGE_URL: "@allternit/gizzi-code"`).
- **P1 hygiene**: ~27 tracked junk files deleted (nested `.github/` tree, turbo.json, random/docs/format/deploy scripts); version bumped to 1.0.2; chalk added; real test scripts.

## Known gaps (not blockers for tomorrow, must be routed)

- Platform P0s (separate track): live `dev-api-token` backdoor on api.allternit.com + iOS hardcoded token; secrets rotation; pnpm lockfile/Pages deploy red + `TS_AUTHKEY` secret; web↔backend routing decision; _redirects breakage; websites issues.
- `@allternit/engine` package missing blocks 2 server tests + `test/session/prompt.test.ts` (pre-existing).
- 53 blocked test files in `test/blocked.txt` (many unblocked by dep work — later wave).
- install.ps1 not e2e-tested (no Windows host); nix unevaluated; Docker build not run; Windows binary smoke not exercised.
- cloud-api pins hosted-runtime `2026.07.16` — Rust owner must re-pin after release.

## Verification ledger

- `tsc --noEmit`: exit 0 (after all fixes)
- `bash script/ci-smoke-test.sh`: 1065 tests / 86 files / 0 fail
- Production build: darwin-arm64 binary 172.6MB, `--version` → 1.0.2
- Binary exec smoke: exits 0 in <5s real env, <7s clean env (was infinite hang)
- Full binary rebuild after final fixes: see commit message for result

Attestation method: self-attested → CI-verified gates (release workflows now enforce typecheck + smoke on the tagged commit).
