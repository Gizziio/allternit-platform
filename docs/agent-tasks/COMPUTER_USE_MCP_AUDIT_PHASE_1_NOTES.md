---
status: done
files_changed: []
deviations: []
remaining:
  - "Phase 2: Implement outcome-verification metadata in cua_driver_canonical.py"
  - "Phase 2: Add background-safe delivery ladder to CuaDriverTransport"
  - "Phase 2: Implement skill save/run/list/delete via canonical provider"
  - "Phase 2: Port batch tool as canonical multi-step transaction"
  - "Phase 2: Add interference-yield check before synthetic events"
  - "Phase 2: Implement skeleton mode for get_app_state equivalent"
  - "Phase 2: Add wait_for tool to canonical provider catalog"
  - "Phase 2: Implement read_text with offset/length chunking"
  - "Phase 2: Add click_menu_item via AX menu traversal"
  - "Phase 2: Implement select_text for text range operations"
  - "Phase 2: Add page tool (CSS selector click/set_text) to canonical"
  - "Phase 3: Unify SDK/plugin/canonical tool names under upstream naming"
  - "Phase 3: Migrate browser capsule BrowserActionType to canonical ActionStep"
  - "Phase 3: Implement mobile canonical provider (Android AT-SPI)"
  - "Phase 4: Upstream contribution — propose canonical outcome contract to computer-use-mcp"
---

# Computer-Use-MCP Audit — Phase 1 Notes

## 1. Upstream Project Profile

| Field | Value |
|---|---|
| **Repo** | [minghinmatthewlam/computer-use-mcp](https://github.com/minghinmatthewlam/computer-use-mcp) |
| **Language** | Swift 6.0 |
| **Platform** | macOS 14+ |
| **License** | MIT |
| **Status** | Pre-1.0, production-ready for authors |
| **Binary** | Single signed Swift binary, no runtime deps |
| **Transport** | MCP over stdio (thin shim → shared daemon via Unix socket) |
| **Architecture** | Shared engine daemon per user; per-app leases for concurrency |

### Process Model

Clients spawn a thin stdio shim (`serve`). Tool calls forward to a **shared engine daemon** (one per user) via Unix domain socket. The daemon owns Accessibility, ScreenCaptureKit, CoreGraphics, and the agent cursor overlay. Per-app leases prevent interleaving actions from multiple sessions.

### Input Ladder (Delivery Tiers)

| Tier | Method | Background-Safe | Default |
|------|--------|-----------------|---------|
| 1 | AX Action / Attribute | ✅ | ✅ |
| 2 | Per-window CGEvent (via `CGWindowID`) | ✅ (may be ignored) | ✅ |
| 3 | Per-PID CGEvent | ✅ (may be ignored) | ✅ |
| 4 | Global session cursor/keyboard | ❌ | ❌ (opt-in only) |

Auto-escalation is prohibited. Callers must explicitly retry with escalation flags.

### Outcome Contract

Every mutating action follows **Read → Act → Re-read** verification. Four classifications:

| Classification | Meaning |
|---|---|
| `success` | Intended effect observed, or already in target state (idempotent) |
| `unsupported` | Target cannot perform the action (disabled, no settable value) |
| `effect_not_verified` | Dispatched without error but no confirming effect observed |
| `verifier_ambiguous` | Dispatched but verifier could not read enough state |

Outcome emitted in `_meta.computer-use-mcp/outcome` with `classification`, `failure_domain`, `summary`, and full `verification` block (before/after value previews, rendered_text_changed, focused_element_changed, etc.).

---

## 2. Upstream Tool Catalog (28 tools)

### Perception (6 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_app_state` | AX tree + screenshot of app window | `app`, `window_title`, `scope_element_id`, `max_elements`, `skeleton`, `ocr`, `include_screenshot` |
| `find` | Deep AX search by text query | `app`, `query`, `role`, `max_results`, `window_title` |
| `list_apps` | Running + installed apps | (none) |
| `list_windows` | All windows of an app | `app` |
| `read_text` | Full text of element (chunked) | `app`, `element_id`, `offset`, `length`, `visible_only` |
| `wait_for` | Poll until element appears/disappears | `app`, `label`, `role`, `value_contains`, `gone`, `timeout_seconds` |

### Action (11 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `click` | Click element or coordinates | `app`, `element_id` OR `x`/`y`, `click_count`, `mouse_button`, `allow_global_cursor` |
| `type_text` | Type literal text | `app`, `element_id`, `text` |
| `press_key` | Key/combo (xdotool syntax) | `app`, `key`, `allow_global_keyboard` |
| `scroll` | Scroll by direction or delta | `app`, `element_id` OR `x`/`y`, `direction`, `pages`, `delta_x`/`delta_y` |
| `drag` | Point-to-point drag | `app`, `from_x`, `from_y`, `to_x`, `to_y` |
| `set_value` | Set element value directly | `app`, `element_id`, `value` |
| `select_text` | Select text range | `app`, `element_id`, `text`, `occurrence`, `position` |
| `perform_secondary_action` | Context menu / AX actions | `app`, `element_id`, `action` |
| `click_menu_item` | Menu bar by path | `app`, `path` |
| `page` | CSS selector click/set_text | `app`, `selector`, `action`, `text`, `verify_selector`, `cdp_port` |
| `batch` | Multi-step sequence (≤10 steps) | `app`, `actions[]` |

### System (5 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `open_app` | Launch app (background by default) | `app`, `activate` |
| `open_url` | Open URL/file with handler | `url`, `allow_focus_change` |
| `manage_window` | raise/minimize/move/resize/close | `app`, `action`, `x`, `y`, `width`, `height` |
| `read_clipboard` | Read system clipboard | (none) |
| `write_clipboard` | Replace system clipboard | `text` |

### Skills (6 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `save_skill` | Freeze task into durable locators | `name`, `description`, `app`, `params`, `steps`, `overwrite` |
| `run_skill` | Replay saved skill | `name`, `params`, `start_at_step` |
| `get_skill` | Show skill definition | `name` |
| `list_skills` | List all skills | (none) |
| `delete_skill` | Remove skill | `name`, `confirm` |
| `record_skill_start` | Teach mode: capture user demo | `app` |
| `record_skill_stop` | Stop recording, return draft steps | (none) |

### Health (1 tool)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `health_report` | Runtime health, TCC, capture service | `probe_capture_service` |

### Common Parameter Conventions

- `app` — target by name or bundle ID
- `element_id` — stable ID from latest `get_app_state`
- `x`/`y` — screenshot pixel coordinates (fallback)
- `allow_global_cursor` / `allow_focus_change` — explicit escalation gates
- `confirm` — safety policy bypass for destructive actions
- `include_screenshot` / `include_state` — response size control

### MCP Tool Annotations

Every tool declares `Tool.Annotations`:
- `readOnlyHint` — true for perception/system-read tools
- `destructiveHint` — true for click, type, set_value, write_clipboard, delete_skill
- `idempotentHint` — true for read-only, open_app, select_text
- `openWorldHint` — true for app-scoped tools

---

## 3. Allternit's Existing Computer-Use Surfaces

### 3.1 Canonical Providers (`domains/computer-use/core/providers/`)

Five canonical providers implement the provider-boundary contract:

| Provider ID | Domain | Transport |
|---|---|---|
| `browser.playwright.canonical` | Browser (gateway Chromium) | Gateway HTTP |
| `browser.cdp.canonical` | Browser (CDP endpoint) | Gateway HTTP + CDP |
| `browser.extension.canonical` | Browser (extension relay) | Gateway HTTP + extension |
| `desktop.accessibility.canonical` | Desktop (AX/UIA legacy) | Legacy adapter |
| `desktop.cua-driver` | Desktop (Cua Driver binary) | JSON-RPC over local socket |

**Canonical action names:** `click`, `doubleClick`, `rightClick`, `typeText`, `setText`, `keypress`, `scroll`, `drag`, `focus`, `launchApp`, `closeApp`, `moveWindow`, `resizeWindow`, `minimizeWindow`, `maximizeWindow`, `clipboardRead`, `clipboardWrite`

**Canonical observation:** `Observation` dataclass with `state_id`, `elements: tuple[ElementNode]` (ref, role, name, value, description, bounds, states, actions, provider_metadata), `roots: tuple[Root]`, optional `image: ImageEvidence`.

**Canonical outcome:** `StepOutcome` with `status: OutcomeStatus` (`worked` / `didnt` / `unknown` / `blocked` / `cancelled`), `evidence: ActionEvidence` (grounding, delivery, details, artifact_ids).

**Contract version:** `1.0.0-alpha.1` (Python + TypeScript aligned).

### 3.2 SDK (`sdk/computer-use/`)

12 MCP tools with full JSON Schema:

| # | Tool | Maps to Upstream |
|---|------|-----------------|
| 1 | `screenshot` | ≈ `get_app_state` (screenshot only) |
| 2 | `click` | ≈ `click` |
| 3 | `type` | ≈ `type_text` |
| 4 | `scroll` | ≈ `scroll` |
| 5 | `key` | ≈ `press_key` |
| 6 | `navigate` | ≈ `open_url` (browser-specific) |
| 7 | `find_element` | ≈ `find` |
| 8 | `read_screen` | ≈ `read_text` |
| 9 | `run_code` | No upstream equivalent |
| 10 | `record_start` | ≈ `record_skill_start` |
| 11 | `record_stop` | ≈ `record_skill_stop` |
| 12 | `execute_task` | ≈ `run_skill` (but model-in-the-loop) |

**Input schemas:** All require `session_id`. Coordinate-based (x/y) or selector-based targeting.
**Output formats:** `{ screenshot, url, width, height }`, `{ success, element }`, `{ success, summary, steps }`.
**No outcome verification metadata** in the SDK output types.

### 3.3 Plugin (`packages/computer-use/plugins/allternit-computer-use/`)

14 tools (superset of SDK's 12, adds `extract` + extra params like `annotate`, `is_destructive`, `approval_policy`, `record_gif`).

MCP adapter registers only **5 of 14** tools with `cu_` prefix:
- `cu_automate`, `cu_screenshot`, `cu_extract`, `cu_record`, `cu_replay`

**Tool-name divergence:** SDK uses `click`/`type`/`key` while plugin uses same names but with extra params. MCP adapter prefixes with `cu_`. No alignment with upstream naming.

### 3.4 ACU MCP Server (`domains/computer-use/core/acu_mcp/server.py`)

11 tools via FastMCP (proxy to gateway at `localhost:8760`):
- `screenshot`, `click`, `type`, `scroll`, `key`, `navigate` — browser-focused
- `record_start`, `record_stop` — JSONL recording
- `scratchpad_read`, `scratchpad_write`, `scratchpad_reflect` — **unique** heuristic scratchpad (no upstream equivalent)

### 3.5 Canonical MCP Server (`domains/computer-use/core/canonical_mcp/server.py`)

6 provider-level tools via FastMCP:
- `computer_providers` — list capabilities
- `computer_roots` — discover browser/native roots
- `computer_observe` — immutable state-scoped observation
- `computer_approve_transaction` — single-use approval
- `computer_execute_transaction` — state-bound execution
- `computer_trajectory` — export canonical trajectory

**No action-level tools** — the canonical MCP server is an authority/approval layer, not an interaction surface.

### 3.6 Browser Capsule (`surfaces/ai.allternit.com/src/capsules/browser/`)

39 files. Rich UI for browser agent automation:
- 11 `BrowserActionType`s: `Navigate`, `Click`, `Type`, `Select`, `Scroll`, `Wait`, `Assert`, `Extract`, `Screenshot`, `Download`, `ConfirmGate`
- Risk Tiers 0–4 with policy enforcement
- 17 event types in `BrowserAgentEvent`
- Approval cards, AX tree viewer, window management, direct control mode

### 3.7 Embedded Cua Driver

- **Binary:** `surfaces/allternit-desktop/resources/computer-use/cua-driver` (v0.8.2, darwin-universal)
- **Source:** https://github.com/trycua/cua (MIT)
- **Integration:** `CuaDriverTransport` (JSON-RPC over local socket) → `CuaDriverCanonicalProvider`

### 3.8 Platform Integration (`surfaces/ai.allternit.com/src/integration/computer-use-engine.ts`)

Bridge between SDK and Next.js platform UI:
- `getPlatformComputerUseClient()` — typed client facade
- `executeGatewayAction()` — direct action execution
- Discovery helpers: `fetchGatewayWindows()`, `fetchGatewayApps()`, `fetchGatewayRoutes()`
- Re-exports canonical types: `CanonicalComputerCapabilityManifest`, `CanonicalComputerObservation`, `CanonicalComputerTransaction`, `CanonicalComputerOutcome`

---

## 4. Gap Analysis: Adopt / Fork / Ignore

### ADOPT (integrate upstream concepts into Allternit)

| Gap | Upstream Feature | Allternit Status | Priority |
|-----|-----------------|------------------|----------|
| **Outcome verification** | Read→Act→Re-read with 4 classifications in `_meta` | No verification metadata in SDK/plugin outputs; canonical `StepOutcome` has `status` but no before/after comparison | **HIGH** |
| **Background-safe delivery ladder** | AX-first, auto-escalation prohibited | Cua Driver supports AX but transport layer doesn't expose tier info | **HIGH** |
| **Interference yield** | Pause during real user input | Not implemented | **MEDIUM** |
| **Skeleton mode** | Shallow tree overview with drill-down | Not implemented | **MEDIUM** |
| **OCR fallback** | Vision OCR for sparse/custom UIs | Not implemented in canonical providers | **MEDIUM** |
| **`wait_for` polling** | Server-side element appearance polling | `BrowserActionType.Wait` exists in capsule but not in canonical providers | **MEDIUM** |
| **`batch` multi-step** | Atomic multi-action sequences | Not implemented at canonical level | **MEDIUM** |
| **`read_text` chunking** | offset/length + visible_only + markdown rendering | Not implemented | **LOW** |
| **`click_menu_item`** | Background menu bar traversal | Not implemented in canonical providers | **LOW** |
| **`select_text`** | Text range selection | Not implemented | **LOW** |
| **MCP tool annotations** | readOnlyHint, destructiveHint, etc. | Not declared in SDK/plugin tool specs | **LOW** |

### FORK (extend upstream patterns with Allternit-specific logic)

| Area | Upstream Pattern | Allternit Extension |
|------|-----------------|---------------------|
| **Skills system** | `save_skill` / `run_skill` with locator-based replay | Allternit already has `record_start`/`record_stop` + `execute_task` (model-in-loop). Fork skill concept to use canonical `ActionStep` + `StepOutcome` instead of upstream's Swift-specific locators. Replay via canonical providers rather than direct AX calls. |
| **`page` tool (CSS)** | CSS selector click/set_text for web content | Allternit's browser capsule already has CSS selector strategies. Fork into canonical provider as a browser-specific action with CDP/extension transport. |
| **Safety policy** | `confirm` param, URL deny/confirm lists, destructive labels | Allternit has `policyService.ts` with capability-based binding and risk tiers. Merge upstream's `confirm` gate into the existing policy layer as an additional MCP-level check. |
| **App lease / concurrency** | Per-app leases, daemon-level serialization | Allternit's canonical contract has `lease_id`/`holder_id` in transactions. Extend to cover per-app scoping at the provider level. |

### IGNORE (upstream features that don't fit Allternit)

| Feature | Reason to Ignore |
|---------|-----------------|
| **Swift binary** | Allternit uses Python/TypeScript/Rust. The Swift daemon is macOS-only and Allternit already has Cua Driver (Rust-based, cross-platform potential). No need to adopt the Swift binary. |
| **Daemon architecture** | Upstream uses a single-user shared daemon. Allternit's gateway architecture (`localhost:8760` FastAPI) already provides session management and multi-provider routing. Different scaling model. |
| **`health_report` tool** | Allternit's gateway has its own health/diagnostic endpoints. No need to duplicate. |
| **Global cursor overlay** | Upstream's visible agent cursor is a UX feature for standalone CLI tools. Allternit's browser capsule has `CursorOverlay.tsx` and `ACIComputerUseSidecar.tsx` which serve the same purpose in a web UI context. |
| **`open_app` / `open_url`** | These are thin wrappers around LaunchServices. Allternit's gateway already handles app launching via the desktop provider. |
| **xdotool key syntax** | Upstream uses `cmd+s` syntax. Allternit's canonical contract uses structured key representations. Keep the canonical format. |
| **`manage_window` (raise/minimize/move/resize/close)** | Already covered by canonical provider actions (`moveWindow`, `resizeWindow`, `minimizeWindow`, `maximizeWindow`). |

---

## 5. Detailed Gap Comparison

### Tool-by-Tool Mapping

| Upstream Tool | Allternit Equivalent | Gap |
|---|---|---|
| `get_app_state` | `screenshot` (SDK) + `computer_observe` (canonical) | Missing: `scope_element_id`, `max_elements`, `skeleton`, `ocr` params |
| `find` | `find_element` (SDK) | Missing: `role` filter, deep AX search beyond visible tree |
| `list_apps` | `fetchGatewayApps()` (integration) | Exists but not as MCP tool |
| `list_windows` | `fetchGatewayWindows()` (integration) | Exists but not as MCP tool |
| `read_text` | `read_screen` (SDK) | Missing: offset/length chunking, visible_only, markdown rendering |
| `wait_for` | `BrowserActionType.Wait` (capsule only) | Not in canonical providers or SDK MCP tools |
| `click` | `click` (SDK/ACU) | Missing: `click_count`, `mouse_button`, outcome verification |
| `type_text` | `type` (SDK/ACU) | Aligned at basic level; missing element_id targeting in ACU |
| `press_key` | `key` (SDK/ACU) | Different syntax (xdotool vs structured); missing global delivery opts |
| `scroll` | `scroll` (SDK/ACU) | Missing: `direction`/`pages` semantic mode, element-scoped scroll |
| `drag` | Not in SDK/ACU | `drag` exists in canonical provider actions but no MCP tool |
| `set_value` | Not in SDK/ACU | `setText` exists in canonical provider but no MCP tool |
| `select_text` | Not in SDK/ACU | Not implemented |
| `perform_secondary_action` | Not in SDK/ACU | Not implemented |
| `click_menu_item` | Not in SDK/ACU | Not implemented |
| `page` | CSS selector in capsule | Not in canonical providers as MCP tool |
| `batch` | Not in SDK/ACU | Canonical transactions support multi-step but no batch MCP tool |
| `open_app` | `launchApp` (canonical) | Not exposed as MCP tool |
| `open_url` | `navigate` (SDK/ACU) | Aligned for browser; missing for non-browser URLs |
| `manage_window` | `moveWindow`/`resizeWindow` (canonical) | Not exposed as unified MCP tool |
| `read_clipboard` / `write_clipboard` | `clipboardRead`/`clipboardWrite` (canonical) | Not exposed as MCP tools |
| `save_skill` / `run_skill` / etc. | `record_start`/`record_stop` (ACU) | Different model (JSONL recording vs locator-based replay) |
| `health_report` | Gateway health endpoints | Not as MCP tool |

### Schema & Contract Gaps

| Aspect | Upstream | Allternit | Gap |
|--------|----------|-----------|-----|
| **Element addressing** | `element_id` (generation-tagged) | `ref` (canonical ElementNode) | Naming only; semantically aligned |
| **Coordinate spaces** | 3 spaces (screenshot px, global pt, window-local pt) | Screenshot px (browser), global pt (desktop) | Missing window-local space |
| **Outcome metadata** | `_meta.computer-use-mcp/outcome` with 4 classifications | `StepOutcome.status` with 5 values (`worked`/`didnt`/`unknown`/`blocked`/`cancelled`) | Allternit lacks before/after verification block |
| **Delivery telemetry** | `_meta.computer-use-mcp/delivery` (tier, fallback, ui_changed) | `ActionEvidence.delivery` (details) | Allternit lacks delivery tier classification |
| **Safety gates** | `confirm` param + URL policy + destructive labels | `policyService.ts` + risk tiers + capability binding | Different models; Allternit's is more granular |
| **MCP annotations** | `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` | Not declared | Allternit tools lack MCP standard annotations |
| **Session model** | Per-daemon, per-app leases | `session_id` per gateway session | Aligned conceptually |
| **State tokens** | Element IDs scoped to latest snapshot | `state_id` in Observation | Aligned conceptually |

---

## 6. Integration Plan (Phase 2 Spec)

### Goal

Add an MCP-compatible computer-use tool surface to Allternit that adopts the upstream's outcome verification, delivery ladder, and tool naming while using Allternit's existing canonical provider infrastructure.

### Architecture

```
                    ┌──────────────────────────────┐
                    │   MCP Client (any LLM)       │
                    └──────────┬───────────────────┘
                               │ stdio / SSE
                    ┌──────────▼───────────────────┐
                    │   Unified MCP Server          │
                    │   (Python, FastMCP)            │
                    │                                │
                    │   Tool catalog: 20 tools       │
                    │   Outcome verification layer   │
                    │   Delivery ladder adapter      │
                    │   Safety gate (merge both)     │
                    └──────────┬───────────────────┘
                               │ canonical transactions
                    ┌──────────▼───────────────────┐
                    │   Canonical Router             │
                    │   (existing gateway)           │
                    └──────────┬───────────────────┘
                     ┌─────────┼─────────┬──────────┐
                     ▼         ▼         ▼          ▼
                 Playwright  CDP    Extension   CUA Driver
```

### Phase 2 Work Items

#### 2.1 Outcome Verification Layer (HIGH priority)

**What:** Wrap every canonical provider action with Read→Act→Re-read verification.

**Where:** `domains/computer-use/core/providers/*.py` — add `verify_outcome()` method to each canonical provider.

**Contract:** Return `OutcomeVerification` alongside `StepOutcome`:
```python
@dataclass
class OutcomeVerification:
    classification: Literal["success", "unsupported", "effect_not_verified", "verifier_ambiguous"]
    failure_domain: Optional[str]  # targeting | unsupported | coercion | transport | verification
    summary: str
    before_value_preview: Optional[str]
    after_value_preview: Optional[str]
    before_selected: Optional[bool]
    after_selected: Optional[bool]
    rendered_text_changed: bool
    focused_element_changed: bool
    window_title_changed: bool
    target_state_changed: bool
```

**Integration:** Emit in MCP response `_meta` block as `allternit-computer-use/outcome`.

#### 2.2 Delivery Ladder Adapter (HIGH priority)

**What:** Expose delivery tier information in CuaDriverTransport responses.

**Where:** `domains/computer-use/core/providers/cua_driver_transport.py`

**Changes:**
- Parse Cua Driver response for delivery method used
- Map to tiers: `ax_action` → `per_window_event` → `per_pid_event` → `global_cursor`
- Emit in `_meta.allternit-computer-use/delivery`: `{ delivery_tier, fallback_reasons, ui_changed }`
- Add `allow_global_cursor` and `allow_focus_change` params to action tools (default false)

#### 2.3 Unified MCP Server (HIGH priority)

**What:** Merge `acu_mcp/server.py` and `canonical_mcp/server.py` into a single unified server with the full upstream-aligned tool catalog.

**Where:** `domains/computer-use/core/unified_mcp/server.py` (new)

**Tool catalog (20 tools):**

| # | Tool Name | Source | Transport |
|---|-----------|--------|-----------|
| 1 | `get_app_state` | New (canonical observe + screenshot) | Canonical provider |
| 2 | `find` | New (deep AX search) | Canonical provider |
| 3 | `list_apps` | New (gateway discovery) | Gateway |
| 4 | `list_windows` | New (gateway discovery) | Gateway |
| 5 | `read_text` | New (chunked text read) | Canonical provider |
| 6 | `wait_for` | New (server-side polling) | Canonical provider |
| 7 | `click` | Existing (SDK `click`) | Canonical provider |
| 8 | `type_text` | Existing (SDK `type`) | Canonical provider |
| 9 | `press_key` | Existing (SDK `key`) | Canonical provider |
| 10 | `scroll` | Existing (SDK `scroll`) | Canonical provider |
| 11 | `drag` | New (canonical action) | Canonical provider |
| 12 | `set_value` | New (canonical `setText`) | Canonical provider |
| 13 | `select_text` | New | Canonical provider |
| 14 | `perform_secondary_action` | New | Canonical provider |
| 15 | `click_menu_item` | New | Canonical provider |
| 16 | `page` | New (CSS selector) | Browser canonical |
| 17 | `batch` | New (multi-step transaction) | Canonical router |
| 18 | `open_app` | New (canonical `launchApp`) | Desktop canonical |
| 19 | `open_url` | Existing (SDK `navigate`) | Browser canonical |
| 20 | `manage_window` | New (unified window ops) | Desktop canonical |

Plus 6 canonical authority tools (keep existing):
- `computer_providers`, `computer_roots`, `computer_observe`, `computer_approve_transaction`, `computer_execute_transaction`, `computer_trajectory`

Plus 3 scratchpad tools (keep existing):
- `scratchpad_read`, `scratchpad_write`, `scratchpad_reflect`

#### 2.4 Safety Gate Merge (MEDIUM priority)

**What:** Merge upstream's `confirm` param with Allternit's `policyService.ts` risk tiers.

**Logic:**
1. Tool declares `destructiveHint` in MCP annotations
2. If action matches destructive pattern (Delete button, password field, URL deny list) → require `confirm: true`
3. If action matches risk tier ≥ 3 → require approval via canonical `computer_approve_transaction`
4. Both gates must pass independently

#### 2.5 Skeleton Mode & OCR (MEDIUM priority)

**What:** Add `skeleton` and `ocr` params to `get_app_state`.

**Skeleton:** Shallow AX tree walk; collapse deep containers to `{role, children_count, element_id}`. Drill-down via `scope_element_id`.

**OCR:** Use macOS Vision framework (via Cua Driver) or a cross-platform OCR library for non-macOS providers. Return `{text, bounds}[]` alongside AX tree.

#### 2.6 Interference Yield (MEDIUM priority)

**What:** Check for recent real user input before dispatching synthetic events to the target app.

**Where:** `domains/computer-use/core/providers/cua_driver_transport.py` — pre-dispatch check.

**Implementation:** Query Cua Driver for last HID event timestamp in target app. If < `interference_idle_seconds` (default 1s), return recoverable error. Configurable via env var.

#### 2.7 Batch Tool (MEDIUM priority)

**What:** Atomic multi-step action sequences.

**Where:** `domains/computer-use/core/unified_mcp/batch.py` (new)

**Logic:**
1. Validate all steps against canonical contract
2. Acquire app lease
3. Execute steps sequentially with per-step verification
4. Stop at first failure; report completed steps
5. Final step returns full state

#### 2.8 Skills System (LOW priority, Phase 3)

**What:** Port upstream's teach-and-replay skills using canonical `ActionStep` + locator-based replay.

**Model:** `save_skill` freezes a sequence of canonical `ActionStep`s with durable locators (role + name + tree path). `run_skill` re-resolves locators against live observations and executes without model in the loop.

**Storage:** JSON files under `~/.allternit/skills/` or gateway-managed.

#### 2.9 Tool Name Unification (LOW priority, Phase 3)

**What:** Align SDK/plugin/canonical tool names with upstream naming.

| Current | Proposed |
|---------|----------|
| `screenshot` | `get_app_state` (with `include_screenshot` control) |
| `type` | `type_text` |
| `key` | `press_key` |
| `find_element` | `find` |
| `read_screen` | `read_text` |
| `navigate` | `open_url` |

Deprecate `cu_` prefix in MCP adapter. Register all 20+ tools with canonical names.

#### 2.10 BrowserActionType Alignment (LOW priority, Phase 3)

**What:** Migrate browser capsule's 11 `BrowserActionType`s to canonical `ActionStep` actions.

**Mapping:**
| BrowserActionType | Canonical Action |
|---|---|
| `Navigate` | `navigate` |
| `Click` | `click` |
| `Type` | `typeText` |
| `Select` | `select_text` (new) |
| `Scroll` | `scroll` |
| `Wait` | (wait_for — new canonical) |
| `Assert` | (verification layer) |
| `Extract` | `read_text` + structured parse |
| `Screenshot` | `get_app_state` |
| `Download` | (gateway-specific) |
| `ConfirmGate` | `computer_approve_transaction` |

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Upstream schema instability (pre-1.0) | Medium | Medium | Pin to specific commit; abstract behind canonical contract |
| Cua Driver doesn't support all upstream features (skeleton, OCR) | High | Low | Implement as gateway-level post-processing; Cua Driver handles AX only |
| Tool name changes break existing SDK/plugin consumers | Medium | High | Deprecation period with aliases; versioned MCP server |
| Outcome verification adds latency (extra AX read per action) | High | Medium | Make optional via `verify: false` param; cache where possible |
| Interference yield causes false positives | Low | Low | Configurable threshold; disable via env var |

---

## 8. Recommendations

1. **Start with Phase 2.1 (Outcome Verification)** — highest value-add, minimal surface change. Adds trust to every action without changing tool names or adding new tools.

2. **Phase 2.3 (Unified MCP Server)** is the structural keystone. Merging the two Python MCP servers eliminates confusion and creates a single entry point for any MCP client.

3. **Don't fork the Swift binary.** Allternit's Cua Driver (Rust, from `trycua/cua`) is the right native layer. The upstream Swift project is a useful reference for contracts and tool design, not for code.

4. **Adopt upstream tool names** (Phase 2.9) but keep Allternit's canonical contract as the internal source of truth. The upstream names are already the de facto standard for MCP computer-use tools.

5. **The canonical contract is Allternit's moat.** The upstream project has no approval/transaction/trajectory layer. Allternit's `computer_approve_transaction` + `computer_execute_transaction` + `computer_trajectory` is a significant advantage for enterprise use. Keep this as a differentiating layer above the interaction tools.
