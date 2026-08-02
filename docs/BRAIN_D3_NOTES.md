---
status: done
files_changed:
  - surfaces/allternit-mobile/ios/project.yml
  - surfaces/allternit-mobile/ios/Frameworks/fetch-libgit2.sh
  - surfaces/allternit-mobile/ios/Features/Settings/BrainSpike/BrainGit.swift
  - surfaces/allternit-mobile/ios/Features/Settings/BrainSpike/BrainSpikeView.swift
  - surfaces/allternit-mobile/ios/Features/Settings/SettingsView.swift
  - surfaces/allternit-mobile/ios/Features/History/Views/HistorySidebarView.swift
  - surfaces/allternit-mobile/ios/App/AllternitApp.swift
  - surfaces/allternit-mobile/ios/Scripts/brain-spike-http-server.py
  - .gitignore
  - .steering/checkpoint.md
  - docs/BRAIN_D3_SPIKE.md
  - docs/BRAIN_D3_NOTES.md
tests_green: true
deviations:
  - SwiftGit2 (spec R1 first choice) rejected BEFORE reaching the toolchain
    ceiling — upstream has no SPM manifest at all. Fell back to the spec's
    sanctioned path: prebuilt libgit2.xcframework vendored under Frameworks/.
  - Dev API 127.0.0.1:8013 was down (D2 git endpoints don't exist yet), so
    the HTTP+Basic leg ran against a local smart-HTTP stand-in
    (Scripts/brain-spike-http-server.py) per the task's explicit fallback.
    TLS itself is separately proven (GitHub clone leg).
---

# D3 spike NOTES — embedded git client in the iOS app

Report: `docs/BRAIN_D3_SPIKE.md` (go/no-go + R3 line items + cost estimate).
This file is the reproduction record: exact commands, outputs, and every
failure mode hit along the way.

## Library decision trail (spec acceptance: "toolchain reality documented")

1. **SwiftGit2 via project.yml — REJECTED.** Added
   `SwiftGit2: { url: https://github.com/SwiftGit2/SwiftGit2, from: "0.6.0" }`,
   `xcodegen`, then:

   ```
   $ xcodebuild -project Allternit.xcodeproj -scheme Allternit -sdk iphonesimulator -resolvePackageDependencies
   xcodebuild: error: Could not resolve package dependencies:
     the package manifest at '/Package.swift' cannot be accessed (/Package.swift doesn't exist in file system)
   ```

   Root cause: upstream SwiftGit2 has **no Package.swift on any ref**
   (Carthage/Xcode-project layout, `libgit2` as git submodule, last tag
   0.6.0). Rejection happened at manifest resolution — the Swift 6.0 tools
   ceiling was never even reached. The light-tech SwiftGit2 fork (`spm`
   branch) was considered and rejected: their own README says it lacks
   `git push`. Reverted from project.yml.
2. **Fallback: prebuilt libgit2.xcframework — WORKED.** Source:
   `light-tech/LibGit2-On-iOS` release v1.3.1 (public-domain build scripts;
   libgit2 **1.3.1** + OpenSSL + libssh2 + pcre, all statically merged into
   one archive per slice — verified `_SSL_new` is *defined*, not just
   referenced). Slices shipped: `ios-arm64`, `ios-arm64_x86_64-simulator`,
   `ios-arm64_x86_64-maccatalyst`. Swift import via injected
   `Headers/module.modulemap` (module `Clibgit2`, from the same project's
   Clibgit2 v1.3.0 release). Vendored at
   `surfaces/allternit-mobile/ios/Frameworks/libgit2.xcframework`
   (gitignored like Mesh.xcframework; reproduce with
   `Frameworks/fetch-libgit2.sh`), linked static `embed: false` in
   project.yml — no cross-compile needed, so the spec's 2-hour
   cross-compile budget was never spent.
3. **Link fixes (both recorded in project.yml comments):** `_crc32` /
   `_inflateReset` → `sdk: libz.tbd`; `_iconv` (`git_path_iconv`) →
   `sdk: libiconv.tbd`.
4. **Swift 6 strict-concurrency fixes in spike code:** `@unchecked
   Sendable` on BrainGit (work serialized on one queue), explicit
   `() -> String?` closure type, `@escaping @Sendable` on the off-main
   helper, `withUnsafeMutableBufferPointer` for `git_commit_create` parents.
5. **Release gating fix:** the Settings section builder must be `#if DEBUG`
   itself, not just its call site — Release build initially failed with
   `cannot find 'isBrainSpikePresented' in scope`.

## Build evidence (task constraint: record command + result)

```
$ cd surfaces/allternit-mobile/ios && xcodegen
$ xcodebuild -project Allternit.xcodeproj -scheme Allternit \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -configuration Debug build
** BUILD SUCCEEDED **            (with libgit2 linked, spike screen included)

$ xcodebuild … -configuration Release build -sdk iphonesimulator
** BUILD SUCCEEDED **            (`nm` on the release binary: 0 BrainSpike/BrainGit
                                  symbols — DEBUG gating proven, nothing ships)

$ xcodebuild … -configuration Debug -sdk iphoneos -destination 'generic/platform=iOS'
error: Signing for "Allternit" requires a development team.
** BUILD FAILED **               (signing precondition — zero identities on this
                                  machine, DEVELOPMENT_TEAM placeholder; NOT a
                                  library issue: compile/link passed for the
                                  ios-arm64 slice, failure is at the sign step)
```

## Round-trip proof (exact harness)

Server stand-in (dev API :8013 down):

```
$ git init --bare /tmp/brain-spike-http/brain.git
$ git -C /tmp/brain-spike-http/brain.git config http.receivepack true
  (+ seeded initial commit on refs/heads/main)
$ python3 surfaces/allternit-mobile/ios/Scripts/brain-spike-http-server.py /tmp/brain-spike-http 8088
  # Basic auth: allternit / allternit_git_spike_token_123 (401 w/o, verified)
```

App run (iPhone 16 simulator, booted):

```
$ xcrun simctl install booted …/Debug-iphonesimulator/Allternit.app
$ xcrun simctl launch booted com.allternit.mobile -skip-auth \
    -open-settings-brain-spike -brain-spike-auto \
    -brain-spike-url http://127.0.0.1:8088/brain.git
```

Result (`Documents/brain-spike-result.json` via `simctl get_app_container`):

```
fileRoundTrip      OK — bare repo in app container; remote HEAD re-read in-process
httpBasicRoundTrip OK — clone→commit→push over smart-HTTP with Basic token auth
httpsPublicClone   OK — anonymous clone of github.com/octocat/Hello-World
libgit2Version     1.3.1
```

External verification (spec acceptance scenario):

```
$ git -C /tmp/brain-spike-http/brain.git log --oneline main
e34a8e9 spike: append pages/spike-2026-08-02T02-37-10Z.md   ← pushed from the app
ce1e881 spike: append pages/spike-2026-08-02T02-29-50Z.md   ← earlier run
d7baa00 host check / 9bd318b seed: initial brain
$ git -C /tmp/brain-spike-http/brain.git show main:pages/spike-2026-08-02T02-29-50Z.md
--- title: "Brain Spike page" … ---                         ← frontmatter intact
$ git clone http://allternit:allternit_git_spike_token_123@127.0.0.1:8088/brain.git /tmp/brain-spike-verify
$ ls /tmp/brain-spike-verify/pages/ → spike-….md            ← second clone sees it
$ git -C <app-container>/Documents/brain-spike/bare.git log --oneline
12d8401 spike: append pages/spike-2026-08-02T02-29-50Z.md   ← file:// leg remote
```

## HTTP interop findings (for D2's server design)

libgit2 1.3's bundled http-parser is stricter than curl/host-git:

1. It does **not drain a 401 body** before reusing the connection for the
   authenticated retry → leftover body bytes corrupt the next response
   (`http parser error: invalid constant string`). Test server sends an
   **empty 401 body** + `Connection: close`.
2. Push POSTs above its buffer arrive with **`Transfer-Encoding: chunked`**
   — a naive Content-Length-only CGI wrapper starves `git http-backend`
   (`early EOF` on push). Test server de-chunks request bodies.
3. **Retest against the real dev API when D2 lands** — if it returns 401
   bodies with keep-alive, expect (1). Same screen, different URL, ~minutes.

## What was and was not proven (task step 4 wording)

- **Proven:** clone → append frontmatter page → commit → push from the iOS
  app (simulator) over smart-**HTTP + Basic** with an `allternit_git_`-shaped
  token; **TLS** transport + CA verification (public GitHub clone);
  **file://** full round trip offline; DEBUG-only gating (release binary
  contains zero spike symbols); simulator Debug/Release builds pass.
- **Not proven:** against the real dev API (was down; D2 endpoints don't
  exist); TLS *with* Basic credentials in one flow (proven separately:
  TLS via GitHub, Basic via HTTP — no reason to expect interaction, but say
  it plainly); push over HTTPS; SSH (not attempted — not needed for D3);
  on-device anything (signing precondition).

## Notes for D3 proper

- libgit2 1.3.1 is 2021-era; rebuild 1.9.x with the same light-tech scripts
  (or stay — everything D3 needs exists in 1.3.1).
- `BrainGit.swift` is the seed for the production client; keep the C-callback
  credential-box pattern, add pull/merge + proper error types.
- The spike screen stays DEBUG-only; delete `Features/Settings/BrainSpike/`
  when the real client lands, or keep it as a diagnostics page.
- Automation args added (DEBUG only): `-open-settings-brain-spike`,
  `-brain-spike-auto`, `-brain-spike-url`, `-brain-spike-token`.
