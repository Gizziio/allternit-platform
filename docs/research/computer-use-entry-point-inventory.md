# Computer Use Entry-Point and Session-Ownership Inventory

**Status:** Initial static inventory; expand during Wave 0 before consolidation.

| Area | Current location | Current responsibility | Consolidation concern |
|---|---|---|---|
| ACU gateway | `domains/computer-use/core/gateway/main.py` | Direct browser/native actions, receipts, recordings, parallel/hybrid endpoints | Large transport file owns action behavior and duplicates request/result models. |
| Autonomous run router | `domains/computer-use/core/gateway/computer_use_router.py` | Planning-loop execution, SSE, approvals, cancellation, session endpoints | Maintains an in-memory run/event store separate from browser session ownership. |
| Browser session manager | `domains/computer-use/core/gateway/session_manager.py` | Shared Chromium with per-session contexts/pages | One of multiple browser/session authorities. |
| Browser runtime service | `api/services/browser-runtime/` | Express/WebSocket Playwright sessions and raw input/screenshot endpoints | Separate service, session model, port, and tool vocabulary. |
| Gateway GUI tools | `api/gateway/routing/src/gui_tools.rs` | Registers screenshot/click/type/scroll tool commands | Tool registration is not generated from ACU's Python contracts. |
| Base adapter contract | `domains/computer-use/core/core/base_adapter.py` | Action requests, result envelopes, artifacts, capabilities, receipts | Status is completion-oriented and cannot express verified `worked/didnt/unknown`. |
| Accessibility adapter | `domains/computer-use/core/adapters/desktop/accessibility_adapter.py` | AX inspection, native actions, background event attempts, fallbacks | macOS-centric; provider guarantees and fallback route are not canonical. |
| PyAutoGUI adapter | `domains/computer-use/core/adapters/desktop/pyautogui/` | Global pointer/keyboard/screenshot fallback | Must never satisfy strict-background capability. |
| Browser adapters | `domains/computer-use/core/adapters/browser/` | Playwright, CDP, browser-use, extension, DOM MCP, gateway proxy | Overlapping lifecycle, state, and result behavior. Gateway proxy creates a self-loop. |
| Hybrid coordinator | `domains/computer-use/core/adapters/hybrid/orchestrator/` | Multi-step cross-provider sequences | Should orchestrate canonical single-resource transactions. |
| Parallel coordinator | `domains/computer-use/core/core/parallel_coordinator.py` | Concurrent workflows | Must delegate physical-resource serialization to canonical scheduler. |
| Planning loop | `domains/computer-use/core/core/planning_loop.py` | Model observe/plan/act/reflect loop | Must consume canonical observations and preserve unknown outcomes. |
| Observation recording | `domains/computer-use/core/observability/` | Frames, timelines, replay, GIF/video builders | Needs one trajectory schema and evidence IDs shared with receipts. |
| Legacy action recorder | `domains/computer-use/core/core/action_recorder.py` | JSONL action recording/replay | Overlaps observability recorder. |
| Sandbox providers | `domains/computer-use/core/sandbox/` | Process, Firecracker, Apple virtualization experiments | No single environment lifecycle shared by ACU sessions. |
| Product SDK bridge | `surfaces/ai.allternit.com/src/integration/computer-use-engine.ts` | Resolves gateway and executes actions | Should become generated/public SDK consumer only. |
| Product session store | `surfaces/ai.allternit.com/src/capsules/browser/browserAgent.store.ts` | Run/session state, SSE, approvals, screenshots | UI state currently mirrors gateway-specific payloads. |
| Computer-use sidecar | `surfaces/ai.allternit.com/src/capsules/browser/ACIComputerUseSidecar.tsx` | Screenshot, AX, cursor, windows, notifications, approvals | Must render canonical route, state freshness, outcome, evidence, and takeover lease. |
| Browser extension bridge | browser capsule/extension integration | Attaches and controls active browser tabs | Must become a browser provider using shared resource IDs and epochs. |
| VM session routes | `cmd/allternit-api/src/vm_session_routes.rs` | VM provisioning and browser/notebook setup | Candidate environment provider; currently separate from ACU lifecycle. |

## Confirmed duplication to resolve

1. At least two Playwright session managers: Python ACU gateway and TypeScript browser-runtime.
2. Multiple request/result vocabularies: gateway Pydantic models, adapter dataclasses, MCP tools, Rust GUI tools, browser-runtime types, and frontend store events.
3. Multiple evidence paths: action recorder, observability recorder, GIF recorder, receipts, and frontend timeline state.
4. Multiple concurrency concepts: browser context isolation, parallel coordinator, hybrid adapter, run store, and adapter-local locks.
5. Multiple native input routes with different guarantees: AX, SkyLight event posting, Quartz, pyautogui, browser raw input, and frontend click-to-target.

## Required follow-up inventory

- Enumerate every process/port and startup owner.
- Enumerate every public endpoint and MCP/tool identifier.
- Trace session IDs across UI → gateway → adapter → browser/native runtime.
- Trace receipt and evidence IDs across stores.
- Identify persisted data migrations and compatibility obligations.
- Map packaging/signing/permission behavior for desktop distributions.
