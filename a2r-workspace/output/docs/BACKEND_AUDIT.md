# Backend Service Wiring Audit Report
**Date:** 2026-02-06  
**Auditor:** A2rchitect System  
**Scope:** All backend services with main.rs/main.py entry points

---

## Executive Summary

| Status | Count | Services |
|--------|-------|----------|
| **Wired (Core)** | 10 | Policy, Audit, Memory, Observation, Registry, Kernel, Capsule, API, Gateway, Shell |
| **Optional** | 3 | Voice, Executor, WebVM |
| **Library (No Binary)** | 6 | Framework-Registry, Registry-Apps, Registry-Functions, Hooks, IO-Daemon, Router-Lib |
| **Deprecated** | 15 | All duplicate gateways, Old capsule, Superconductor, Operator, A2A-Gateway, etc. |
| **Total** | **34** | All discovered services |

---

## Core Services (Wired) - 10 Services

| # | Service | Port | Path | Status |
|---|---------|------|------|--------|
| 1 | **policy** | 3003 | `2-governance/policy/` | ✅ Active |
| 2 | **audit-log** | 3103 | `2-governance/audit-log/` | ✅ Wired |
| 3 | **memory** | 3200 | `4-services/memory/` | ✅ Active |
| 4 | **observation** | 3112 | `4-services/memory/observation/` | ✅ Wired |
| 5 | **registry** | 8080 | `4-services/registry/registry-server/` | ✅ Active |
| 6 | **kernel** | 3004 | `4-services/orchestration/kernel-service/` | ✅ Active (localhost only) |
| 7 | **capsule-runtime** | 3006 | `4-services/runtime/capsule-runtime/` | ✅ Wired |
| 8 | **api** | 3000 | `6-apps/api/` | ✅ Active |
| 9 | **gateway** | 8013 | `4-services/gateway/` | ✅ Active (public entry) |
| 10 | **shell-electron** | - | `6-apps/shell-electron/` | ✅ Active |

**Configuration:** `.a2r/services.complete.json`

---

## Optional Services (Available) - 3 Services

| # | Service | Port | Path | Purpose |
|---|---------|------|------|---------|
| 1 | **voice** | 8001 | `4-services/ai/voice-service/` | TTS/Voice synthesis |
| 2 | **executor** | 3510 | `1-kernel/compute/executor/` | Distributed compute |
| 3 | **webvm** | 8002 | `3-adapters/bridges/a2r-webvm/` | WebAssembly bridge |

---

## Library Services (No Binary) - 6 Services

These are **called as libraries** by other services, not standalone:

| # | Service | Path | Called By |
|---|---------|------|-----------|
| 1 | framework-registry | `4-services/registry/framework-registry/` | API, Kernel |
| 2 | registry-apps | `4-services/registry/registry-apps/` | API |
| 3 | registry-functions | `4-services/registry/registry-functions/` | API |
| 4 | hooks | `4-services/orchestration/hooks/` | Kernel, Runtime |
| 5 | io-daemon | `3-adapters/bridges/io-daemon/` | Kernel |
| 6 | router-lib | `4-services/gateway/router-service/src/lib.rs` | Gateway |

**Action:** No wiring needed - they compile as dependencies.

---

## Deprecated Services (Moved to .deprecated/) - 15 Services

These were **consolidated** into the unified gateway:

| Category | Services |
|----------|----------|
| **Gateways** | gateway-browser, gateway-stdio, python-gateway, a2a-gateway, agui-gateway |
| **Registries** | framework-registry-server (old), registry-apps-server (old) |
| **Runtime** | superconductor |
| **Operator** | a2r-operator |
| **Router** | router-service (standalone) |
| **Inference** | local-inference, local-inference2, mlx-inference |
| **Other** | capsule-runtime (old), pattern-service |

**Location:** `.deprecated/` directory

---

## Architecture Enforcement

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Shell Electron │  │  External Apps  │  │     CLI         │  │
│  │     (UI)        │  │   (API Keys)    │  │   (Scripts)     │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            └────────────────────┼────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GATEWAY (Port 8013)                        │
│              Auth, Rate Limiting, CORS, Routing                 │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API (Port 3000)                          │
│              Business Logic, Orchestration Layer                │
└────────────────────────────────┬────────────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Policy (3003) │    │  Registry     │    │   Memory      │
│ Authorization │    │   (8080)      │    │   (3200)      │
└───────────────┘    └───────────────┘    └───────────────┘
                                               │
                                        ┌──────┴──────┐
                                        ▼             ▼
                                 ┌──────────┐  ┌──────────┐
                                 │Observation│  │  Audit   │
                                 │  (3112)  │  │  (3103)  │
                                 └──────────┘  └──────────┘
                                 
┌─────────────────────────────────────────────────────────────────┐
│                    INTERNAL SERVICES (localhost only)            │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    │
│  │ Kernel (3004) │    │ Capsule (3006)│    │   Others      │    │
│  │ Tool Execution│    │ WASM Runtime  │    │ (Optional)    │    │
│  │ localhost ONLY│    │               │    │               │    │
│  └───────────────┘    └───────────────┘    └───────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Rules

1. **Gateway (8013)** is the ONLY public entry point
2. **Kernel (3004)** binds to `127.0.0.1` only - NEVER expose publicly
3. **Internal services** (Registry, Memory, Policy) are not directly accessible
4. **Audit logging** captures all API access for compliance

---

## Usage

### Start Complete Stack (10 services)
```bash
# Use the complete configuration
cp .a2r/services.complete.json .a2r/services.json
a2r start
```

### Start Minimal Stack (7 services)
```bash
# Use minimal configuration (already active)
a2r start
```

---

## Verification Commands

```bash
# Check all services are running
a2r status

# Verify gateway is accessible
curl http://localhost:8013/health

# Verify API through gateway
curl http://localhost:8013/api/v1/health

# Check individual service health
curl http://localhost:3003/health  # Policy
curl http://localhost:3200/health  # Memory
curl http://localhost:8080/health  # Registry
curl http://localhost:3004/health  # Kernel (localhost only)
```

---

## Conclusion

✅ **All critical backend services are now wired into the enterprise architecture**

- **10 core services** are active and properly integrated
- **3 optional services** available for specialized use cases
- **6 library services** compile as dependencies (no standalone wiring needed)
- **15 deprecated services** consolidated and moved to `.deprecated/`

The architecture follows enterprise best practices with clear separation of concerns, proper security boundaries, and centralized logging.
