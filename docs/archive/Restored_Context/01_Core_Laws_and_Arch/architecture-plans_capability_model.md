### Capability Model (Derived from Atlas Capability Matrix)

#### Kernel capabilities
- Capability: Kernel HTTP API
  - Status: implemented
  - Evidence: services/kernel/src/main.rs
  - Owner component: services/kernel/src/main.rs
  - Dependency notes: UNSTATED in Atlas.
- Capability: Brain sessions + SSE streams
  - Status: implemented
  - Evidence: services/kernel/src/main.rs, services/kernel/src/brain/types.rs
  - Owner component: services/kernel/src/main.rs
  - Dependency notes: UNSTATED in Atlas.
- Capability: CLI brain PTY runtime
  - Status: partial
  - Evidence: services/kernel/src/brain/drivers/cli.rs, services/kernel/src/terminal_manager.rs
  - Owner component: services/kernel/src/brain/drivers/cli.rs
  - Dependency notes: UNSTATED in Atlas.
- Capability: Tool gateway with policy gating
  - Status: implemented
  - Evidence: crates/kernel/tools-gateway/src/lib.rs
  - Owner component: crates/kernel/tools-gateway/src/lib.rs
  - Dependency notes: UNSTATED in Atlas.
- Capability: Workflow engine + DAG
  - Status: implemented
  - Evidence: crates/orchestration/workflows/src/lib.rs
  - Owner component: crates/orchestration/workflows/src/lib.rs
  - Dependency notes: UNSTATED in Atlas.

#### Runtime capabilities
- Capability: WebVM service
  - Status: implemented
  - Evidence: services/webvm-service/src/main.rs
  - Owner component: services/webvm-service/src/main.rs
  - Dependency notes: UNSTATED in Atlas.
- Capability: Voice service
  - Status: implemented
  - Evidence: services/voice-service/api/main.py
  - Owner component: services/voice-service/api/main.py
  - Dependency notes: UNSTATED in Atlas.
- Capability: UI-TARS operator
  - Status: partial
  - Evidence: services/ui-tars-operator/src/main.py
  - Owner component: services/ui-tars-operator/src/main.py
  - Dependency notes: UNSTATED in Atlas.
- Capability: Browser runtime (Playwright)
  - Status: implemented
  - Evidence: services/browser-runtime/src/index.ts, services/browser-runtime/src/browser.ts
  - Owner component: services/browser-runtime/src/index.ts
  - Dependency notes: UNSTATED in Atlas.
- Capability: A2A gateway
  - Status: implemented
  - Evidence: services/a2a-gateway/src/index.ts
  - Owner component: services/a2a-gateway/src/index.ts
  - Dependency notes: UNSTATED in Atlas.
- Capability: AGUI gateway
  - Status: implemented
  - Evidence: services/agui-gateway/src/index.ts
  - Owner component: services/agui-gateway/src/index.ts
  - Dependency notes: UNSTATED in Atlas.
- Capability: Superconductor parallel runs
  - Status: partial
  - Evidence: services/superconductor/src/main.py
  - Owner component: services/superconductor/src/main.py
  - Dependency notes: UNSTATED in Atlas.
- Capability: Python tool execution gateway
  - Status: implemented
  - Evidence: services/python-gateway/main.py
  - Owner component: services/python-gateway/main.py
  - Dependency notes: UNSTATED in Atlas.
- Capability: WASM sandbox runtime
  - Status: partial
  - Evidence: crates/kernel/wasm-runtime/README.md
  - Owner component: crates/kernel/wasm-runtime/README.md
  - Dependency notes: UNSTATED in Atlas.

#### UI/Studio capabilities
- Capability: Shell UI window manager
  - Status: partial
  - Evidence: apps/shell/src/components/windowing/WindowManager.tsx
  - Owner component: apps/shell/src/components/windowing/WindowManager.tsx
  - Dependency notes: UNSTATED in Atlas.
- Capability: Electron desktop shell
  - Status: partial
  - Evidence: apps/shell-electron/main/index.cjs
  - Owner component: apps/shell-electron/main/index.cjs
  - Dependency notes: UNSTATED in Atlas.

#### Memory capabilities
- Capability: Memory fabric + retention policy
  - Status: partial
  - Evidence: services/state/memory/src/lib.rs
  - Owner component: services/state/memory/src/lib.rs
  - Dependency notes: UNSTATED in Atlas.
- Capability: Memory maintenance daemon
  - Status: stub
  - Evidence: services/kernel/src/memory_maintenance_daemon.rs
  - Owner component: services/kernel/src/memory_maintenance_daemon.rs
  - Dependency notes: UNSTATED in Atlas.

#### Skills/Marketplace capabilities
- Capability: Skill manifest + registry
  - Status: implemented
  - Evidence: crates/skills/src/lib.rs
  - Owner component: crates/skills/src/lib.rs
  - Dependency notes: UNSTATED in Atlas.

#### Uncategorized capabilities (Atlas)
- Capability: Cloud LLM drivers (Gemini/Anthropic) | Status: implemented | Evidence: services/kernel/src/brain/drivers/api.rs
- Capability: Local LLM driver (Ollama) | Status: partial | Evidence: services/kernel/src/brain/drivers/local.rs