# D3 SPIKE REPORT — embedded git client in the iOS app

**Date:** 2026-08-02 · **Verdict: GO** · Spec: `.steering/spec.md` (R1–R3) · Task: `docs/D3_SPIKE_TASK.md`

An embedded git client works in this codebase and toolchain. The DEBUG-only
"Brain Spike" screen cloned, appended a frontmatter page, committed, and
pushed from the iOS simulator over **HTTP + Basic (`allternit_git_` token)**,
over **file://**, and cloned a public repo over **HTTPS/TLS** — all verified
externally (`git log` on the remote + a second clone). Device builds are
blocked by **code signing only**, a pre-existing user-level precondition,
not a git-library problem.

## R3 line items

### (a) HTTPS + token path (product-relevant case) — **PROVEN (with one honest caveat)**

- **Proven:** full clone → append frontmatter page → commit → push over
  smart-HTTP with Basic auth, username `allternit`, password
  `allternit_git_spike_token_123` — libgit2's userpass-plaintext credential
  callback, the exact shape an `allternit_git_` token will take. Verified by
  `git log` on the serving bare repo (commit `ce1e881` containing
  `pages/spike-…​.md` with YAML frontmatter) **and** by a second clone
  seeing the page.
- **Proven (TLS):** anonymous clone of `https://github.com/octocat/Hello-World.git`
  from the simulator **succeeded** — so TLS with system CA verification
  works with this build (OpenSSL merged into the archive, and it found
  usable roots). TLS is therefore not an open risk.
- **Caveat:** the dev API at `127.0.0.1:8013` was **down** and D2's git
  endpoints don't exist yet, so the token leg ran against a local stand-in:
  `Scripts/brain-spike-http-server.py` (stdlib `git http-backend` wrapper
  enforcing Basic auth). The protocol, transport, credential callback, and
  pkt-line flow exercised are identical to what the dev API will speak; the
  only thing not exercised is the API's own auth middleware.
- One interop finding: libgit2 1.3's bundled http-parser does not drain a
  401 body before reusing the connection and dislikes nothing about
  `Connection: close`; the test server sends an empty 401 body and closes
  per response. If the dev API keeps 401 bodies + keep-alive, re-test
  against it when D2 lands (cheap check, same screen).

### (b) file:// offline path — **PROVEN**

Bare repo created in-process inside the app container (`git_repository_init`),
cloned from, committed to, pushed to; remote HEAD re-read in-process **and**
via host `git log` on the container path (commit `12d8401`). This is the
fallback that keeps brain capture working with no network and no server.

### (c) Device-build signing status — **BLOCKED (precondition, not a library issue)**

`xcodebuild -sdk iphoneos` fails with:

```
error: Signing for "Allternit" requires a development team.
```

`DEVELOPMENT_TEAM` is an empty placeholder in `project.yml` and this machine
has **zero valid codesigning identities** — exactly the precondition the
spec/task called out. The library itself ships an `ios-arm64` slice that
linked into the device target before signing stopped the build (the failure
is at the signing step, not compile/link). **Unblock = set an Apple
Developer team; no git-library work needed.**

### (d) Library choice + toolchain issues + build size

- **Choice:** prebuilt **libgit2 v1.3.1 xcframework** from
  `light-tech/LibGit2-On-iOS` (public-domain build scripts), vendored at
  `Frameworks/libgit2.xcframework` following the Mesh.xcframework pattern
  (static, `embed: false`, gitignored, reproducible via
  `Frameworks/fetch-libgit2.sh`). OpenSSL + libssh2 + pcre are statically
  merged into the archive (verified `_SSL_new` defined); slices:
  `ios-arm64`, `ios-arm64_x86_64-simulator`, `ios-arm64_x86_64-maccatalyst`.
  Swift reaches it as `import Clibgit2` via the module map the fetch script
  injects (lifted from the same project's Clibgit2 release).
- **SwiftGit2 attempt (spec-required first choice): REJECTED**, exact error:
  `xcodebuild: error: Could not resolve package dependencies: the package
  manifest at '/Package.swift' cannot be accessed`. Upstream SwiftGit2 has
  **no SPM manifest on any ref** (Carthage/Xcode-project only; last tag
  0.6.0). It never even reached the Swift 6.0 toolchain ceiling. The
  light-tech SwiftGit2 fork (`spm` branch) exists but lacks `push` — dead
  end for D3.
- **Toolchain issues found (all resolved, all recorded in NOTES):**
  1. Missing `libz` (`_crc32`, `_inflateReset`) → added `sdk: libz.tbd`.
  2. Missing `libiconv` (`git_path_iconv`) → added `sdk: libiconv.tbd`.
  3. Three Swift 6 strict-concurrency errors in the spike's own code
     (sendability/C-interop), fixed.
  4. http-parser vs. 401-body/keep-alive interop (see (a) caveat).
- **Build size:** xcframework on disk 62 MB; `libgit2.a` slices 10 MB
  (ios-arm64) / 21 MB (fat simulator). Static linking pulls only referenced
  objects, so the linked increment is a fraction of the archive (no a/b
  release-binary measurement was taken — the Debug app ships a 171 MB
  unstripped `Allternit.debug.dylib` where Mesh's ~74 MB dominates anyway).
  Not a concern for D3; measure properly if the App Store size budget ever
  tightens.
- **Note:** libgit2 1.3.1 is from 2021. For the product, rebuild current
  libgit2 (1.9.x) with the same public-domain scripts — the vendoring
  mechanics proven here are version-independent. Do that during D3 proper,
  not as part of accepting this spike.

## Cost estimate for D3-R1/R2 (per TRACK-D)

Starting point: spike wrapper `BrainGit.swift` (~300 lines) already does the
hard C-interop (clone/commit/push/credentials) and runs in-app.

| Item | Estimate | Basis |
|---|---|---|
| Harden spike wrapper → production `BrainGitClient` (error types, pull/sync, auth-token plumbing from the app's session, conflict surfacing) | 2–3 days | clone/commit/push proven; pull = fetch+merge via same API family |
| D3-R1 onboarding brain creation (UI + `git_repository_init` + first commit + remote wiring to dev API when D2 lands) | 3–4 days | init proven in spike (file:// leg); main cost is onboarding UI (excluded from spike) |
| D3-R2 offline capture queue (append page → commit → queue push with retry; file:// mode already works) | 3–5 days | commit/push proven; cost is queue persistence + retry semantics |
| Re-test against real dev API git endpoints when D2 lands | 0.5 day | same spike screen, different URL |
| (Optional) rebuild libgit2 1.9.x from source | 1–2 days | light-tech scripts are CI-ready; or stay on 1.3.1 initially |
| **Total D3-R1/R2** | **≈1.5–2.5 weeks** | assumes D2 endpoints exist or are stubbed |

## Evidence index

- Result JSON (all 3 legs ok): app container `Documents/brain-spike-result.json` (log excerpts in NOTES).
- Remote verification: `git -C /tmp/brain-spike-http/brain.git log main` → `ce1e881 spike: append pages/…`; second clone contains the page. file:// remote: container bare repo `git log` → `12d8401`.
- Build: `xcodebuild -project Allternit.xcodeproj -scheme Allternit -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -configuration Debug build` → **BUILD SUCCEEDED** (exact command + device/release results in NOTES).
