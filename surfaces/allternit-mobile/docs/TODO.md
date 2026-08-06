# Allternit iOS Integration & Gap-Closing TODO List

This checklist tracks the implementation of core features and gap resolutions for the Allternit iOS client.

## Core Feature Enhancements
- [x] **ACI Browser Localhost Tunnel**
  - Integrate port forwarding directly into `resolveMeshProxyBaseURL` in [InstanceConnection.swift](file:///surfaces/allternit-mobile/ios/Core/API/InstanceConnection.swift).
  - Enable live previewing of localhost dev servers in [ACIWebBrowserView.swift](file:///surfaces/allternit-mobile/ios/Features/ACI/Views/ACIWebBrowserView.swift).
- [x] **Workspace File Editor Upgrades**
  - Integrated Runestone (+ `TreeSitterLanguages` for JSON/Markdown/Python/JS/TS/YAML/Bash/Swift grammars, `project.yml`) via a new `CodeEditorView.swift` (`Features/Code/CodeEditor/`) + `CodeLanguage.swift` (`Core/API/`), replacing the plain `TextEditor` in [WorkspaceFileEditorView.swift](file:///surfaces/allternit-mobile/ios/Features/Agents/WorkspaceFileEditorView.swift).
  - The "Edit with chat" preview card now renders an inline green/red diff (reusing `DiffLine.diffLines`/`DiffRenderer` from the session diff viewer) instead of a flat text dump.
- [x] **Automation Dashboard Updates** — retargeted from "Cowork" to `Features/Automation/*` (loops live there, not in Cowork — `CoworkWorkspaceView.swift` is a session launchpad with no loop concept)
  - Added `LoopStaminaRing.swift`: a circular `iterationLog.count / maxIterations` ring, colored by state, in both `LoopsListView`'s rows and `LoopDetailView`'s header.
  - **Correction on "loop permission interrupts":** checked `loop-engine.ts` — a Loop just spawns its `command` on a bare timer (no agent, no permission gate at all), so there is nothing to wire up there. The loop's actual interrupt point is running out of its iteration budget without the exit condition firing; `LoopDetailView` now shows a prominent "Ran out of iterations" banner with a one-tap Restart when `state == "max_iterations"`.

## Gaps Resolution
- [x] **Gap 1: Connection Resilience (Pty Reconnect)**
  - Establish a WebSocket sequence-reconnect token in [PtySession.swift](file:///surfaces/allternit-mobile/ios/Core/API/PtyClient.swift).
  - Implement client-side retry recovery on socket drop to reattach without restarting.
- [x] **Gap 2: Background Liveness & Stream Preservation**
  - Real live sockets can't survive suspension on iOS regardless of client-side effort, so this landed as the pragmatic middle ground: `Core/BackgroundRefreshManager.swift` registers a `BGAppRefreshTask` (`com.allternit.mobile.refresh`, `Info.plist`: `UIBackgroundModes: [fetch]` + `BGTaskSchedulerPermittedIdentifiers`), scheduled on every `.background` scenePhase transition from `AllternitApp.swift`.
  - On wake it polls `PermissionClient.listPending()`, diffs against a UserDefaults-persisted seen-id set, and posts a local notification per newly-seen request (`NotificationService.postPermissionRequestNotification`, reusing the existing `.notifications` app-permission opt-in — no new consent flow).
  - Note: iOS decides actual firing cadence based on usage/battery, not a guarantee — real push-on-server-event (Gap 3) is what actually removes the gap.
- [~] **Gap 3: True Push Notifications (APNs)** — client-side plumbing only, unverifiable
  - `Core/PushNotificationManager.swift` + `App/AppDelegate.swift` (`@UIApplicationDelegateAdaptor`): requests remote-notification registration right after the user grants local-notification authorization (`NotificationService.requestAuthorization`, same consent moment), captures the resulting APNs device token, stores it locally.
  - **Not wired further, on purpose** — checked both blockers directly rather than assuming: (1) no `/api/v1/devices` or equivalent exists anywhere in `allternit-api`/`allternit-cloud-api`/`gizzi-code` (the TODO's proposed route was invented, not real — `runtime_devices` is the unrelated mesh-pairing registry); (2) `project.yml` has `DEVELOPMENT_TEAM: ""`, no Push capability provisioned, this app has never been signed for a device. `registerForRemoteNotifications()` will fail on every build until both exist. The POST is a one-line addition (`didRegister(deviceToken:)`) once a backend route is real.
- [~] **Gap 4: Live Activities & Apple Watch Integration** — Live Activities done and real; Watch deliberately not attempted
  - **Live Activities (done, end-to-end real):** unlike push, a *local* (non-push) Live Activity needs no signing team or backend — just `NSSupportsLiveActivities` in Info.plist + iOS 16.1+. Added a new `AllternitWidgets` app-extension target (`project.yml`) with `LoopLiveActivity.swift` (Lock Screen banner + Dynamic Island compact/expanded/minimal, mirroring `LoopStaminaRing`'s progress-ring look) and a shared `Core/LiveActivity/LoopActivityAttributes.swift`. `Core/LoopLiveActivityManager.swift` starts/updates/ends the Activity from `LoopStore.sync(with:)`, called after every fetch/refresh/delete. Verified: clean build succeeds, app installs and launches in the simulator with the extension embedded, no crash (confirmed via `simctl launch` + log stream + screenshot) — could not visually confirm the Lock Screen/Dynamic Island rendering itself, same Clerk sign-in wall blocking every prior session past the auth screen.
  - **Apple Watch: not attempted.** A watchOS companion target is a much larger, independently-scoped effort (new target + WatchKit/unified-target plumbing, its own UI, a data path for rate rings + remote approvals, watch-simulator pairing to test at all) with real risk of destabilizing the main app's `project.yml`/build graph if rushed alongside everything else in this pass. Recommend scoping it as its own dedicated task rather than folding it in here.
- [x] **Gap 5: Event-Driven Approvals (Permission SSE)**
  - Subscribe to `/v1/event` SSE in [PermissionClient.swift](file:///surfaces/allternit-mobile/ios/Core/API/PermissionClient.swift).
  - Instantly update permission alerts instead of interval polling.
