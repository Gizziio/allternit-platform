# SERVICES MAPPING DOCUMENT

Mapping of services from the old services/ directory to the new services/ layer structure.

## Current Services in services/:

### Gateway Services (Routing & API Management)
- `a2a-gateway` → services/gateway/a2a-gateway/ (AI-to-Agent gateway)
- `agui-gateway` → services/gateway/agui-gateway/ (AGUI gateway)
- `gateway-browser` → services/gateway/browser/ (Browser gateway)
- `gateways` → services/gateway/aggregate/ (Multiple gateway aggregator)
- `gateway-service` → services/gateway/main/ (Main gateway service)
- `python-gateway` → services/gateway/python/ (Python gateway)

### Runtime Services (Execution & Orchestration)
- `browser-runtime` → services/runtime/browser/ (Browser runtime environment)
- `capsule-runtime` → services/runtime/capsule/ (Capsule runtime)
- `copilot-runtime` → services/runtime/copilot/ (Copilot runtime)
- `superconductor` → services/runtime/superconductor/ (Superconductor runtime)
- `webvm-service` → services/runtime/webvm/ (WebVM service)

### Orchestration & Control Services
- `control-plane` → services/orchestration/control-plane/ (System control plane)
- `framework` → services/orchestration/framework/ (Application framework)
- `platform` → services/orchestration/platform/ (Platform services)
- `router-service` → services/orchestration/router/ (Request routing)
- `kernel-service` → services/orchestration/kernel/ (Kernel service)

### State & Memory Services
- `state` → services/memory/state/ (State management)
- `memory` → services/memory/main/ (Memory services)
- `observation` → services/memory/observation/ (Observation services)

### AI & Intelligence Services
- `voice-service` → services/ai/voice/ (Voice processing)
- `pattern-recognizer` → services/ai/pattern-recognizer/ (Pattern recognition)
- `pattern-service` → services/ai/pattern-service/ (Pattern services)

### UI & Interface Services
- `ui-tars-operator` → services/ui/ui-tars-operator/ (UI-TARS operator)
- `canvas-monitor` → services/ui/canvas-monitor/ (Canvas monitoring)

### Infrastructure Services
- `io-daemon` → services/infrastructure/io-daemon/ (IO operations)
- `compute` → services/infrastructure/compute/ (Compute services)
- `ux` → services/infrastructure/ux/ (User experience services)

### Session & Communication Services
- `browser-session-service` → services/session/browser-session/ (Browser session management)
- `copilot-runtime` → services/session/copilot/ (Copilot session management)

### Specialized Services
- `compute` → services/specialized/compute/ (Compute operations)
- `local-inference` → services/specialized/local-inference/ (Local inference)
- `state` → services/specialized/state/ (State management)

## Recommended Subfolder Organization in services/:

```
services/
├── gateway/           # All gateway services
│   ├── a2a-gateway/
│   ├── agui-gateway/
│   ├── browser/
│   ├── main/ (gateway-service)
│   ├── python/
│   └── aggregate/ (gateways)
├── runtime/           # All runtime services
│   ├── browser/
│   ├── capsule/
│   ├── copilot/
│   ├── superconductor/
│   └── webvm/
├── orchestration/     # Orchestration and control
│   ├── control-plane/
│   ├── framework/
│   ├── platform/
│   └── router/ (router-service)
├── memory/            # State and memory services
│   ├── state/
│   ├── main/ (memory)
│   └── observation/
├── ai/                # AI and intelligence services
│   ├── voice/ (voice-service)
│   ├── pattern-recognizer/
│   └── pattern-service/
├── ui/                # UI-related services
│   ├── ui-tars-operator/
│   └── canvas-monitor/
├── infrastructure/    # Infrastructure services
│   ├── io-daemon/
│   ├── compute/
│   └── ux/
└── session/           # Session management
    ├── browser-session/
    └── copilot/
```

## Migration Notes:
- `kernel-service` is already in the orchestration category as it relates to kernel operations
- `router-service` is already in the orchestration category as it handles routing
- `capsule-runtime` is already in the runtime category as it manages capsule execution
- `browser-runtime` is already in the runtime category as it manages browser execution
- `voice-service` is already in the AI category as it handles voice processing
- `ui-tars-operator` is already in the UI category as it manages UI-TARS

This organization provides clear separation of concerns while maintaining the services/ layer as the single location for all long-running processes and daemons.