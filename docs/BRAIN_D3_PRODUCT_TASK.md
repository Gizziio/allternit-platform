# D3 PRODUCT TASK — iOS brain creation + offline capture

You are the executor. `.steering/spec.md` (D3-R1/R2 + acceptance) is the
source of truth. The spike is DONE and GO: `docs/BRAIN_D3_SPIKE.md` has the
library, the DEBUG proof screen, and every caveat — read it first. The spike's
git wrapper is your foundation; productize it.

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] authoritative.
2. Done → `docs/BRAIN_D3_PRODUCT_NOTES.md` with YAML frontmatter, then
   `touch docs/BRAIN_D3_PRODUCT_NOTES.sentinel`.
3. Then commit: `git add surfaces docs .steering && git commit -m "feat(ios): onboarding brain creation + offline capture queue (D3)"`.
   A gate reviews; fix and retry if blocked.

## Build

1. **Brain creation in onboarding (D3-R1)**: insert a brain step into
   Features/Onboarding/OnboardingView.swift before the all-set page (recon:
   4-page flow, page advance at :416, single exit OnboardingStore.complete()
   at :87). One tap: call POST /api/v1/brains via a new
   Core/API/BrainsClient.swift (follow APIClient.swift per-domain client
   conventions; Clerk auth is automatic), then clone the canonical structure
   on-device via the spike's git wrapper into app documents. Skip option must
   exist (brain is offered, never forced).
2. **Capture (D3-R2)**: a capture entry point (new brain section or +
   action — follow the app's conventions for quick actions): text → append
   as frontmatter page under ideas/ (type: idea or pain, status: new) →
   commit locally → push in background. Offline: queue the push (persist the
   pending state), retry on connectivity (watch for the app's existing
   reachability/store patterns; if none, a simple retry-on-foreground timer).
3. **Keep DEBUG gating**: the spike screen stays DEBUG-only; the new product
   paths must NOT require DEBUG flags.
4. **Verification**: xcodebuild -sdk iphonesimulator build passes (record
   command + result). No XCTest target exists — cover the capture-queue and
   frontmatter logic as pure Swift helpers if a cheap harness exists, else
   document manual verification steps in NOTES exactly.
5. `init --remote` on the CLI side (D1) pointed at POST /api/v1/brains —
   smoke-test the real round trip if the dev API is up (localhost:8013),
   else document.

## Constraints

- Follow the iOS surface conventions from the spike recon (XcodeGen
  project.yml for any file additions — regenerate; Swift 6.0 / iOS 17 /
  Xcode 16.2 ceiling).
- No release-build impact beyond the two features; no TestFlight/App Store
  concerns.
- Reuse the spike's git wrapper — do not swap libraries.
