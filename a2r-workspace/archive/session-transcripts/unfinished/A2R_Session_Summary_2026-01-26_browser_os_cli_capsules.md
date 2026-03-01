# A2rchitech Session Summary (A2R) — Browser-OS + CLI + Agentic Runtime (Contracts / Capsules / Tools)

**Session command:** gizzi save a2r session  
**Date (America/Chicago):** January 26, 2026  
**Scope:** Consolidate this session’s decisions, idealized architecture, implementation plan, and integration-first OSS candidates so we don’t lose focus.

---

## 0) What triggered this session

You asked for a better “game plan” because “UI” could mean:
- cloud web console
- terminal-first CLI
- desktop app
- full operating system

You chose: **Web console + CLI now**, while preserving a long-term **OS-like control plane** vision that can later span cloud, sovereign local, and edge/IoT/robot contexts.

---

## 1) Top-level thesis we converged on

### 1.1 The OS is not the UI
- The “OS” is the **contract-enforced runtime and governance layer**, not the visual shell.
- The web console and CLI are **shells / gateways** into the same underlying primitives.

### 1.2 The “Browser-OS” is a desktop shell in the browser
- “Desktop OS in browser” = a **workspace shell** (ClickUp-like) with panes and modes:
  - **Authoring mode**
  - **Ops mode**
  - **Shell mode** (terminal + assistant)
- It can embed a terminal and later embed WebVM replay/sandbox as a plugin.

### 1.3 The real unifier is Capsule
- **Capsule** becomes the unit of deployment across:
  - cloud runner (ship first)
  - WebVM replay/sandbox (later)
  - edge agents (later)
- This avoids “ISO images” distribution and matches “web distribution” logic for devices.

---

## 2) The key primitives (your “OS kernel invariants”)

These primitives are the non-negotiable backbone that make it OS-like:

1. **ToolABI** (Unix-style “syscall interface”)
   - Stable, versioned interface for tools.
   - Tools must be dynamically discoverable at runtime.
   - Each tool declares required capabilities.

2. **Capsule**
   - Signed, content-addressed package.
   - Includes workflow definitions + tool references + policies + context hash + signatures.
   - Must be deterministic and replayable.

3. **PolicyDecision**
   - Every tool call is gated by policy (deny-by-default).
   - Policy decisions are artifacts and appear in timelines/audit.

4. **VerifyArtifacts**
   - Code signing/integrity for capsules and artifacts.
   - Gate execution on verification.

5. **EventEnvelope / Event Ledger**
   - Append-only event stream for runs, tool invocations, policy checks, artifacts.
   - Drives audit, replay, debugging, and UI timelines.

6. **RunModel**
   - Process lifecycle for a run (start/stop/status/targets).
   - Runs emit events and produce verifiable artifacts.

---

## 3) The product surface: Browser-OS shell + CLI

### 3.1 Modes (the desktop-shell model)

**Authoring Mode**
- Workflow/capsule editor: YAML + schema validation + compile errors inline.
- Persona + task template editors (schema-driven).
- “Validate” / “Compile” / “Build Capsule” actions wired to API.

**Ops Mode**
- Runs dashboard: list/filter.
- Run detail: event timeline, tool invocations, artifacts, verification results, policy decisions.
- Audit log view.
- Device/fleet view can be stubbed early, expanded later.

**Shell Mode**
- Persistent terminal (first-class).
- Persistent “Gizzi” assistant pane.
- Voice capture and “action execution” with confirmations.

### 3.2 CLI parity rule
- Anything you can do in UI should be doable in CLI:
  - validate/build capsules
  - register/list tools
  - start/inspect runs
  - tail event stream
- CLI and UI must produce the same event semantics.

---

## 4) WebVM / Browser-OS angle: what it realistically adds

### 4.1 WebVM is not the product
It is a **sandbox / replay engine** that plugs into the shell.

Best uses:
- **Deterministic replay** of runs (“flight recorder” playback).
- **Capsule preview**: open a capsule in a safe environment before deploying to a fleet.
- Support/debug: reproduce failures in-browser without local setup.

### 4.2 Digital twins and replay debugger
- Each device/agent has a “digital twin” in Ops view.
- WebVM can replay exact context + event stream from a run snapshot.

### 4.3 Connectivity reality
We decided: do **always-connected** for browser shell v1.
Intermittent support is still planned for edge agents via:
- local queues
- store-and-forward
- signed envelopes
- idempotent commands

---

## 5) The critical architectural tension: compiled tools vs runtime tool recognition

You identified a major issue:
- If tools are compiled into runtime, agents cannot add tools dynamically.

We resolved with a **two-class tool system**:

### Class A: Kernel tools (built-in, Rust)
Security-critical primitives:
- verification
- policy evaluation hooks
- event ledger writer
- capsule resolver
- core registry plumbing

### Class B: Extensible tools (dynamic, runtime-discoverable)
Loaded/recognized at runtime via Tool Registry:
- WASM tools (preferred future plugin format)
- external services (Python “skills gateway”, HTTP/gRPC)
- cloud jobs/containers for heavy dependencies

Rule: **No kernel rebuild required** to add a new tool.

---

## 6) WASM vs Rust vs Python (decisions and rationale)

### 6.1 Keep Rust
Yes:
- Rust is best for the trust boundary: verification, policy, event ingest, capsule tooling, edge runtime.
- It also keeps the door open for strong WASM hosting later.

### 6.2 Is WASM necessary right now?
- **Not necessary for MVP-1**.
- But: you must **design the ToolABI and capsule schema now** to support WASM later **without refactor**.

Practical rule:
- **Design for WASM now; execute WASM later.**

### 6.3 Python integration
Yes, but:
- Python should be an **external Skills Gateway**, not embedded in the kernel trust boundary.
- Python is best for speed and breadth of integrations.
- All calls must be ToolABI mediated, policy checked, and event logged.

Trust boundary rule:
- **Inside trust boundary:** Rust/WASM only  
- **Outside trust boundary:** Python and other services as tool providers

---

## 7) Voice + Gizzi assistant + terminal “futurism” (but safety-first)

### 7.1 Terminal becomes an action console
- Browser terminal is persistent per workspace/tenant.
- Gizzi assistant runs side-by-side:
  - summarizes runs
  - proposes actions
  - explains failures using event stream context

### 7.2 Voice I/O pipeline (safe)
- Voice capture → STT transcript.
- Assistant interprets transcript and produces either:
  - response
  - proposed actions (structured)
- High-risk actions require confirmation.
- Actions execute through a restricted **Action API** (not arbitrary tool execution).
- Everything emits events and audit artifacts.

### 7.3 Orb/waveform UI
Not “eye candy”; it is a state machine indicator:
- Idle / Listening / Thinking / Acting / Speaking
Driven by real pipeline state.

---

## 8) Decisions we locked to avoid scope explosion

**Ship order:** Cloud runner first  
**Connectivity (v1):** Always-connected  
**Local connector daemon (v1):** Defer

Rationale:
- Cloud runner makes “real work” happen now.
- Offline-first browser shell introduces major complexity (sync, auth, policy offline).
- Local connector daemon expands attack surface (USB/FS/BLE/camera) and should come after policy/verify maturity.

---

## 9) MVP sequencing (the plan)

### MVP-1: Browser-OS shell + CLI + cloud runs (no WebVM execution yet)
Goal: it already feels like an OS.

Deliver:
- Shell with modes (Authoring/Ops/Shell)
- Terminal panel (web PTY)
- Capsule registry basics (upload/list/inspect)
- Runs: start/stop/status + live event stream timeline
- Artifacts view: list + verify status
- Policy decisions surfaced (even if minimal)
- Gizzi text assistant integrated in Shell Mode
- Voice v0: capture → transcript displayed (no auto actions yet)

### MVP-2: Strict capsule lifecycle + assistant actions
Deliver:
- Capsule build/verify required to run
- Deny-by-default policy enforcement
- Action API for assistant (safe subset)
- Voice v1: speech → action suggestions → confirm → execute → audit

### MVP-3: WebVM replay plugin
Deliver:
- “Replay run” loads capsule snapshot + event stream in WebVM
- Read-only step-through debugger
- Optional stubs/mocks to re-execute deterministically later

---

## 10) Integration-first: OSS projects we identified to avoid building from scratch

> These are the categories we agreed to use; final selection should be pinned as submodules/forks.

**Browser shell / web console**
- Open WebUI (fast “OS shell” baseline) — fork + convert to modes
- Alternative: Next.js SaaS shells/admin templates if you want lighter baseline

**Terminal in browser**
- xterm.js + backend PTY bridge (ttyd/wetty or your own WS PTY)

**WebVM / sandbox**
- WebVM (leaningtech/webvm) as replay/sandbox substrate

**Capsule signing / distribution**
- Sigstore/cosign for signing
- ORAS for OCI artifact distribution (capsules as OCI artifacts)

**Event streaming / ledger**
- NATS (+ JetStream) as event bus + persistence (or equivalent)

**Policy engine**
- OPA (Open Policy Agent) as policy core (or equivalent), integrated as PolicyDecisionArtifact generator

**Assistant orchestration**
- LangGraph-style graph orchestration for safe action planning (optional; can be minimal at first)

**Voice**
- whisper.cpp (STT) + Coqui TTS (open) as sovereign options
- ElevenLabs as premium drop-in later

**Automation**
- Playwright for browser automation (gated)
- Home Assistant for device control (gated, later phase)

---

## 11) The “do not drift” rules we established

1) Everything is a capsule or a tool.  
2) Everything emits events to the ledger.  
3) Every tool invocation is policy-gated.  
4) UI/CLI/voice all call the same Action layer.  
5) New tools must be recognized at runtime without kernel rebuild.  
6) Rust/WASM in trust boundary; Python is external tool provider.  
7) Cloud runner first; WebVM replay later; local connector daemon later.

---

## 12) Immediate execution checklist (what to implement first)

### A) Lock contracts (prevents refactor later)
- ToolABI schema v0 (WIT-shaped)
- Capsule manifest schema v0 (payload types: service/container/wasm stub)
- EventEnvelope schema v0
- PolicyDecision schema v0
- VerifyArtifacts requirements

### B) Kernel services (Rust)
- Tool Registry service (register/list/resolve)
- Capsule service (store/verify/inspect)
- Policy gate service (deny-by-default)
- Event ledger service (append-only, stream)
- Run dispatcher to cloud runner

### C) CLI
- `capsule build/verify/inspect`
- `tool register/list`
- `run start/inspect/tail`

### D) Browser-OS shell
- Mode switch + workspace tree
- Terminal panel
- Ops timeline viewer (events)
- Capsules list/detail
- Runs list/detail

### E) Gizzi + voice v0
- assistant pane contextual to workspace/run
- voice capture → transcript (no auto actions yet)

---

## 13) Open questions we did not need to resolve yet (but tracked)

- Exact UI base fork: Open WebUI vs a Next.js template baseline.
- Exact event storage backing (NATS JetStream vs DB + pubsub).
- Whether to adopt OCI artifacts for capsules immediately or start with tar.zst and migrate.
- When to introduce WASM tool execution (planned after MVP-1/2 once contracts stabilize).
- When to add local connector daemon + capability prompts.

---

## 14) Outcome of the session (one sentence)

We aligned on shipping a **desktop-like Browser-OS shell + CLI** as the human gateway, while implementing the real agentic OS as a **contract-enforced kernel** centered on **Capsules + ToolABI + Policy + Verify + Event Ledger**, designed for WASM extensibility without forcing WASM execution in MVP-1.
