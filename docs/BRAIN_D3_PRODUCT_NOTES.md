---
status: done
files_changed:
  - surfaces/allternit-mobile/ios/Core/API/BrainsClient.swift
  - surfaces/allternit-mobile/ios/Core/Auth/KeychainHelper.swift
  - surfaces/allternit-mobile/ios/Core/Brain/BrainGitClient.swift
  - surfaces/allternit-mobile/ios/Core/Brain/BrainPage.swift
  - surfaces/allternit-mobile/ios/Core/Brain/BrainStore.swift
  - surfaces/allternit-mobile/ios/Core/Brain/BrainTemplates.swift
  - surfaces/allternit-mobile/ios/Features/Brain/BrainCaptureSheet.swift
  - surfaces/allternit-mobile/ios/Features/Onboarding/OnboardingView.swift
  - surfaces/allternit-mobile/ios/Features/Chat/Views/ComposerPlusSheet.swift
  - surfaces/allternit-mobile/ios/Core/AppConfig.swift
  - surfaces/allternit-mobile/ios/Allternit.xcodeproj/project.pbxproj
  - cmd/allternit-api/src/brain_routes.rs
  - .steering/spec.md
  - .steering/checkpoint.md
  - docs/BRAIN_D3_PRODUCT_NOTES.md
tests_green: true
deviations:
  - "The prescribed `git add surfaces docs .steering` is extended with
    `cmd/`: live D3 verification exposed a real D2/libgit2 interop bug in
    cmd/allternit-api/src/brain_routes.rs (401 with a non-empty keep-alive
    body breaks libgit2 1.3's http-parser — the exact case the spike
    report flagged). Fixed server-side: empty 401 body + Connection:
    close. cargo test -p allternit-api --lib: 113/113."
  - ".steering/spec.md was repaired before implementation per steering
    review: removed a duplicated Constraints block, added the missing
    '## Acceptance (Gherkin)' header and a D3-R1 acceptance scenario."
  - "D1 `init --remote` smoke test NOT executed: dev API on
    localhost:8013 is down (connection refused). Instead the D3 iOS side
    was live-verified against THIS repo's allternit-api built and run on
    a throwaway port/data dir (see Live verification below) — a stronger
    proof of the same POST /api/v1/brains contract the CLI calls."
---

# D3 PRODUCT NOTES — iOS onboarding brain creation + offline capture queue

Task: `docs/BRAIN_D3_PRODUCT_TASK.md` · Spec: `.steering/spec.md` (D3-R1/R2)
· Foundation: `docs/BRAIN_D3_SPIKE.md` (verdict GO).

## What shipped

**D3-R1 — brain creation in onboarding.** The flow is now 5 pages; page 4
("Your second brain") sits between starter tasks and all-set
(`Features/Onboarding/OnboardingView.swift`). One tap on "Create my brain"
runs `BrainStore.createBrain()`: `POST /api/v1/brains` → `POST
/api/v1/tokens/git` (new `Core/API/BrainsClient.swift`, APIClient
conventions, Clerk Bearer automatic) → clone the (empty) hosted remote with
libgit2 into `<Documents>/brain` → write the 7 canonical files
(`Core/Brain/BrainTemplates.swift`, exact replica of gizzi-code
`brain/lib.ts` layout v1) → commit "Initialize second brain (iOS
onboarding)" → push. "Skip for now" always advances without creating
anything (no repo, no metadata left behind); failures clean up fully and
surface an inline error with retry. Skip affordance extended to pages 2-4.

**D3-R2 — capture + offline queue.** "Capture to brain" row in the composer
"+" sheet (`ComposerPlusSheet.swift`, visible only when a brain exists) →
`Features/Brain/BrainCaptureSheet.swift` (TextEditor + Idea/Pain picker) →
`BrainStore.capture()` appends `ideas/<slug>-<yyyyMMdd-HHmmss>.md` with
frontmatter `type: idea|pain, status: new, domain: meta, created:`
(`Core/Brain/BrainPage.swift`), commits locally FIRST (capture succeeds
offline), then pushes best-effort. The offline queue is a persisted
`pendingPush` flag (UserDefaults) — commits are durable in git, push is
idempotent, pages are never re-created, so retries cannot duplicate
(acceptance scenario). Retry on every foregrounding
(`UIApplication.willEnterForegroundNotification`) plus once at launch; the
capture row's subtitle shows "Waiting to sync" while queued.

**Git layer.** `Core/Brain/BrainGitClient.swift` — the spike wrapper
productized: typed `BrainGitError` (carries `git_error_last`), throwing
async API, serial queue, `@unchecked Sendable`, NOT DEBUG-gated. Clone of
the empty remote works (unborn HEAD); an `initRepoWithOrigin` fallback
exists but an auth-failure gate rethrows 401/credential errors so they can
never be masked as success. The spike screen and its file stay `#if DEBUG`
untouched; no product path requires a DEBUG flag.

**Token storage.** The `allternit_git_` plaintext (shown once at mint) lives
in the Keychain (new minimal `Core/Auth/KeychainHelper.swift`); brain id /
clone URL / pending-push flag stay in UserDefaults (non-secret).

## Verification

- Build (exact command, run by parent agent on the final tree):
  `cd surfaces/allternit-mobile/ios && xcodebuild -project Allternit.xcodeproj
  -scheme Allternit -sdk iphonesimulator -destination 'generic/platform=iOS
  Simulator' -configuration Debug build` → **BUILD SUCCEEDED**.
  Release configuration also BUILD SUCCEEDED (run by the implementing agent
  after ungating a diagnostics helper).
- API side: `cargo test -p allternit-api --lib brain_routes` → 9/9 pass
  (re-run by parent); full `--lib` 113/113 (implementing agent).
- Pure helpers (no XCTest target exists): `BrainPage.swift` is
  Foundation-only; harness = `swiftc -o t main.swift
  surfaces/allternit-mobile/ios/Core/Brain/BrainPage.swift && ./t` with
  asserts over slugify/ideaPage (filename shape, frontmatter fields,
  trailing newline, idea+pain) → 13/13 PASS (re-run by parent; harness was
  in /tmp, not committed).
- **Live E2E (implementing agent):** built this repo's allternit-api
  (`cargo build -p allternit-api`), ran it with
  `ALLTERNIT_DATA_DIR=$(mktemp -d) ALLTERNIT_API_PORT=8098
  ALLTERNIT_DESKTOP_ACCESS_TOKEN=dev ./target/debug/allternit-api`, drove
  the booted simulator with `-skip-auth -api-url http://127.0.0.1:8098/api/v1
  -brain-create-auto` (new DEBUG args; result JSON in the app container):
  createBrain ok=true, pending-push=0, and **local git log == remote
  bare-repo git log** (`ffba6fa4` "Initialize second brain (iOS
  onboarding)") — the D3-R1 acceptance proof. A `-brain-corrupt-token` run
  proved auth failures surface and leave nothing behind. A kill/relaunch
  proved the Keychain token + pending flag retry a failed push to success.
- **Interop bug found by live verification (fixed):** D2's
  `git_auth_failure()` sent a 401 with a body over keep-alive; libgit2
  1.3's http-parser doesn't drain it and fails the push with "http parser
  error: invalid constant string" — exactly the spike's predicted caveat.
  `brain_routes.rs` now returns an empty 401 body + `Connection: close`.

## Manual verification steps (simulator)

1. Fresh install (or `-reset-onboarding`), sign in (or `-skip-auth` with
   the dev API running), walk onboarding to page 4 → "Create my brain" →
   lands on all-set; `xcrun simctl get_app_container booted
   com.allternit.mobile data` → `Documents/brain` exists with the 7
   canonical files; `git -C <container>/Documents/brain log --oneline`
   shows the init commit (and it equals the remote's).
2. Re-run onboarding with `-onboarding-page 4` → "Skip for now" → no
   `Documents/brain` directory is created.
3. Capture: composer "+" → "Capture to brain" → write a note, pick
   Idea/Pain, Save → `git -C …/brain log --oneline` shows
   `capture: idea|pain <slug>`; the page sits under `ideas/` with
   `status: new`.
4. Offline queue: enable airplane mode (or stop the API), capture → commit
   exists locally, row shows "Waiting to sync"; restore connectivity and
   foreground the app → push succeeds, indicator clears, remote `git log`
   gains exactly one commit (no duplicates).

## Caveats / follow-ups

- libgit2 stays at 1.3.1 (spike caveat accepted by steering — with the 401
  fix it is fully functional against D2); rebuilding 1.9.x with the same
  vendoring scripts remains optional future work.
- BrainCaptureSheet UI itself was verified manually only; a
  `-brain-capture-auto` DEBUG arg (same pattern as `-brain-create-auto`)
  would automate it.
- The corrupt-token test leaves a stray empty provisioned brain server-side
  (provision precedes token use) — cosmetic, per-user isolated.
- Brain section/management UI beyond capture (view pages, re-provision a
  skipped brain) is intentionally out of scope — M4 covers the web surface.
