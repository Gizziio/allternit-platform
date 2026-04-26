# @allternit/iosappbuild-plugin

Build and run iOS apps from React Native, Expo, or Swift projects using `xcodebuild`.

## Requirements

- **macOS** — iOS builds require a Mac. This plugin will refuse to run on Linux or Windows.
- **Xcode Command Line Tools** — Install with `xcode-select --install`.
- **Xcode IDE** (optional) — Required for Simulator management and code signing.
- **Fastlane** (optional) — Can be used for signing and App Store upload workflows.

## Supported Project Types

| Type | Description |
|------|-------------|
| `react-native` | Standard React Native projects with an `ios/` directory |
| `expo` | Expo projects after running `npx expo prebuild` |
| `swift` | Swift Package Manager or Xcode Swift projects |
| `flutter` | Recognized in the schema; currently returns `UNSUPPORTED_TYPE` (planned) |

## Build Targets

- **simulator** (default) — Builds for the iOS Simulator and optionally boots, installs, and launches the app.
- **device** — Builds for a physical iOS device (`generic/platform=iOS`).
- **archive** — Creates an `.xcarchive` in the `build/` directory, suitable for distribution.

## Usage

### Allternit Platform

The plugin is automatically loaded by the Allternit runtime. Call the `execute` function with the desired parameters.

### CLI Adapter

```bash
node ./adapters/cli.js --path /path/to/project \
  --projectType react-native \
  --target simulator \
  --scheme MyApp \
  --simulatorName "iPhone 15" \
  --configuration Debug \
  --clean
```

### HTTP Adapter

```javascript
const { createHandler } = require('./adapters/http');
const http = require('http');

const server = http.createServer(createHandler());
server.listen(3000);
```

Send a `POST` request with a JSON body:

```json
{
  "path": "/path/to/project",
  "projectType": "react-native",
  "target": "simulator",
  "scheme": "MyApp",
  "configuration": "Debug",
  "clean": false
}
```

### MCP Adapter

```javascript
const { registerMcp } = require('./adapters/mcp');
registerMcp(mcpServer);
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | `string` | — | **Required.** Path to the project directory |
| `projectType` | `string` | `react-native` | One of: `react-native`, `expo`, `swift`, `flutter` |
| `scheme` | `string` | auto-detected | Xcode scheme to build |
| `target` | `string` | `simulator` | `simulator`, `device`, or `archive` |
| `simulatorName` | `string` | `iPhone 15` | Simulator to target (simulator target only) |
| `configuration` | `string` | `Debug` | `Debug` or `Release` |
| `clean` | `boolean` | `false` | Run `xcodebuild clean` before building |

## Common Issues & Fixes

### Missing `ios/` directory

**Error:** `MISSING_IOS_DIR`

For Expo projects, generate the native iOS directory first:

```bash
npx expo prebuild
```

For React Native projects, ensure you have run:

```bash
cd ios && pod install
```

### Missing Xcode project files

**Error:** `MISSING_XCODE_PROJECT`

Ensure the `ios/` directory contains either a `.xcworkspace` (CocoaPods) or `.xcodeproj` file.

### Code signing / device build failures

Device builds require a valid Apple Developer account and provisioning profile. Open the project in Xcode to configure signing:

```bash
open ios/*.xcworkspace
```

Then go to **Signing & Capabilities** and select your team.

### `xcodebuild` not found

**Error:** `XCODE_MISSING`

Install the Xcode Command Line Tools:

```bash
xcode-select --install
```

If Xcode is installed in a non-standard location, point to it:

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

### Simulator does not boot or install

Make sure the simulator name matches an installed runtime exactly. List available simulators:

```bash
xcrun simctl list devices available
```

## License

MIT
