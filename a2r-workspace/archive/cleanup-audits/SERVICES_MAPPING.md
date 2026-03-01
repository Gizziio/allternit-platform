# SERVICES MAPPING DOCUMENT

Mapping of services from the old services/ directory to the new 4-services/ layer structure.

## Current Services in 4-services/:

### Gateway Services (Routing & API Management)
- `a2a-gateway` → 4-services/gateway/a2a-gateway/ (AI-to-Agent gateway)
- `agui-gateway` → 4-services/gateway/agui-gateway/ (AGUI gateway)
- `gateway-browser` → 4-services/gateway/browser/ (Browser gateway)
- `gateways` → 4-services/gateway/aggregate/ (Multiple gateway aggregator)
- `gateway-service` → 4-services/gateway/main/ (Main gateway service)
- `python-gateway` → 4-services/gateway/python/ (Python gateway)

### Runtime Services (Execution & Orchestration)
- `browser-runtime` → 4-services/runtime/browser/ (Browser runtime environment)
- `capsule-runtime` → 4-services/runtime/capsule/ (Capsule runtime)
- `copilot-runtime` → 4-services/runtime/copilot/ (Copilot runtime)
- `superconductor` → 4-services/runtime/superconductor/ (Superconductor runtime)
- `webvm-service` → 4-services/runtime/webvm/ (WebVM service)

### Orchestration & Control Services
- `control-plane` → 4-services/orchestration/control-plane/ (System control plane)
- `framework` → 4-services/orchestration/framework/ (Application framework)
- `platform` → 4-services/orchestration/platform/ (Platform services)
- `router-service` → 4-services/orchestration/router/ (Request routing)
- `kernel-service` → 4-services/orchestration/kernel/ (Kernel service)

### State & Memory Services
- `state` → 4-services/memory/state/ (State management)
- `memory` → 4-services/memory/main/ (Memory services)
- `observation` → 4-services/memory/observation/ (Observation services)

### AI & Intelligence Services
- `voice-service` → 4-services/ai/voice/ (Voice processing)
- `pattern-recognizer` → 4-services/ai/pattern-recognizer/ (Pattern recognition)
- `pattern-service` → 4-services/ai/pattern-service/ (Pattern services)

### UI & Interface Services
- `ui-tars-operator` → 4-services/ui/ui-tars-operator/ (UI-TARS operator)
- `canvas-monitor` → 4-services/ui/canvas-monitor/ (Canvas monitoring)

### Infrastructure Services
- `io-daemon` → 4-services/infrastructure/io-daemon/ (IO operations)
- `compute` → 4-services/infrastructure/compute/ (Compute services)
- `ux` → 4-services/infrastructure/ux/ (User experience services)

### Session & Communication Services
- `browser-session-service` → 4-services/session/browser-session/ (Browser session management)
- `copilot-runtime` → 4-services/session/copilot/ (Copilot session management)

### Specialized Services
- `compute` → 4-services/specialized/compute/ (Compute operations)
- `local-inference` → 4-services/specialized/local-inference/ (Local inference)
- `state` → 4-services/specialized/state/ (State management)

## Recommended Subfolder Organization in 4-services/:

```
4-services/
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

This organization provides clear separation of concerns while maintaining the 4-services/ layer as the single location for all long-running processes and daemons.