---
status: done
files_changed:
  - surfaces/allternit-mobile/ios/Core/API/CanvasClient.swift
  - surfaces/allternit-mobile/ios/Features/Artifacts/ArtifactLibraryStore.swift
  - surfaces/allternit-mobile/ios/Features/Artifacts/Views/ArtifactDetailsView.swift
deviations:
  - "The simulator app launched successfully, but the fresh simulator had no authenticated Clerk session, so I could not drive refreshFromBackend() against a real local backend through the UI. Phase 4 remains the authenticated end-to-end verification phase. This phase instead traced the exact Phase 2 wire fixture through the decoded model/parser logic, built the complete iOS target, launched it, and audited the generated HTML's CSP/JavaScript path directly."
remaining: []
---

## Summary

The iOS Artifacts Library now accepts gizzi-code's approved canvas component
shape, carries the backend canvas version into `ArtifactRecord`, and only
applies backend updates monotonically. The existing sandbox renderer already
has the policy needed for gizzi-code's inline tab-switching script; no renderer
change was necessary.

## Components-shape finding and fix

The Phase 2 compatibility concern was real. gizzi-code publishes:

```json
{ "type": "artifact", "kind": "html", "title": "…", "content": "…" }
```

`ArtifactLibraryStore.savedArtifacts(from:sessionId:)` previously required
`component.artifactId`, so this valid component was silently discarded before
it could reach the library. The web producer in
`surfaces/ai.allternit.com/src/lib/agents/mode-session-store.ts` does include
`artifactId`; therefore that field remains decoded and supported, but it is no
longer required.

`CanvasRecord` now decodes the Phase 1 `artifact_key` and `version` fields.
Incoming artifact identity is derived in this order:

1. canvas `artifact_key` (the stable redeploy identity),
2. component `artifactId` (the existing web/iOS contract),
3. canvas `id` (a stable fallback for keyless components).

The derived value fills both `ArtifactRecord.id` and `artifactId`. `kind`,
`title`, and inline `content` already matched iOS's fields, so gizzi-code's HTML
now becomes an `ArtifactRecord(fileType: "html", inlinePreview: html)` without
changing the approved Phase 2 payload or breaking the existing web producer.

## Version awareness

`ArtifactRecord` gained optional `version: Int?`, defaulting to nil for stream,
local, and legacy records. Canvas-derived records receive `canvas.version`.
Because the field is optional, synthesized `Codable` continues to read older
`artifact-library.json` files that lack it.

The old refresh merge only added unseen IDs, so its "local wins" rule also
prevented a same-ID backend redeploy from ever appearing. The merge now:

- inserts unseen fetched artifacts;
- replaces an unversioned local/legacy copy with a versioned backend copy;
- replaces a versioned copy only when the fetched version is greater; and
- ignores equal or lower versions, preventing stale refresh results from
  clobbering newer local state.

No version-history UI was added.

## Renderer and CSP verification

The fetched record's `inlinePreview` is the component's HTML content.
`ArtifactContentLoader` resolves inline content, and `ArtifactDetailsView`
passes it to `SandboxedArtifactWebView` because `fileType == "html"` is
previewable.

The suspected CSP bug is not present in the current code. For HTML artifacts:

- `allowsJavaScript(for:)` returns true;
- `contentSecurityPolicy(allowsJavaScript:)` emits
  `script-src 'unsafe-inline'` alongside inline-style permission;
- the navigation delegate sets `WKWebpagePreferences.allowsContentJavaScript`
  to true for the custom `artifact://artifact/` navigation; and
- external navigation and network subresources remain blocked.

Thus the inline `<script>` emitted by the Phase 2 generator's multi-tab output
is allowed, while its self-contained/no-network property remains enforced.

## Verification

The first build attempt correctly exposed a worktree prerequisite rather than
a source error: `ios/Frameworks/Mesh.xcframework` was absent. I copied the
matching prebuilt framework from the main Allternit worktree into this
worktree's ignored `Frameworks/` location; no tracked source or project file
was changed for that prerequisite.

Full simulator build:

```text
xcodebuild -project Allternit.xcodeproj -scheme Allternit \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=4374A6A2-E441-46EF-A0B8-BA40BB957448' \
  build

** BUILD SUCCEEDED **
```

I then booted the iPhone 16 Pro (iOS 18.3.1) simulator, installed the produced
`Allternit.app`, and launched `com.allternit.mobile` successfully (PID 89505).
The launch log showed normal UIKit/Clerk initialization and no crash or dynamic
link failure; a screenshot was captured at `/tmp/allternit-phase3-launch.png`.
The fresh simulator stopped at the unauthenticated Clerk/loading surface, so it
could not perform an authenticated Artifacts Library backend sweep. I did not
fabricate a user session or weaken auth to bypass that boundary.

Static/fixture tracing used the exact Phase 2 component shape above and confirms
it decodes with optional `artifactId == nil`, derives its stable ID from
`artifact_key`, retains the HTML in `inlinePreview`, carries `version`, and
reaches the HTML WebView path. The full authenticated publish-twice/fetch/render
exercise remains Phase 4 by design; Phase 4 was not started.
