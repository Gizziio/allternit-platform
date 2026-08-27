# Computer Use & Harness Integration Map

## Overview
This document maps external computer-use, browser automation, accessibility-tree automation, mobile harnesses, and HAR-derived API capture projects against the Allternit architecture.

---

### 1. `lahfir/agent-desktop`
- **Summary:** Native desktop automation CLI driven by operating system accessibility trees (AXUIElement on macOS / UI Automation on Windows). Inspects screen geometry and element hierarchies without relying strictly on pixel vision models.
- **License & Reuse Risk:** MIT / Open source. Low reuse risk.
- **Decision:** **Extract & Adapter Pattern**. Do not fork entire repository. Extract the macOS accessibility tree traversal and coordinate translation layer into `services/native-accessibility/` as an alternative backend to ACI pixel clicking.
- **Capability Gap:** Current Allternit computer use relies primarily on vision screenshots and coordinate normalization. Accessibility tree integration allows sub-millisecond element resolution, keyboard focus management, and deterministic form filling.
- **Adapter / Interface:** `DesktopAccessibilityAdapter` implementing `locateElement(selector: AXQuery): Promise<ScreenPoint>`.

---

### 2. `minghinmatthewlam/computer-use-mcp`
- **Summary:** MCP server wrapper exposing Anthropic-style computer use tools (`mouse_click`, `type_text`, `take_screenshot`, `drag_and_drop`, `key_combination`) over the Model Context Protocol.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Reference & Adopt Patterns**. Allternit's native tool belt already includes `computer` and `aci` endpoints. Adopt its schema patterns for granular keyboard modifier sequences (`ctrl+alt+delete`, `cmd+shift+4`).
- **Capability Gap:** Allternit tools had basic keydown/keyup events; full multi-key chord combinations and display selection were standardized.
- **Adapter / Interface:** Native MCP tool exposure via `/api/v1/mcp` and `cmd/allternit-api/src/mcp_server_routes.rs`.

---

### 3. `alibaba/page-agent`
- **Summary:** In-browser DOM agent capable of executing complex multi-step workflows, form filling, selector stabilization, and interactive UI driving inside Chrome extension environments.
- **License & Reuse Risk:** Apache 2.0. Low risk.
- **Decision:** **Promote to Shared Package**. Promoted into `services/page-agent/` and mapped to `@allternit/page-agent` for universal consumption across the web platform, extension sidepanel, and desktop shells.
- **Capability Gap:** Previously duplicated across surface folders and extension runtime code. Now centralized with shared TypeScript types, runtime client, and API proxies under `/api/page-agent/*`.
- **Adapter / Interface:** `@allternit/page-agent` client (`runPageAgentTask`, `stopPageAgentTask`, `PageAgentService`).

---

### 4. `droidrun/mobile-harness`
- **Summary:** Android automation harness utilizing ADB, UI Automator, and screenshot streaming to execute agent operations on physical devices and emulators.
- **License & Reuse Risk:** Apache 2.0 / MIT. Medium operational complexity (ADB daemon management).
- **Decision:** **Adopt as Mobile Driver**. Implement in `cmd/allternit-api/src/mobile_harness_routes.rs` for physical device test execution.
- **Capability Gap:** Allternit had iOS simulator builds (`xcodebuild`) but lacked direct ADB-based Android device execution in the browser canvas.
- **Adapter / Interface:** `AndroidAdbHarness` running `adb shell input tap x y` and `adb exec-out screencap -p`.

---

### 5. `ShawnPana/phone-harness`
- **Summary:** Lightweight iOS & Android test harness focusing on Appium-free device control via native instrumentation and WebSocket telemetry streaming.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Complement**. Use alongside `droidrun/mobile-harness` for low-latency iOS WebDriverAgent / `idb` integration.
- **Capability Gap:** Provides high-framerate remote frame streaming suitable for the ACI browser/device canvas view.
- **Adapter / Interface:** `iOSDeviceBridge` wrapping `idb` / `simctl` commands.

---

### 6. `apitap.io` / HAR-Derived API Client
- **Summary:** Network traffic capture and contract synthesis tool that ingests HTTP Archive (HAR) streams and automatically generates strongly typed, replayable API contracts and clients.
- **License & Reuse Risk:** Proprietary reference / Hermetic cleanroom reimplementation.
- **Decision:** **Native Implementation**. Built directly into `cmd/allternit-api/src/har_api_routes.rs` and `surfaces/ai.allternit.com/src/views/api-capture/ApiCaptureView.tsx`.
- **Capability Gap:** Enables autonomous agents to record browser sessions, derive OpenAPI/TypeScript contracts, and execute programmatic API calls without ongoing DOM scraping.
- **Adapter / Interface:** `ApiCaptureService` + `/api/har-derived-api/*` endpoints.

---

### 7. `browse.sh`
- **Summary:** Minimalist browser automation CLI that wraps Playwright / CDP in a single executable suitable for terminal agents and headless CI environments.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Extract Patterns**. Incorporate its lightweight CDP session reuse and cookie injection algorithms into gizzi-code's headless browser runner.
- **Capability Gap:** Replaces heavy external browser managers with direct CDP WebSocket attachment.
- **Adapter / Interface:** `HeadlessCdpClient` in gizzi-code runtime.
