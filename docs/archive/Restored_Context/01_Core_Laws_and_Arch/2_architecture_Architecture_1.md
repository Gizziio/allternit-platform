# /spec/Architecture.md
# Allternit Architecture — Full Layered Scaffold (Folder-Exact)

This file is the **architecture master map**. It organizes the system into layers and binds each layer to concrete repo directories.

The preserved Unix-first orchestration document remains unmodified at:
- `/spec/layers/agent-orchestration/Original_AgentOrchestration.md`

---

## Layer Model (AOS + Platform)

### L0 — Interfaces (clients, no brain)
**Goal:** UI/UX, composition, visualization. No policy logic. fileciteturn5file7L71-L74

**Repo:**
```
/apps
  /desktop/                 # on-prem desktop app (primary)
    /src/
    /assets/
  /console/                 # optional local web console
  /cli/                     # CLI first, automation-friendly
  /voice/                   # voice I/O adapters (optional)
/packages/ui-kit/           # shared components
/packages/sdk/              # SDKs for integrations
```

---

### L1 — Core Runtime (sovereign kernel)
**Goal:** sessions, scheduling, event emission, artifact storage, deterministic replay.

**Repo:**
```
/packages/runtime-core/
  /session/
  /scheduler/
  /checkpoints/
  /artifacts/
  /eventing/
  /errors/
  /replay/
```

Runtime emits events that hooks/policy consume.

---

### L2 — Governance + Policy + IAM (constitution + org)
**Goal:** command authority boundaries, tenant isolation, secret scoping, audit chain. fileciteturn5file0L77-L90

**Repo:**
```
/packages/policy/
  /iam/
    /identities/
    /roles/
    /acl/
    /tokens/
  /risk/
    /tiers/
    /budgets/
    /scopes/
  /validation/
    /preexec/
    /postexec/
  /audit/
    /ledger/
    /tamper-evident/
  /tenancy/
    /isolation/
    /quotas/
  /secrets/
    /vault/
    /scoping/
```

---

### L3 — Agent Orchestration (workflow + roles)
**Goal:** orchestrate named/dynamic agents; enforce scientific loop. fileciteturn5file7L23-L31

**Repo (role agents + workflow engine + templates):**
```
/packages/agents/
  /named/
  /dynamic/
  /roles/
    /planner/
    /builder/
    /reviewer/
    /qa/
    /security/
    /meta/
  /personality/             # agent behavior traits (not permissions)

/packages/workflows/
  /engine/
  /templates/
    /sdlc/
    /deep-research/
    /robotics/
  /phases/                  # OBSERVE/THINK/PLAN/BUILD/EXECUTE/VERIFY/LEARN
    /observe/
    /think/
    /plan/
    /build/
    /execute/
    /verify/
    /learn/
  /artifacts/
  /success-criteria/
```

---

### L4 — Skills System (packages + registry + tool gateway)
**Goal:** Skills as domain containers: SKILL.md + Workflows/ + Tools/. fileciteturn5file7L15-L22

**Repo:**
```
/packages/skills/
  /schema/
  /packaging/
  /versioning/
  /dependencies/
  /routing/

/packages/registry/
  /publisher-keys/
  /signing/
  /index/
  /install/
  /rollback/
  /channels/
    /stable/
    /beta/
    /canary/

/packages/tools-gateway/     # also "skills-runtime"
  /gateway/
  /sandbox/
  /adapters/
    /mcp/
    /http/
    /local/
  /io-capture/
  /policy-client/
  /rate-limits/
```

Tool Gateway must depend on policy engine. fileciteturn5file0L45-L53

---

### L5 — Context Routing + Memory Fabric
**Goal:** precision hydration; no global context; just-in-time loading. fileciteturn5file7L39-L45

**Repo:**
```
/packages/context-router/
  /selectors/
  /hydration/
  /compilers/
  /budgets/
  /redaction/

/packages/memory/
  /working/                 # TTL
  /episodic/                # append-only session ledger
  /longterm/                # curated
  /indexes/
    /vector/
    /graph/
  /consolidation/
  /decay/
  /meta-pipelines/          # propose→eval→promote→rollback
```

---

### L6 — Providers + Persona Injection (models are engines)
**Goal:** route among closed/open models while preserving persona; models do not hold authority.

**Repo:**
```
/packages/providers/
  /router/
  /adapters/
    /openai/
    /anthropic/
    /google/
    /local/
  /persona/
    /kernel/
    /injectors/
    /overlays/
  /policies/                # confidentiality, budgets, routing rules
```

---

### L7 — History + Hooks + Observability (UOCS)
**Goal:** capture everything and enable event-driven automation. fileciteturn5file7L46-L70

**Repo:**
```
/packages/history/
  /ledger/
  /formats/
    /markdown/
    /jsonl/
  /index/
  /query/

/packages/hooks/
  /events/                  # SessionStart, PreToolUse, PostToolUse... fileciteturn5file7L59-L63
  /middleware/
  /policies/
  /plugins/
    /security-validation/
    /logging/
    /voice-summaries/
    /self-updates/
    /observability/
```

---

### L8 — Embodiment (robots / drones / IoT)
**Goal:** device skills, sim-first promotion, OTA signed updates, e-stop.

**Repo:**
```
/packages/robotics/
  /adapters/
    /ros2/
    /mqtt/
    /ble/
    /vendor-sdks/
  /sim/
    /gym/
    /scenarios/
    /metrics/
  /telemetry/
  /ota/
    /signing/
    /staging/
    /rollback/
  /safety/
    /envelopes/
    /e-stop/
```

---

## Deployment topologies (on-prem default)

### Local dev (compose) — reference
The preserved doc includes a baseline split into services: workflow-engine, skill-registry, context-router, history-ledger, hook-bus, tool-gateway, redis, db. fileciteturn5file0L1-L72

This maps to packages as:
- workflow-engine → `/packages/workflows`
- skill-registry → `/packages/registry`
- context-router → `/packages/context-router`
- history-ledger → `/packages/history`
- hook-bus → `/packages/hooks`
- tool-gateway → `/packages/tools-gateway`
- policy-engine → `/packages/policy`

---

## Why Unix-first is mandatory here
The doc’s core claim is “determinism beats cleverness” and system architecture is the moat. fileciteturn5file14L5-L11


### Allternit Unified Architecture - Old Implmentation Appended###

## Executive Summary

This document represents the old appended implementation of the Allternit platform based on the handoff document, with all services, packages, and iOS integration components properly organized and implemented. For Reference 

## Architecture Overview

The Allternit platform implements a Unix-first, deterministic cognitive operating system with the following layered architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          L0: INTERFACES LAYER                          │
│  iOS Apps (Store + Text) • Web Apps • Desktop Apps • CLI • Voice      │
├─────────────────────────────────────────────────────────────────────────┤
│                          TRANSPORT GATEWAYS                            │
│  SMS Gateway • iMessage Gateway • App Clip Gateway • Browser Gateway   │
├─────────────────────────────────────────────────────────────────────────┤
│                          L1-L8: CORE ARCHITECTURE                       │
│  Runtime • Policy • Agents • Workflows • Skills • Registry • Context   │
│  Providers • History • Hooks • Robotics                               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implemented Components

### 1. Transport Gateways (Services)
- **gateway-sms**: SMS-to-agent routing with Twilio integration
- **gateway-imessage**: iMessage-to-agent routing using chat.db polling
- **gateway-appclip**: App Clip gateway for no-install onboarding
- **gateway-browser**: Browser extension gateway

### 2. Routing Services
- **router-agent**: Agent selection and routing logic
- **router-model**: Model selection and routing logic

### 3. Registry Services  
- **registry-functions**: Function registry with capability definitions
- **registry-apps**: Third-party app registry with OAuth integration

### 4. Execution Services
- **executor**: Function execution dispatcher
- **policy**: Permission and confirmation engine
- **audit-log**: Comprehensive audit logging

### 5. Inference Services
- **local-inference**: Local model hosting with WASM runtime
- **webvm**: WASM component execution environment

### 6. Core Packages (L1-L8 Architecture)
- **sdk-core**: Core types and interfaces
- **sdk-apps**: Apps SDK for third-party integrations
- **sdk-functions**: Function registry types
- **sdk-policy**: Policy engine types
- **sdk-transport**: Transport abstraction layer
- **runtime-core**: Core runtime services
- **policy**: Governance and policy engine
- **agents**: Agent orchestration
- **workflows**: Workflow engine
- **skills**: Skills system
- **registry**: Unified registry and data fabric
- **tools-gateway**: Tools gateway and sandboxing
- **context-router**: Context routing and hydration
- **memory**: Memory fabric implementation
- **providers**: Model provider abstraction
- **history**: History ledger and formats
- **hooks**: Event hooks and middleware
- **robotics**: Robotics and IoT integration
- **ui-kit**: Shared UI components

## iOS Integration Strategy

### Headless iMessage Swarm Approach
Instead of fighting iOS platform constraints, we use Mac Minis as gateways:
- Mac reads ~/Library/Messages/chat.db (SQLite)
- Mac sends replies via AppleScript
- Users text Apple ID email (agent@allternit.net)
- Native blue bubble experience without app installation

### App Store vs No-Install Strategy
- **App Store Apps**: Companion app, iMessage extension, App Clip (require approval)
- **No-Install**: SMS gateway, App Clip (for onboarding), Text-based interfaces

## Key Technical Decisions

### 1. WASM Runtime Integration
- Uses wasmtime for secure function execution
- Capsule system for content-addressed deployment
- Ed25519 signing for integrity verification
- Capability-based security model

### 2. Local-First Architecture
- SQLite for local data persistence
- Local inference with quantized models
- Offline capability for core functions
- Cloud fallback for complex tasks

### 3. Deterministic Execution
- Append-only history ledger (UOCS)
- Reproducible scientific loop execution
- Immutable event chain
- Replay capability for all sessions

### 4. Permission System
- Default-deny policy with explicit grants
- Risk-based confirmation thresholds
- Per-agent capability scoping
- Comprehensive audit logging

## Implementation Status

### ✅ Phase 0a: Gateway-iMessage Core (COMPLETED)
- [x] Chat database reader (chat.db polling)
- [x] AppleScript message sender
- [x] Polling loop implementation
- [x] Basic echo functionality
- [x] Configuration management
- [x] Error handling and logging

### ✅ Phase 0b: Core Routing (COMPLETED)  
- [x] Transport envelope schema
- [x] Agent router implementation
- [x] Model router implementation
- [x] Policy engine integration
- [x] Full loop wiring

### ⏳ Phase 1: SMS Gateway (IN PROGRESS)
- [x] SMS provider integration (Twilio)
- [x] @--- routing syntax
- [x] Basic function calling
- [ ] Production deployment

### 🔄 Phase 2-3: Full Ecosystem (PLANNED)
- [ ] Web dashboard
- [ ] 26 functions implemented
- [ ] Identity Pool
- [ ] Local inference optimization

## Business Model

| Tier | Price | Messages | Gateway |
|------|-------|----------|---------|
| Free | $0 | 100/mo | Single Mac |
| Pro | $20/mo | 1,000/mo | Single Mac |
| Professional | $100/mo | 5,000/mo | Multi-Mac |
| Enterprise | $1,000+/mo | 50,000+/mo | Identity Pool |

## Risk Mitigation

| Risk | Priority | Mitigation |
|------|----------|------------|
| Apple rate-limits iMessage | High | Identity Pool, throttling |
| chat.db schema changes | Medium | Version detection |
| Prompt injection | Medium | Output validation |

## Getting Started

### Development Setup
```bash
# Clone the repository
git clone <repo-url>
cd allternit

# Build the workspace
cargo build

# Run individual services
cd services/gateway-imessage
cargo run

# Or run with Docker Compose
cd infra/docker-compose
docker-compose -f development.yml up
```

### iOS Integration Setup
1. Configure Messages app on Mac with Apple ID
2. Grant Full Disk Access to the application
3. Set up environment variables:
   - `CHAT_DB_PATH` (default: ~/Library/Messages/chat.db)
   - `APPLE_ID_EMAIL` (the email to text)
   - `POLL_INTERVAL_MS` (default: 500ms)

### SMS Integration Setup
1. Sign up for Twilio account
2. Configure webhook to your SMS gateway endpoint
3. Set up environment variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `SMS_WEBHOOK_URL`

## Architecture Principles Maintained

1. **Unix-First**: Each component does one thing and does it well
2. **Deterministic**: Predictable behavior with verifiable execution
3. **Composable**: Services work together but remain independent
4. **Cognitive OS**: Scientific loop execution (OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN)
5. **Security-First**: Default-deny permissions with audit logging

## Next Steps

### Immediate (Week 1-2)
1. Complete SMS gateway implementation
2. Integrate with function registry
3. Implement policy engine for iOS
4. Add comprehensive error handling

### Short-term (Month 1)
1. Deploy to production environment
2. Implement 5 core functions
3. Add iOS companion app
4. Create web dashboard

### Medium-term (Month 2-3)
1. Expand to 26 functions
2. Implement local inference
3. Add identity pool for enterprise
4. Create iOS SDK

## Conclusion

The Allternit platform is now fully architected and partially implemented with a clear path to production. The headless iMessage swarm approach solves the iOS platform constraint problem while maintaining the native user experience. The Unix-first architecture ensures maintainability and scalability while the WASM runtime provides secure function execution.

The implementation is ready for Phase 1 deployment with SMS and basic iMessage functionality, with a clear roadmap for expanding to the full ecosystem.
