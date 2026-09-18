---
status: done
files_changed:
  - cmd/allternit-api/src/canvas_routes.rs
  - surfaces/allternit-mobile/ios/Core/API/CanvasClient.swift
  - surfaces/allternit-mobile/ios/Features/Artifacts/ArtifactLibraryStore.swift
  - surfaces/allternit-mobile/ios/Features/Artifacts/Views/ArtifactsLibraryView.swift
  - surfaces/allternit-mobile/ios/Features/Artifacts/Views/SandboxedArtifactWebView.swift
deviations:
  - "Phase 4 found and fixed two genuine integration bugs: gizzi-code canvases under synthetic session ids were undiscoverable by iOS's agent-session sweep, and the custom-scheme WKWebView's delegate-only JavaScript opt-in did not run the generator's inline tab handler. Both fixes are described below and were verified in the real simulator UI."
  - "Used Phase 2's approved direct-handler invocation because the real CLI entrypoint still has the same unrelated missing-dependency boot failure documented there."
remaining:
  - "The paired-runtime-device token attachment remains code-reviewed but not exercised with a genuinely paired machine; local Phase 4 used the existing debug/local-dev auth path as required."
  - "The top-level gizzi CLI entrypoint's pre-existing undeclared/missing dependencies (figures, axios, yaml, sharp) still need dependency-hygiene ownership before `gizzi html-artifact` can be invoked normally in this worktree."
---

## Verdict

The full loop works end to end now:

`gizzi-code handler → real allternit-api → one versioned canvas row → real iOS
Artifacts Library → sandboxed HTML preview → interactive generated tabs`.

The first publish created version 1. The second publish used the same
`artifact_key`, returned the same canvas id at version 2, and left exactly one
database row. The real iOS app fetched that row through its debug auth path,
displayed `HTML · V2` in the library, rendered the version-two HTML, and changed
from Overview to Details when the generated tab was tapped. The Details pane
showed `Canvas version 2` and `Rows 1`.

## Isolated setup

The backend used a throwaway data directory and port 8098:

```text
$ phase4_data=$(mktemp -d /tmp/allternit-phase4.XXXXXX)
/tmp/allternit-phase4.KMPtDz

$ ALLTERNIT_DATA_DIR=/tmp/allternit-phase4.KMPtDz \
  ALLTERNIT_LOCAL_DEV_BYPASS=true \
  ALLTERNIT_API_PORT=8098 \
  cargo run -p allternit-api

INFO ... applying migration: V33__agent_canvas_artifact_key ...
INFO ... SQLite DB ready at /tmp/allternit-phase4.KMPtDz/allternit.db
INFO ... Server listening on 0.0.0.0:8098
```

No real dev database, Clerk state, or pairing state was used or modified.

The CLI and iOS debug paths were both pointed at this server. The server's
localhost development bypass resolved both clients to the same isolated local
development user. The iOS app launched with its existing `-skip-auth` DEBUG
argument; no credential was fabricated.

## Publish and redeploy

I invoked `HtmlArtifactPublishCommand.handler` directly, exactly as Phase 2 did,
with `ALLTERNIT_API_URL=http://127.0.0.1:8098` and the stable key
`phase4-integration-report`.

First publish:

```text
$ ALLTERNIT_API_URL=http://127.0.0.1:8098 \
  ALLTERNIT_USER_ID=dev-ios-tester \
  bun /tmp/phase4-publish.ts /tmp/phase4-input-v1.json

Published "Phase 4 Integration Report" as "phase4-integration-report" —
canvas 538a2646-7ec2-4393-9c71-0d60edd699a2, version 1.
Saved to .gizzi/artifacts/phase4-integration-report/config.json
```

The v1 artifact had two tabs, a first-publish callout, and an explicit
`Canvas version 1` stat. Direct GET confirmed `version: 1` and the generated
self-contained HTML, including its inline tab script.

Redeploy with different structured input:

```text
$ ALLTERNIT_API_URL=http://127.0.0.1:8098 \
  ALLTERNIT_USER_ID=dev-ios-tester \
  bun /tmp/phase4-publish.ts /tmp/phase4-input-v2.json

Redeployed "Phase 4 Integration Report" as "phase4-integration-report" —
canvas 538a2646-7ec2-4393-9c71-0d60edd699a2, version 2.
Saved to .gizzi/artifacts/phase4-integration-report/config.json
```

The v2 response retained the exact v1 canvas id. Direct API output contained
`"version":2`, `Version two live`, and the updated `Redeploy succeeded` callout.
SQLite independently confirmed stable-key in-place replacement:

```text
$ sqlite3 /tmp/allternit-phase4.KMPtDz/allternit.db \
  "SELECT id, session_id, artifact_key, version, user_id, COUNT(*) OVER () FROM agent_canvases;"

538a2646-7ec2-4393-9c71-0d60edd699a2|
6bdebe2e-6a95-4320-b5e8-6a674c886889|
phase4-integration-report|2|local-dev-user|1
```

## Integration bug 1: canvas discovery

The pre-Phase-4 iOS refresh could not discover the published canvas. It first
called `GET /agent-sessions`, then requested canvases for those returned session
ids. That endpoint lists real gizzi chat sessions. Phase 2 intentionally gives
each CLI artifact a stable synthetic UUID session id, and canvas creation does
not create a gizzi chat session. The live reproduction returned 17 real
`ses_...` sessions; none was the published UUID
`6bdebe2e-6a95-4320-b5e8-6a674c886889`.

The fix adds authenticated `GET /api/v1/canvases`, returning the newest 200
canvas rows for `AuthUser.user_id`, and changes `ArtifactLibraryStore` to use
that one request. Existing per-session canvas routes remain intact for existing
callers. This is both compatible with synthetic publisher sessions and removes
the old 30-session/4-concurrent N+1 sweep.

After restart, the new endpoint immediately returned the Phase 4 artifact even
though its synthetic session id was absent from `/agent-sessions`.

## Integration bug 2: inline tab JavaScript

The first live WebView run rendered the title, status, Overview tab, callout,
and body correctly, but tapping Details did not switch panes. The button
received pointer/tap hover and double-tap zoom, proving the content was live,
but the inline click handler had not executed. No CSP rejection appeared in
the simulator log.

The existing code enabled JavaScript only through the navigation delegate's
`WKWebpagePreferences`. For this custom `artifact://` scheme, that opt-in was
not applied early enough for the document's inline script. The fix initializes
`WKWebViewConfiguration.defaultWebpagePreferences.allowsContentJavaScript`
from the artifact type in `makeUIView`; the navigation delegate still repeats
the same type-gated policy, and CSP still limits scripts to inline code only for
HTML/JavaScript artifact types.

After rebuilding and reinstalling, one tap on Details moved the active underline
and displayed:

```text
Version
2  Canvas version
1  Rows
```

This is live proof that the generated inline tab script runs inside the sandbox.

## iOS build and real UI evidence

The Phase 3 ignored `Mesh.xcframework` prerequisite was already present. I built
the app against the isolated backend:

```text
$ xcodebuild -project Allternit.xcodeproj -scheme Allternit \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=4374A6A2-E441-46EF-A0B8-BA40BB957448' \
  ALLTERNIT_API_BASE_URL='http://127.0.0.1:8098/api/v1' build

** BUILD SUCCEEDED **
```

Then installed and launched it on iPhone 16 Pro / iOS 18.3.1:

```text
$ xcrun simctl install 4374A6A2-E441-46EF-A0B8-BA40BB957448 <DerivedData>/Allternit.app
$ xcrun simctl launch 4374A6A2-E441-46EF-A0B8-BA40BB957448 \
  com.allternit.mobile -skip-auth
com.allternit.mobile: 91828
```

Observed in the actual simulator:

1. Opening Artifacts Library showed one card titled
   `Phase 4 Integration Report`, subtitle `HTML · V2 · Jul 31, 2026 ...`.
2. Opening it showed Preview/Code controls and the fully rendered dark-mode
   artifact: `Version two live`, Overview/Details tabs, updated callout, and
   updated pipeline text.
3. Tapping Details switched panes and showed the two v2 stats above.

Screenshots were captured during verification as
`/tmp/phase4-details-v2.png` and through the Computer Use capture; they were
moved to Trash with the test scratch data during teardown after their contents
were recorded here.

The app's real persisted library file independently contained:

```json
{
  "id": "phase4-integration-report",
  "artifactId": "phase4-integration-report",
  "fileType": "html",
  "version": 2,
  "sessionId": "6bdebe2e-6a95-4320-b5e8-6a674c886889"
}
```

and its `inlinePreview` contained the v2 HTML, not v1.

## Verification summary

- `cargo test -p allternit-api`: 120 tests passed (100 unit + 6 health + 14 viz), 0 failed.
- Full iOS simulator build after both integration fixes: succeeded.
- Real handler publish: version 1.
- Real handler redeploy: same id, version 2.
- SQLite: one row.
- Real iOS refresh: artifact present at V2.
- Real sandbox preview: v2 HTML rendered.
- Real generated tab interaction: Details pane activated and displayed v2/row stats.

## Four-phase final state

Shippable now:

- device-token-aware canvas authentication in the backend and CLI client;
- atomic stable-key canvas upsert with monotonic versions;
- deterministic, self-contained HTML generation and local artifact config;
- CLI publish/redeploy/status handlers;
- user-scoped cross-session canvas discovery;
- iOS parsing compatible with CLI and web component producers;
- monotonic local version merging and visible version labels; and
- sandboxed HTML rendering with working inline interactions and no external
  navigation/network access.

Human checks before merging `ao/html-artifacts` to `main`:

1. Resolve the pre-existing gizzi CLI dependency declarations so the registered
   `gizzi html-artifact` entrypoint can boot normally rather than requiring
   direct handler invocation.
2. Exercise the paired-runtime-device bearer path on an actually paired machine.
3. Review the new global canvas-list retention bound (`LIMIT 200`) against expected
   product scale; pagination can be added later if the library exceeds that size.
4. Review the complete uncommitted four-phase diff as one unit. No commits or
   pushes were made.

## Teardown

The isolated server was stopped, `com.allternit.mobile` was terminated and
uninstalled from the test simulator, and the iPhone 16 Pro simulator was shut
down. The throwaway database directory, temporary input/handler files,
screenshot, and `.gizzi/artifacts/phase4-integration-report` test config were
moved to Trash (recoverable) and verified absent from their original paths.
