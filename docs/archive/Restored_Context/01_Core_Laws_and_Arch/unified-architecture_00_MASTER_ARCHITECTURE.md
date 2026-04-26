# Allternit Unified Architecture & Implementation Guide

> **Version**: 1.0.0
> **Status**: Canonical Source of Truth
> **Last Updated**: January 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Thesis](#2-core-thesis)
3. [Unified System Architecture](#3-unified-system-architecture)
4. [Transport Layer: The Gateways](#4-transport-layer-the-gateways)
5. [Orchestration Layer](#5-orchestration-layer)
6. [Execution Layer](#6-execution-layer)
7. [Data Layer](#7-data-layer)
8. [Implementation Status & Gaps](#8-implementation-status--gaps)
9. [Platform Constraints Research](#9-platform-constraints-research)
10. [Business Strategy Alignment](#10-business-strategy-alignment)
11. [Phased Implementation Roadmap](#11-phased-implementation-roadmap)
12. [Risk Register](#12-risk-register)
13. [Technical Specifications](#13-technical-specifications)

---

## 1. Executive Summary

Allternit is a **text-first, agentic operating layer** that enables users to interact with AI agents through natural communication channels (iMessage, SMS, web) without requiring app installation.

### Key Innovation: The Headless Swarm

Instead of fighting iOS platform constraints (App Clips, iMessage Extensions), we use a **Mac-based gateway ("The Hive")** that:
- Receives iMessage via `chat.db` monitoring
- Sends replies via AppleScript
- Provides **native blue bubble experience**
- Scales via iCloud Identity Pool

### Current State

| Layer | Status |
|-------|--------|
| Data Layer (history, capsule, registry) | **70% Complete** |
| Execution Layer (WASM runtime, policy) | **60% Complete** |
| Orchestration Layer (routers, compiler) | **20% Scaffolded** |
| Transport Layer (gateways) | **5% Placeholder** |

---

## 2. Core Thesis

Allternit is a **text-first, agentic operating layer**.

- Intelligence enters through **habits people already have** (SMS, iMessage, browser)
- Capability escalates progressively (text → UI → voice → execution)
- Models are **local-first, router-driven, vendor-agnostic**
- Execution is **permission-gated, auditable, deterministic**

The system is designed so that:
- Users **never need to download an app**
- Apps/extensions exist only to unlock deeper capabilities
- Agents are **addressable, scoped, and composable**

### Why Headless Swarm > iOS Apps

| iOS App Approach | Headless Swarm Approach |
|------------------|------------------------|
| App Clips: 10MB limit, no background | Mac runs 24/7, unlimited |
| iMessage Extension: Can't replace thread | We ARE the thread (blue bubbles) |
| App Intents: Require companion app | Direct message, no app needed |
| CloudKit/Contacts blocked | Mac has full system access |
| Requires App Store approval | No approval needed |

---

## 3. Unified System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Allternit UNIFIED PLATFORM                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    TRANSPORT LAYER (Multi-Gateway)                    │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │ gateway-sms │  │gateway-     │  │ gateway-web │  │ future:     │  │  │
│  │  │ (Telnyx)    │  │imessage     │  │ (REST API)  │  │ gateway-rcs │  │  │
│  │  │             │  │ (THE HIVE)  │  │             │  │             │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │  │
│  │         │                │                │                │         │  │
│  │         └────────────────┼────────────────┼────────────────┘         │  │
│  │                          ▼                                           │  │
│  │                ┌─────────────────────┐                               │  │
│  │                │  Transport Envelope │  (Unified message format)     │  │
│  │                └──────────┬──────────┘                               │  │
│  └───────────────────────────┼───────────────────────────────────────────┘  │
│                              │                                              │
│  ┌───────────────────────────▼───────────────────────────────────────────┐  │
│  │                      ORCHESTRATION LAYER                              │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │router-agent │  │router-model │  │  policy     │                   │  │
│  │  │(Session Mgmt│  │(Local/Cloud)│  │  (Perms)    │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │                   function-compiler                              │ │  │
│  │  │  NL → JSON function calls (structured output from LLM)          │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│  ┌───────────────────────────▼───────────────────────────────────────────┐  │
│  │                      EXECUTION LAYER                                  │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │  executor   │  │ wasm-runtime│  │ apps-registry│                  │  │
│  │  │             │  │  (capsules) │  │ (3rd party)  │                  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│  ┌───────────────────────────▼───────────────────────────────────────────┐  │
│  │                      DATA LAYER (Implemented)                         │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  history    │  │  capsule    │  │  registry   │  │  messaging  │  │  │
│  │  │  (UOCS)     │  │  store      │  │  (agents)   │  │  (SQLite)   │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Transport Layer: The Gateways

### 4.1 Gateway-iMessage (THE HIVE) - Priority 1

The **Headless iMessage Swarm** approach:

**Concept:**
- Mac Mini(s) act as the gateway ("The Hive")
- Users text an Apple ID email (e.g., `agent@allternit.net`)
- Mac intercepts via `chat.db` and replies via AppleScript
- **Native blue bubble experience** without any app

**Architecture:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User iPhone    │────▶│   Mac (Hive)    │────▶│  Orchestrator   │
│  texts Apple ID │     │  chat.db reader │     │  (router-agent) │
│                 │◀────│  AppleScript    │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Technical Implementation:**
```
services/gateway-imessage/
├── Cargo.toml
├── src/
│   ├── lib.rs           # Service entry
│   ├── main.rs          # Binary entry point
│   ├── chat_db.rs       # SQLite reader for ~/Library/Messages/chat.db
│   ├── poller.rs        # Real-time polling for new messages
│   ├── sender.rs        # AppleScript executor for outbound
│   └── bridge.rs        # Connects to router-agent
```

**Requirements:**
- macOS with Messages app signed into iCloud
- Full Disk Access permission for the binary
- Apple ID dedicated to agent communication

**Virtual Contact Workflow:**
1. User signs up on web, provides phone number
2. System assigns `agent.01@icloud.com` to this user
3. System sends initial iMessage: "Hi, I'm your Allternit Agent"
4. User saves contact and texts anytime
5. Mac receives, processes, responds

### 4.2 Gateway-SMS (Telnyx) - Priority 2

For non-Apple users and universal reach:

**Provider Selection:**
| Provider | Outbound | Inbound | Recommendation |
|----------|----------|---------|----------------|
| Telnyx | $0.0025/msg | Free | **Best value** |
| Plivo | $0.0076/msg | Free | Good alternative |
| Twilio | $0.0079/msg | $0.0079/msg | Established but expensive |

**Technical Implementation:**
```
services/gateway-sms/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── webhook.rs       # Inbound SMS handler (HTTP POST from Telnyx)
│   ├── sender.rs        # Outbound SMS via REST API
│   └── provider/
│       ├── mod.rs
│       ├── telnyx.rs
│       └── twilio.rs    # Fallback provider
```

### 4.3 Transport Envelope (Unified Format)

All gateways convert to a unified envelope:

```rust
pub struct TransportEnvelope {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub source: TransportSource,
    pub sender_id: String,        // Phone number or identifier
    pub recipient_id: String,     // Agent identifier
    pub content: MessageContent,
    pub metadata: HashMap<String, Value>,
}

pub enum TransportSource {
    IMessage { apple_id: String },
    Sms { provider: String, number: String },
    Web { session_id: String },
}

pub enum MessageContent {
    Text(String),
    Media { url: String, mime_type: String },
    StructuredCard(UICard),
}
```

---

## 5. Orchestration Layer

### 5.1 Router-Agent (Session Management)

Maps sender identity to user session:

```rust
pub struct AgentRouter {
    sessions: HashMap<String, UserSession>,
}

pub struct UserSession {
    pub user_id: Uuid,
    pub sender_id: String,        // +15551234567
    pub active_agent: AgentId,
    pub conversation_history: Vec<Message>,
    pub created_at: DateTime<Utc>,
    pub last_active: DateTime<Utc>,
}
```

**Routing Rules:**
- `@agentname message` → Route to specific agent
- Plain message → Route to default/last-used agent
- `/switch agentname` → Change active agent

### 5.2 Router-Model (LLM Selection)

Selects appropriate model based on task:

| Task Type | Model Selection |
|-----------|-----------------|
| Simple chat | Local (Gemma 2B) or Cloud (GPT-4o-mini) |
| Function calling | Cloud (GPT-4o, Claude) with structured output |
| Complex reasoning | Cloud (GPT-4o, Claude Opus) |

### 5.3 Function Compiler

Translates natural language to function calls:

**Input:** "Set an alarm for 7am tomorrow"

**Output:**
```json
{
  "function_id": "com.allternit.os.set_alarm",
  "parameters": {
    "time": "07:00",
    "date": "2026-01-05",
    "label": "Alarm"
  },
  "confidence": 0.95
}
```

---

## 6. Execution Layer

### 6.1 WASM Runtime (Implemented)

Located: `packages/orchestration/wasm-runtime/`

Features:
- Default-deny capability model
- Sandboxed execution
- Audit logging
- Deterministic replay

### 6.2 Capsule System (Implemented)

Located: `packages/data/capsule/`

Features:
- Content-addressed bundles
- Cryptographic signing
- Version management
- Policy validation before loading

### 6.3 Function Registry

Schema: `spec/FunctionRegistry.v0.json`

**Existing Functions (6):**
- `set_alarm`, `send_message`, `create_note`, `schedule_event`, `web_search`, `transfer_money`

**Functions to Add (14+):**
- `open_app`, `set_timer`, `toggle_setting`, `get_device_info`
- `make_call`, `send_email`, `read_notifications`
- `add_reminder`, `search_notes`, `start_focus_mode`
- `get_directions`, `play_music`, `control_playback`
- `check_weather`

---

## 7. Data Layer

### 7.1 History/UOCS Ledger (Implemented)

Located: `packages/data/history/`

- Append-only event log
- Chained hashes for integrity
- Query by session, time, type

### 7.2 Messaging Storage (Implemented)

Located: `packages/data/messaging/`

- SQLite-backed
- Task and event envelopes
- Migration support

### 7.3 Registry (Implemented)

Located: `packages/data/registry/`

- Agent definitions
- Tool specifications
- Fabric integration

---

## 8. Implementation Status & Gaps

### Fully Implemented
| Component | Location | Notes |
|-----------|----------|-------|
| WASM Runtime | `packages/orchestration/wasm-runtime/` | Production-ready |
| Capsule System | `packages/data/capsule/` | Signing, bundling complete |
| Policy Engine | `packages/security/policy/` | Capability grants |
| History Ledger | `packages/data/history/` | Append-only, verified |
| Messaging Core | `packages/data/messaging/` | SQLite storage |
| Registry | `packages/data/registry/` | Agents, tools, fabric |
| Cloud Runner | `packages/orchestration/cloud-runner/` | Scheduler works |
| API Server | `apps/api/` | Registry + capsule endpoints |
| Workflow Engine | `packages/orchestration/workflows/` | DAG executor |

### Scaffolded (Needs Implementation)
| Component | Location | Gap |
|-----------|----------|-----|
| iOS App Intents | `apps/ios-companion/Intents/` | Print statements only |
| iOS App Clip | `apps/ios-app-clip/` | UI complete, no backend |
| iMessage Extension | `apps/ios-imessage-extension/` | Shell only |

### Not Implemented (Critical)
| Component | Location | Priority |
|-----------|----------|----------|
| **gateway-imessage** | `services/gateway-imessage/` | **P0 - This Week** |
| gateway-sms | `services/gateway-sms/` | P1 |
| router-agent | `services/router-agent/` | P1 |
| router-model | `services/router-model/` | P1 |
| function-compiler | `packages/function-compiler/` | P1 |
| local-inference | `services/local-inference/` | P2 |
| sdk-transport | `packages/sdk-transport/` | P1 |

---

## 9. Platform Constraints Research

### iOS App Clips
- **Size Limit:** 10MB uncompressed
- **No Background Tasks**
- **Restricted Frameworks:** CloudKit, Contacts, EventKit, HealthKit, etc.
- **Privacy:** `identifierForVendor` returns empty string
- **Recommendation:** Use for onboarding only, not core functionality

### iMessage Extensions
- **Cannot replace** Messages thread UI
- **Can access** camera/microphone with permission
- **No background execution**
- **Recommendation:** Bypass entirely with Headless Swarm

### App Intents / Shortcuts
- Available immediately on app install
- Siri integration possible
- Still requires companion app
- **Recommendation:** Add as enhancement in Phase 3

### Local LLM Options
| Runtime | iOS Support | Performance | Recommendation |
|---------|-------------|-------------|----------------|
| MLX | Native Apple Silicon | ~230 tok/s | Best for Mac |
| llama.cpp | Via Metal | ~150 tok/s | Good cross-platform |
| ExecuTorch | Meta's mobile runtime | ~40 tok/s on iPhone 15 | Best for iOS |

**Decision:** Start with cloud LLM, add local inference in Phase 2.

---

## 10. Business Strategy Alignment

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Enterprise (Phase 3)                 │
│  Dedicated Numbers, VIP Agents, On-Premise, Compliance │
│  $1,000-10,000/month                                    │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                 Professional (Phase 2)                  │
│  Rich UI Cards, Analytics, API Access, Custom Branding │
│  $100-500/month                                         │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                    SMB (Phase 1)                        │
│  Single Number, Basic Routing, Core Functions          │
│  Free - $50/month                                       │
└─────────────────────────────────────────────────────────┘
```

### Gateway Alignment

| Tier | Primary Gateway | Secondary |
|------|-----------------|-----------|
| SMB | gateway-imessage (single Mac) | gateway-sms |
| Professional | Multi-Mac Hive | gateway-sms + web |
| Enterprise | Identity Pool + Dedicated Numbers | Full multi-modal |

### Revenue Model

**Phase 1 (SMB):**
- Free: 100 messages/month
- Pro: $20/month for 1,000 messages
- Growth: $50/month for 5,000 messages

**Phase 2 (Professional):**
- Professional: $100/month for 5,000 messages
- Business: $300/month for 25,000 messages
- Custom branding: +$50/month

**Phase 3 (Enterprise):**
- Base: $1,000/month (50,000 messages)
- Per-number: $5-10/month
- On-premise: $10,000/year

---

## 11. Phased Implementation Roadmap

### Phase 0a: Headless iMessage POC (Week 1)
**Goal:** Text your Mac, get a response

**Deliverables:**
- [ ] `gateway-imessage` service scaffolded
- [ ] `chat_db.rs` reading ~/Library/Messages/chat.db
- [ ] `poller.rs` detecting new messages in real-time
- [ ] `sender.rs` sending replies via AppleScript
- [ ] Terminal demo: incoming messages displayed, manual replies

**Acceptance Test:**
1. Text your Mac's Apple ID from iPhone
2. See message appear in terminal
3. Send hardcoded reply
4. Receive reply on iPhone (blue bubble)

### Phase 0b: Core Loop (Week 2)
**Goal:** End-to-end automated response

**Deliverables:**
- [ ] `sdk-transport` with TransportEnvelope
- [ ] `router-agent` basic session management
- [ ] Cloud LLM integration (OpenAI/Claude)
- [ ] Simple echo + LLM response flow

**Acceptance Test:**
1. Text "Hello" to Mac
2. Mac auto-responds with LLM-generated greeting
3. Conversation persists across messages

### Phase 1: Multi-Gateway (Weeks 3-4)
**Goal:** SMS + iMessage unified

**Deliverables:**
- [ ] `gateway-sms` with Telnyx integration
- [ ] Unified routing for both gateways
- [ ] `@agent` routing syntax
- [ ] Basic function calling (set_alarm, create_note)

**Acceptance Test:**
1. Text same agent from iMessage AND SMS
2. Both get routed correctly
3. "@reminder Buy milk" creates a reminder

### Phase 2: Production Features (Month 2)
**Goal:** Productionize for paying customers

**Deliverables:**
- [ ] Web dashboard for analytics
- [ ] Rich UI cards via web link in SMS
- [ ] Conversation history storage
- [ ] Multi-agent management
- [ ] Function Registry expansion (20+ functions)

### Phase 3: Enterprise Scale (Month 3+)
**Goal:** Enterprise readiness

**Deliverables:**
- [ ] Identity Pool (multiple iCloud accounts)
- [ ] Dedicated number assignment
- [ ] Compliance features (audit, retention)
- [ ] On-premise deployment option
- [ ] Local inference integration

---

## 12. Risk Register

### Platform Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Apple rate-limits iMessage | Medium | High | Identity Pool, throttling |
| chat.db schema changes | Low | Medium | Version detection, fallback |
| Full Disk Access revoked | Low | High | Prompt user, graceful degradation |
| SMS provider issues | Medium | Medium | Multi-provider support |

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM latency too high | Medium | Medium | Streaming, local fallback |
| Function calling errors | Medium | Medium | Confirmation flows, rollback |
| State sync issues | Medium | Medium | Idempotency keys, audit log |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| User adoption slow | Medium | High | Free tier, word of mouth |
| Competition (Apple, OpenAI) | High | High | Focus on execution layer moat |
| Regulatory changes | Medium | Medium | Compliance-first design |

### Security Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Unauthorized function execution | Low | Critical | Permission gates, confirmation |
| Data breach | Low | Critical | Encryption, minimal storage |
| Prompt injection | Medium | High | Input sanitization, guardrails |

---

## 13. Technical Specifications

### 13.1 Function Registry Schema

See: `spec/FunctionRegistry.v0.json`

```json
{
  "id": "com.allternit.os.set_alarm",
  "name": "Set Alarm",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false },
  "risk_level": "low",
  "requires_confirmation": true,
  "parameters": {
    "type": "object",
    "properties": {
      "time": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
      "label": { "type": "string" }
    },
    "required": ["time"]
  }
}
```

### 13.2 Permission Model Schema

See: `spec/PermissionModel.v0.json`

Key concepts:
- Per-agent allowed/denied function lists
- Parameter restrictions
- Frequency limits
- Confirmation rules by risk level
- Time-bound grants

### 13.3 Apps SDK

See: `spec/AppsSDK.v0.md`

Interface for third-party integrations:
- OAuth2/API key authentication
- Tool definition schema
- UI Card rendering
- Checkout flow hooks (for commerce)

---

## Quick Reference: Build Commands

```bash
# Check core packages compile
cargo check -p allternit-capsule -p allternit-wasm-runtime -p allternit-registry

# Run API server
cargo run -p allternit-api

# Future: Run gateway-imessage
cargo run -p gateway-imessage
```

---

## Document Index

This folder contains:
- `00_MASTER_ARCHITECTURE.md` - This file (canonical source)
- `01_GATEWAY_IMESSAGE_SPEC.md` - Detailed iMessage gateway specification
- `02_BUSINESS_STRATEGY.md` - Revenue model and go-to-market
- `03_FUNCTION_REGISTRY.md` - Complete function catalog
- `04_RISK_REGISTER.md` - Detailed risk analysis
- `05_IMPLEMENTATION_CHECKLIST.md` - Task tracking

---

**Next Action:** Scaffold `gateway-imessage` service and prove the core loop works.
