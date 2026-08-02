# D3 SPIKE TASK — embedded git client in the iOS app

You are the executor. `.steering/spec.md` (R1–R3 + acceptance) is the source
of truth — read it fully, including the signing precondition, the
vendoring-vs-cross-compile distinction, and the R3 line-item requirements.
This is a SPIKE: prove feasibility + write the go/no-go report, not the
product feature.

## Environment facts (verified)

- xcodegen and Xcode 16.2 are installed (matches the project ceiling).
- ZERO valid codesigning identities on this machine — device builds will
  fail at signing. Attempt one, record it as its own line item, move on.
- iOS surface: surfaces/allternit-mobile/ios, XcodeGen project.yml, SwiftPM
  packages, Mesh.xcframework vendored pattern, DEBUG -skip-auth shim at
  App/AllternitApp.swift:79-86.
- There is NO XCTest target today — do not add one; the DEBUG screen is the
  proof surface (steering-confirmed as the right call).

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] is authoritative.
2. Done → the spike report `docs/BRAIN_D3_SPIKE.md` (per spec R3 line items)
   + `docs/BRAIN_D3_NOTES.md` with YAML frontmatter, then
   `touch docs/BRAIN_D3_NOTES.sentinel`.
3. Then commit: `git add surfaces docs .steering && git commit -m "spike(ios): embedded git client feasibility — clone/commit/push proof (D3 pre-phase)"`.
   A gate reviews; fix and retry if blocked.

## Build

1. Try SwiftGit2 first via project.yml packages (pin conservatively per the
   toolchain ceiling comments at project.yml:12-21). Regenerate with
   xcodegen. Record the exact outcome (works / fails + why).
2. If rejected: attempt sourcing a prebuilt libgit2.xcframework; if none,
   cross-compile per the spec's warning and RECORD the effort honestly.
   If cross-compiling exceeds a reasonable spike budget (say 2 hours),
   that's a legitimate spike finding — document it and do the proof with
   whatever did integrate.
3. DEBUG-only "Brain Spike" screen (Settings link or hidden flag; compile-
   gated per the -skip-auth precedent): remote URL field, token field,
   clone → append frontmatter page → commit → push buttons, log view.
4. Round trip proof: HTTPS+token against the dev API if reachable
   (localhost:8013; D2's git endpoints may not exist yet — if 404, use any
   reachable HTTPS git remote you can create locally, e.g. `git daemon` or
   a local smart-HTTP server, still exercising TLS-less HTTP+Basic if TLS
   is unavailable, and SAY EXACTLY what was and wasn't proven). file://
   round trip as the offline supplement.
5. Write docs/BRAIN_D3_SPIKE.md with the R3 line items (a-d) + D3-R1/R2
   cost estimate.

## Constraints

- project.yml + xcodegen only; no manual xcodeproj edits.
- Nothing in release builds; no changes to production flows.
- `xcodebuild -sdk iphonesimulator` build must pass for the app target
  (record the command + result in NOTES).
