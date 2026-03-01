# A2rchitech Unified Architecture Documentation

> **Canonical Source of Truth for A2rchitech Implementation**

---

## Document Index

| File | Description | Priority |
|------|-------------|----------|
| `00_MASTER_ARCHITECTURE.md` | Complete system architecture, all layers, implementation status | **Start Here** |
| `01_GATEWAY_IMESSAGE_SPEC.md` | Technical spec for Mac-based iMessage gateway | Phase 0 |
| `02_BUSINESS_STRATEGY.md` | Three-tier business model, pricing, go-to-market | Reference |
| `03_FUNCTION_REGISTRY.md` | All 26 executable functions with schemas | Reference |
| `04_RISK_REGISTER.md` | Risk analysis with mitigations | Reference |
| `05_IMPLEMENTATION_CHECKLIST.md` | Task tracking for all phases | **Active Tracking** |
| `06_HEADLESS_IMESSAGE_SWARM_ORIGINAL.md` | Original concept document | Archive |

---

## Quick Start

### Current Phase: 0a (Headless iMessage POC)

**Immediate Goal:** Build `gateway-imessage` service that:
1. Reads incoming iMessages from `chat.db`
2. Displays them in terminal
3. Sends replies via AppleScript

**Location:** `services/gateway-imessage/`

### Key Architecture Decision

We are using the **Headless iMessage Swarm** approach:
- Mac Mini(s) act as gateway ("The Hive")
- Users text an Apple ID email address
- Mac intercepts and responds via native iMessage
- **No iOS app required**

This bypasses all iOS platform constraints (App Clips limits, iMessage Extension restrictions, etc.)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      TRANSPORT LAYER                                │
│  gateway-imessage (P0) | gateway-sms (P1) | gateway-web (P2)       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                              │
│  router-agent | router-model | function-compiler | policy          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EXECUTION LAYER                                │
│  executor | wasm-runtime (done) | apps-registry                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER (Done)                            │
│  history | capsule | registry | messaging                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

| Priority | Component | Description |
|----------|-----------|-------------|
| **P0** | `gateway-imessage` | Mac-based iMessage reading/sending |
| **P1** | `router-agent` | Session management by phone number |
| **P1** | `router-model` | Cloud LLM integration |
| **P1** | `gateway-sms` | Telnyx SMS integration |
| **P1** | `function-compiler` | NL → function call translation |
| **P2** | Web dashboard | Analytics, configuration |
| **P2** | Function execution | All 26 functions |
| **P3** | Local inference | On-device LLM |
| **P3** | Identity Pool | Multi-account scaling |

---

## Related Existing Specs

These documents in `spec/` are still relevant:
- `spec/FunctionRegistry.v0.json` - Schema definition
- `spec/PermissionModel.v0.json` - Permission schema
- `spec/AppsSDK.v0.md` - Third-party integration spec

---

## Commands

```bash
# Build everything
cargo build --workspace

# Check core packages
cargo check -p a2r-capsule -p a2r-wasm-runtime -p a2rchitech-registry

# Run API server (existing)
cargo run -p a2rchitech-api

# Run gateway-imessage (after implementation)
cargo run -p gateway-imessage
```

---

## Next Steps

1. **Scaffold `gateway-imessage`** - Create Cargo.toml, implement chat_db.rs
2. **Test POC** - Send/receive iMessage via terminal
3. **Wire routing** - Connect to router-agent and LLM
4. **Add SMS** - Implement gateway-sms with Telnyx

---

## Maintainers

- Eoj (Owner)

---

*Last Updated: January 2026*
