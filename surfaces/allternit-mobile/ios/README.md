# Allternit iOS

Native iOS workspace for the Allternit autonomous-agent platform.

## Requirements

- macOS 14.6+
- Xcode 16.2+ (Swift 6.0)
- iOS 17.0+ deployment target
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)

## Build

The `.xcodeproj` is generated from `project.yml`:

```bash
cd surfaces/allternit-mobile/ios
xcodegen generate
xcodebuild -scheme Allternit -destination 'platform=iOS Simulator,name=iPhone 16' build
```

The first time you build, copy the secrets template and add your Clerk publishable key:

```bash
cp Config/Secrets.xcconfig.example Config/Secrets.xcconfig
# Edit Config/Secrets.xcconfig and set CLERK_PUBLISHABLE_KEY
```

`Config/Secrets.xcconfig` is gitignored so the key is never committed.

DEBUG builds also expose a **"Continue without signing in"** button on the login gate when the Clerk key is missing, so you can open the workspace UI without a configured Clerk app.

To run tests:

```bash
xcodebuild -scheme Allternit -destination 'platform=iOS Simulator,name=iPhone 16' test
```

## Project structure

```
ios/
├── App/                 # App entry point, delegate, lifecycle
├── Core/                # Stores, API clients, models, design system
│   ├── LiveActivity/    # Shared ActivityAttributes for Dynamic Island
│   ├── API/Models/      # REST/SSE data models
│   └── ...
├── Features/            # SwiftUI surfaces (Chat, Agents, Code, Settings, ...)
├── AllternitWidgets/    # Live Activity widget extension
├── Tests/               # Unit tests
├── maestro/             # End-to-end Maestro flows
├── Assets.xcassets      # App icons, colors, images
└── project.yml          # XcodeGen project definition
```

## Dynamic Island / Live Activities

The app exposes two local (non-push) Live Activities:

- **Loop Live Activity** — shows iteration progress for a running `Loop`.
- **Bot Live Activity** — summarizes the dominant operational status across all subscribed bots.

Both are implemented with ActivityKit and rendered in the `AllternitWidgets` extension. The main app targets start/update/end activities via:

- `LoopLiveActivityManager` (driven by `LoopStore`)
- `BotLiveActivityManager` (driven by `BotStatusStore`)

Live Activities require `NSSupportsLiveActivities` in `Info.plist` (already set).

## Configuration

Build-time configuration lives in `project.yml`:

- `CLERK_PUBLISHABLE_KEY` — Clerk public key (client-safe by design).
- `ALLTERNIT_API_BASE_URL` — backend base URL.
- `ALLTERNIT_GIZZI_CODE_URL` — gizzi-code pty/loop server URL.
- `ALLTERNIT_MESH_CONTROL_URL` — Headscale control plane URL.

Debug defaults point at local dev servers (`127.0.0.1`). Release defaults point at the hosted Allternit infrastructure.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).
