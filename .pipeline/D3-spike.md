# Steering spec — D3 spike: embedded git client in the iOS app

<!-- From .pipeline/TRACK-D-brain-onboarding.md D3 pre-phase. iOS recon done:
     surfaces/allternit-mobile/ios, XcodeGen project.yml, SwiftPM, no git
     library today, no test target today, Mesh.xcframework proves the
     vendored-xcframework pattern, toolchain ceiling Xcode 16.2/Swift 6.0. -->

## Context

The iOS app (surfaces/allternit-mobile/ios) has no git client and cannot
shell out (App Store sandboxing). Before D3's product features (brain
creation in onboarding, offline-queued capture) can be built, we need proof
that an embedded git client works in this codebase and toolchain. This is a
spike: go/no-go + minimal proof, not the product feature.

## Requirements

- [ ] R1: WHEN the spike integrates a git library, THE SYSTEM SHALL add
  SwiftGit2 (or, if the toolchain rejects it, a libgit2.xcframework vendored
  under Frameworks/ following the Mesh.xcframework pattern) via XcodeGen
  `project.yml` + regeneration — and the app SHALL compile for the simulator
  target. Device (arm64) builds REQUIRE a configured Apple Developer team
  (`DEVELOPMENT_TEAM` is a placeholder today and this machine has zero valid
  codesigning identities — a user-level precondition, NOT a git-library
  problem): attempt the device build, and if signing blocks it, record it as
  its own go/no-go line item rather than debugging it as a library issue.
  Vendoring vs building: if a prebuilt libgit2.xcframework cannot be
  sourced, cross-compiling libgit2 from source (+ transitive
  libssh2/OpenSSL or mbedTLS, statically linked, for arm64-ios and
  arm64/x86_64-simulator) is a SUBSTANTIALLY bigger sub-task — the report
  MUST cost-estimate whichever path was actually needed. Note: SwiftGit2
  wraps libgit2 as a C target via SPM, a historical source of
  binary-target/link friction (openssl/libssh2) independent of the
  swift-tools ceiling — "SwiftGit2 rejected" is a plausible outcome, not a
  surprise.
- [ ] R2: WHEN the spike proves the flow, THE SYSTEM SHALL include a
  debug-gated "Brain Spike" screen (DEBUG builds only, linked from Settings
  or a hidden onboarding flag) that can: clone a brain repo over HTTPS with
  token auth (Basic, `allternit_git_` token), append a markdown page with
  frontmatter, commit it, and push — against the dev API (127.0.0.1:8013) or
  a configurable remote URL.
- [ ] R3: WHEN the spike concludes, THE SYSTEM SHALL produce a go/no-go
  report (docs/BRAIN_D3_SPIKE.md) with SEPARATE line items for: (a) the
  HTTPS+token path (Basic auth with an `allternit_git_` token — the
  product-relevant case; file:// success does NOT count as proof here),
  (b) the file:// offline path, (c) device-build signing status, and (d)
  library choice + toolchain issues + build size; plus a concrete cost
  estimate for D3-R1/R2 as spec'd in TRACK-D.

## Out of scope

- Onboarding UI changes (D3-R1), capture queue (D3-R2), any production UI,
  TestFlight/App Store concerns.

## Acceptance (Gherkin)

- Scenario: clone-commit-push round trip
  Given a brain repo served by the dev platform (or a local bare repo over
  file:// for offline proof)
  When the spike screen runs clone → append page → commit → push
  Then the remote contains the new commit with the page, verified by a
  second clone or git log on the remote.
- Scenario: toolchain reality documented
  Given the spike attempted SwiftGit2 first
  When the report is written
  Then it records the exact failure mode if SwiftGit2 was rejected (or its
  success), and the final library + slices shipped.

## Constraints

- XcodeGen only — project.yml edited, project regenerated; no manual Xcode
  project edits.
- DEBUG gating: the spike screen must not appear in release builds
  (copy the compile-time-gated precedent at App/AllternitApp.swift:79-86).
- No changes to production flows (auth, onboarding, chat).
