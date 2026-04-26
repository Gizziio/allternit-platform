# BLUEPRINT: Ecosystem Parity & Feature Matrix (Codex/Expo/Mobile)

**Date:** April 18, 2026  
**Status:** PROPOSED / ANALYSIS  

---

## 1. Feature Matrix (Market Parity)

| Item | Target Status | Allternit Equivalent |
|---|---|---|
| **In-app browser** | Required | Integrated in Phase 13 (Computer Use) |
| **Page comments** | Required | Integrated in Phase 18 (A2UI/Canvas) |
| **Multi-agent workspace** | Required | Integrated in Phase 1/19 |
| **Worktrees (Isolation)** | Required | Integrated in Phase 17 (Workspace Isolation) |
| **Diff review** | Required | Integrated in Phase 17 |
| **Background tasks** | Required | Integrated in Phase 4 (Task Engine) |
| **App Server (JSON-RPC)** | Required | **NEW:** Explicit architecture for custom clients |
| **Expo MCP Integration** | Required | **NEW:** Mobile/Simulator workflow support |
| **iOS Simulator Interaction** | Required | **NEW:** XPC streaming / tap / inspect tools |
| **EAS Build/Test Tooling** | Required | **NEW:** EAS MCP Connector |

---

## 2. Integration Strategy: The "Expo Bridge"

### 2.1 Mobile Workflow Support
Codex and Expo have established a new benchmark for mobile development. Allternit must achieve parity by:
- Connecting to **Expo MCP** for package installs and EAS builds.
- Enabling **iOS Simulator** interaction (screenshots, taps, log collection) directly from the agent runtime.

### 2.2 App Server Architecture
To support remote and mobile clients (parity with Codex "App Server"), Allternit's gateway must be formalized as a **JSON-RPC App Server**. This enables third-party surfaces to connect to the Allternit core without rebuilding the execution engine.

---

## 3. Implementation Tasks (Extracted for DAG)

### Mobile & Simulator
- [ ] Implement the **Expo MCP Connector** for EAS build/test operations.
- [ ] Build the **iOS Simulator Driver** (MacOS-only) to stream XPC signals and capture frames for agent vision.
- [ ] Implement the `/simulator` toolset (tap, swipe, inspect-view).

### App Server Extensibility
- [ ] Formalize the `allternit-app-server` protocol (JSON-RPC 2.0).
- [ ] Expose the full kernel state via the App Server to support "Remote Codex" style alternative clients.
- [ ] Build the **Comment Mode** bridge: allowing DOM-element specific feedback to be journaled as high-priority intent.
