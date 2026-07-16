# Miniapps Marketplace — Security Review (M14)

Date: 2026-07-15
Reviewer: Kimi Code CLI (automated implementation + review under Eoj's handoff)
Scope: the miniapps marketplace, desktop runtime, and registry work described in
the production handoff (milestones M1–M13). Milestone M15 (production rollout)
is Eoj's operational step and is explicitly out of scope here.

## Verification method — read this first

Workspace policy forbade builds, typechecks, dev servers, and vitest during
this work. Everything below was therefore verified with:

- **Plain-Node behavioral suites** (`scripts/marketplace-verify/run-all.mjs`):
  12 suites, **111 checks, 0 failures**. Node ≥ 22 strips TypeScript types
  natively; a local shim replaces vitest and an Electron stub replaces the
  `electron` module. The shim throws on unsupported matchers — no silent skips.
- **Intake worker end-to-end smoke** (`worker-smoke.mjs`): **11 checks**,
  including a real HTTP fake registry and cross-implementation signature
  checks.
- **rustfmt parse/format checks** on every registry Rust source file: clean.
- **Live-PostgreSQL smoke** (`scripts/sql-smoke.sh`): the real migrations are
  applied to a scratch database and the constraints, triggers, queue query,
  key rules, kill switches, and full-text search are exercised with real SQL.
- `scripts/marketplace-verify/verify.sh` runs all four batteries and prints
  `ALL MARKETPLACE VERIFICATION PASSED` (current status: PASS).

What this does **not** cover is listed honestly in §4.

## 1. Handoff security invariants → implementation → evidence

### 1.1 "Never execute unapproved commands"

- Desktop command runtimes start only through the approval gate:
  `surfaces/allternit-desktop/src/main/mini-apps-manager.ts:101` (approval
  lookup + fingerprint match) and `:172` (`reviewAndApproveMiniApp`, native
  dialog listing install/start/stop commands, network, filesystem, secrets,
  process permission).
- Approvals are SHA-256 fingerprints over the full registration
  (`mini-apps-manager.ts:62`) persisted mode-0600 (`:78`).
- Evidence: `mini-apps-manager.test.ts` (3 checks), `mini-app-approvals.test.ts`
  (6 checks: fingerprint stability, invalidation on command change, on
  permission change, on added OAuth provider, persistence, tampered store).

### 1.2 "Never expose secret values through IPC"

- `mini-app-secrets.ts`: values encrypted with Electron `safeStorage`,
  per-miniapp isolation, renderer can only set/list-names/delete
  (`:25,:44,:63`); decryption happens only in the main process and only for
  explicitly requested names at process spawn (`:48`).
- Evidence: `mini-app-secrets.test.ts` (8 checks, incl. damaged-ciphertext
  rejection and name-scoping).

### 1.3 "Never place secrets in manifests or local storage"

- The manifest contract carries only secret **names** (`permissions.secrets`),
  never values; values exist solely in the safeStorage-backed main-process
  store, and removing a runtime deletes its secrets
  (`mini-app-secrets.ts:59`).
- The desktop approval dialog displays the required secret names so missing
  secrets block runtime start rather than failing silently.
- Evidence: secrets suite + manager suite (removal wipes secrets).

### 1.4 "Never trust registry 'verified' status without signature verification"

- Client verifies Ed25519 signatures itself:
  `surfaces/ai.allternit.com/src/views/aci/mini-app-manifest.ts:59`
  (`verifyMiniAppManifestSignature`), over the canonical serialization
  (`:48`). Verified listings require `release.signature` +
  `release.publisherKey`.
- Desktop installer re-verifies before install:
  `mini-app-release-installer.ts:181` (`verifyManifestSignature`).
- The signing payload **includes `release.publisherKey`** (verifiers strip
  only `signature`) — a key-substitution hole found and fixed during M11.
- Evidence: `mini-app-signing.test.ts` (5 checks), worker smoke checks
  3–7 (desktop signer ↔ worker verifier ↔ node:crypto RFC 8032 agreement,
  tamper rejection).

### 1.5 "Never install unverified archives globally"

- Registry releases install only via `installReleaseFromRegistry`
  (`mini-app-release-installer.ts:594`): download to quarantine → SHA-256 →
  publisher signature → traversal-safe extract → per-version immutable
  directory `miniapps/<publisher.app>/versions/<version>/` → health check →
  atomic `current` switch (`:578`) → previous healthy version preserved,
  automatic rollback (`:722`).
- Nothing is ever written outside the per-app directory; no global installs.
- Evidence: `mini-app-release-installer.test.ts` (15 checks: checksum
  mismatch, bad signature, traversal archive, symlink escape, failed health
  rollback, atomic switch, uninstall).

### 1.6 "Never extract archives without traversal protection"

- `validateArchiveEntries` (`mini-app-release-installer.ts:311`) rejects
  absolute paths, `..` segments, and NUL bytes before extraction;
  `validateExtractedTree` (`:337`) rejects symlink/hardlink escapes after
  extraction.
- Evidence: release-installer suite (archive traversal + symlink escape
  checks).

### 1.7 "Never allow changed permissions under an old approval fingerprint"

- The fingerprint covers commands **and** permissions **and** OAuth provider
  declarations (`mini-apps-manager.ts:62`; comment at `:51`). Any change →
  fingerprint mismatch → fresh native approval dialog; network host-list
  changes also re-trigger approval before the policy proxy will serve them.
- Evidence: `mini-app-approvals.test.ts` (invalidation vectors).

### 1.8 "Never run community commands without an enforceable sandbox"

- Fail-closed sandbox selection: `mini-app-sandbox.ts:293` (`sandboxCommand`)
  returns an error on unsupported platforms instead of running unsandboxed;
  helper validation at `:262`.
- macOS: generated `sandbox-exec` seatbelt profiles (`:179`); Linux:
  Bubblewrap + optional systemd resource limits (`:224,:239`); Windows:
  contract-only adapter (`mini-app-sandbox-windows.ts`) that currently fails
  closed — there is no Windows enforcement yet.
- Evidence: `mini-app-sandbox.test.ts` (15), `mini-app-sandbox-windows.test.ts`
  (10, incl. fail-closed behavior).

### 1.9 "Never run marketplace scanning on the registry host"

- The registry never executes packages; it only hands out intake job
  descriptors (`POST /v1/intake/jobs/claim`) and records stage results.
- The reference worker (`services/registry/intake-worker/worker.mjs`) runs
  only pure local validation; the remaining nine stages are reported as
  fail-closed `implemented:false` until real isolated scanners are deployed
  (disposable VMs/containers per the handoff). Staging README documents this
  prominently.
- Evidence: worker smoke e2e (11 checks: 2 real stages pass, 9 closed
  failures, tampered signature rejected).

### 1.10 "Never mark an app verified without immutable review evidence"

- One immutable row per (miniapp, version); a database trigger rejects
  identity/manifest mutation
  (`migrations/20260715000001_miniapps.sql:62,68`).
- Reviews are separate rows carrying actor + timestamps; approval requires
  (a) the version's signing key ACTIVE for that publisher and (b) with
  `MINIAPP_INTAKE_ENFORCE=1`, the full 11-stage pipeline reporting
  `awaiting_review`.
- Kill switches: `migrations/20260715000004_admin.sql` (`kill_switches` +
  append-only `kill_switch_events`), enforced in listing and release routes.
- Evidence: live-PG SQL smoke (immutability trigger, review transactions,
  key-active rule, kill-switch behavior).

### 1.11 "Never silently expand filesystem, network, OAuth, or secret permissions"

- All four are fingerprint inputs (see 1.7), so any expansion forces
  re-approval.
- Network: per-hostname enforcement via the policy proxy
  (`mini-app-policy-proxy.ts:129` `classifyTarget`, `:166` proxy startup):
  allowlist check, redirect re-check, DNS-rebinding defense rejecting
  private/reserved resolutions (`:99,:202`), localhost ports handled
  separately, denied/allowed logging without authorization headers.
- OAuth: tokens injected only for providers declared in the manifest
  (`mini-app-oauth-inject.ts`), resolved in the main process
  (`mini-app-oauth-broker.ts`), prefixed `ALLTERNIT_OAUTH_TOKEN_`; the
  renderer never sees token values.
- Evidence: `mini-app-policy-proxy.test.ts` (11), approvals suite
  (oauth-add invalidation), OAuth broker suite (12), plus the M11 e2e
  (sandboxed child receives the token, no host-env leak).

## 2. Handoff remaining-work items — status

| Item | Status |
|---|---|
| 1. PostgreSQL persistence | Done (4 migrations, repository layer, cursor pagination, FTS) — PG-smoke verified |
| 2. Object storage | Done (quarantine + published buckets, content-addressed keys, presigned URLs) — rustfmt + API-shape verified; live S3 calls not exercised (§4) |
| 3. Package intake pipeline | Contract + enforcement done; reference worker does 2 real stages, 9 fail closed; real scanners not yet deployed (by design) |
| 4. Atomic versioned installation | Done, 15 node checks |
| 5. Platform sandboxing | macOS seatbelt + Linux Bubblewrap implemented; Windows is contract-only and fails closed; macOS hardening (signed helper, entitlements) still foundational per handoff |
| 6. Network policy proxy | Done, 11 node checks |
| 7. OAuth broker | Done (PKCE, single-use state, encrypted store, refresh, revocation, per-app injection); durable: broker suite 12 checks; ad-hoc during M11: 50 broker behavioral checks, 6/6 token-injection e2e |
| 8. Review administration | Done (queue, diff, scan tallies, SBOM/dependency data, signature status, approve/reject/request-changes/revoke/quarantine + kill switches); durable: review-diff suite 9 checks + PG smoke; ad-hoc: console hook smoke 12 |
| 9. Developer portal | Done (icon/screenshot upload, lint, permissions preview, key generation/import, manifest signing, submit + 11-stage tracking); durable: lint 11 + permissions-explain 6; ad-hoc during M11: 75 portal component checks; **private workspace publishing not implemented** (no workspace backend) |
| 10. Automated verification | Done at node level (§0); Playwright specs written but never run |
| 11. Staging deployment | Done on paper: compose + TLS + rate limits + backups + README; docker CLI unavailable here, so the stack has never been launched (§4) |
| 12. Security review | This document |
| 13. Production rollout | **Eoj's operational step** — not started, see §5 |

## 3. Known limitations and residual risks

1. **Windows community runtimes are unavailable** by fail-closed design until
   AppContainer/Job Objects/WFP enforcement is built. This is safe but a
   product gap.
2. **macOS sandbox is `sandbox-exec`-based**, which Apple considers
   deprecated for third parties. It is a foundation, not the final shipping
   boundary; the signed-helper + hardened-runtime work from the handoff is
   still open.
3. **Nine intake stages have no real scanner yet.** With
   `MINIAPP_INTAKE_ENFORCE=1` nothing can be approved (fail closed). With the
   staging hatch `MINIAPP_INTAKE_ENFORCE=0`, approvals are possible without
   pipeline evidence — any approval granted under the hatch must be treated
   as untrusted. Never set the hatch in production.
4. **GitHub repository ownership verification** is specified as the intake
   `repo_check` stage but has no implementation yet (the reference worker
   fails it closed).
5. **OAuth injection uses account id `default` only**; multi-account
   selection per connection is not wired into runtime start.
6. **Policy proxy coverage** depends on runtimes honoring proxy env vars;
   direct-connect bypass is blocked only where the sandbox also blocks
   direct egress (Linux Bubblewrap yes; macOS seatbelt profile yes for
   undeclared network; per-app direct-egress blocking on macOS is
   best-effort).
7. **Private workspace publishing** (handoff item 9) is unimplemented.
8. The marketplace client persists installed miniapps in renderer-accessible
   local storage; secrets never go there, but the install list itself is not
   integrity-protected.

## 4. Explicitly NOT verified

- `cargo build` / `cargo test` for the registry — never compiled in this
  workspace (policy). Rust is verified only by rustfmt parse/format and by
  exercising the exact SQL it runs against live PostgreSQL.
- `tsc` typechecks and `vitest` proper for both surfaces.
- The two Playwright specs (`surfaces/ai.allternit.com/tests/miniapps-marketplace.spec.ts`,
  `surfaces/ai.allternit.com/tests/miniapps-developer.spec.ts`) — written, never executed.
- Live AWS/SDK calls in `asset_store.rs` (presigning, bucket ops) — no S3 was
  reachable during verification; the SQL and HTTP shapes around it were.
- `docker compose up` of the staging stack — no docker CLI on this machine.
  Compose YAML, nginx.conf structure, shell script syntax, Dockerfile package
  names, and the worker were all statically verified.
- Real-provider OAuth flows (Google/GitHub/etc.) against live IdPs; broker
  logic is verified against a loopback fake IdP only.
- Browser rendering of the review console and publish modal (React views are
  node-smoke-tested at the hook/logic level, not rendered).

## 5. Gates before production rollout (M15, Eoj)

1. Eoj explicitly authorizes builds/tests; then run: `cargo test` (registry),
   `tsc` both surfaces, `vitest` full, both Playwright specs.
2. Deploy the nine real scanner stages as isolated workers; keep
   `MINIAPP_INTAKE_ENFORCE=1`.
3. Implement `repo_check` (GitHub ownership) or keep it failing closed.
4. Windows sandbox enforcement or keep Windows community runtimes disabled.
5. macOS signed helper + entitlements, or accept the seatbelt foundation as
   a documented risk for launch.
6. Launch the staging stack (`services/registry/deploy/staging/README.md`),
   restore-test a backup, rehearse the kill switch.
7. Add registry metrics + alerting before real traffic.
