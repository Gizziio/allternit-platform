# A2rchitech Implementation Checklist

> **Version:** 1.0.0
> **Status:** Active Development
> **Last Updated:** January 2026

---

## Overview

This document tracks implementation progress across all phases. Update status as work completes.

**Status Legend:**
- [ ] Not Started
- [~] In Progress
- [x] Complete
- [!] Blocked

---

## Phase 0a: Headless iMessage POC (Week 1)

**Goal:** Text your Mac, see message in terminal, send reply

### Gateway-iMessage Service

#### Project Setup
- [ ] Create `services/gateway-imessage/Cargo.toml`
- [ ] Add workspace member to root `Cargo.toml`
- [ ] Create module structure (`lib.rs`, `main.rs`)
- [ ] Add dependencies (rusqlite, tokio, chrono, dirs)

#### chat_db.rs - Database Reader
- [ ] Implement `ChatDbReader::new()` - open connection
- [ ] Implement date conversion (Mac epoch → Unix)
- [ ] Implement `poll()` - get messages newer than last ROWID
- [ ] Implement `get_conversation_history()`
- [ ] Handle database locked errors
- [ ] Unit tests with mock database

#### poller.rs - Change Detection
- [ ] Implement `MessagePoller` struct
- [ ] Implement polling loop with configurable interval
- [ ] Channel-based message forwarding
- [ ] Graceful shutdown handling
- [ ] Integration test

#### sender.rs - AppleScript Executor
- [ ] Implement `send()` - basic message send
- [ ] Implement character escaping (quotes, newlines)
- [ ] Implement `send_with_retry()`
- [ ] Error handling for AppleScript failures
- [ ] Unit tests with mock osascript

#### main.rs - Entry Point
- [ ] Initialize logging (tracing)
- [ ] Load configuration
- [ ] Start poller in background task
- [ ] Message receive loop
- [ ] Basic echo response (for testing)
- [ ] Graceful shutdown on SIGINT

#### Testing & Verification
- [ ] Grant Full Disk Access to binary/Terminal
- [ ] Grant Automation permission for Messages
- [ ] Send test message from iPhone
- [ ] Verify message appears in terminal
- [ ] Send reply from terminal
- [ ] Verify reply received on iPhone (blue bubble)

**Acceptance Criteria:**
- [ ] Can receive iMessage and display in terminal
- [ ] Can send reply that appears as blue bubble
- [ ] Handles emoji and special characters
- [ ] No crashes over 1 hour of operation

---

## Phase 0b: Core Loop (Week 2)

**Goal:** Automated LLM responses

### Transport Envelope
- [ ] Create `packages/sdk-transport/Cargo.toml`
- [ ] Define `TransportEnvelope` struct
- [ ] Define `TransportSource` enum (iMessage, SMS, Web)
- [ ] Define `MessageContent` enum
- [ ] Implement serialization/deserialization
- [ ] Add to workspace

### Router-Agent (Basic)
- [ ] Create `services/router-agent/Cargo.toml`
- [ ] Define `UserSession` struct
- [ ] Implement session lookup by sender_id
- [ ] Implement session creation
- [ ] Basic in-memory session store
- [ ] Add to workspace

### Router-Model (Cloud LLM)
- [ ] Create `services/router-model/Cargo.toml`
- [ ] Define `ModelRouter` trait
- [ ] Implement OpenAI client
- [ ] Implement Claude client
- [ ] Simple model selection (config-based)
- [ ] Add to workspace

### Bridge Integration
- [ ] Update `gateway-imessage/bridge.rs`
- [ ] Connect to router-agent
- [ ] Forward to router-model
- [ ] Return LLM response
- [ ] Wire response back to sender

### Testing & Verification
- [ ] Send "Hello" to Mac
- [ ] Receive LLM-generated response
- [ ] Verify conversation context persists
- [ ] Test with multiple senders

**Acceptance Criteria:**
- [ ] Automated responses without manual intervention
- [ ] Conversation context maintained across messages
- [ ] Response latency <5 seconds
- [ ] Works with multiple concurrent users

---

## Phase 1: Multi-Gateway (Weeks 3-4)

**Goal:** SMS + iMessage unified

### Gateway-SMS
- [ ] Create `services/gateway-sms/Cargo.toml`
- [ ] Implement Telnyx webhook handler
- [ ] Implement outbound SMS via Telnyx API
- [ ] Error handling and retries
- [ ] Add to workspace

### Unified Routing
- [ ] Update router-agent for multi-gateway
- [ ] Implement `@agent` routing syntax
- [ ] Implement agent switching (`/switch`)
- [ ] Route responses back to correct gateway

### Function Compiler (Basic)
- [ ] Create `packages/function-compiler/Cargo.toml`
- [ ] Define function call output schema
- [ ] Implement NL → function call via LLM
- [ ] Validate against Function Registry
- [ ] Handle ambiguous intents

### Basic Function Execution
- [ ] Implement `set_alarm` (returns confirmation text)
- [ ] Implement `create_note` (stores in local DB)
- [ ] Implement `add_reminder` (stores in local DB)
- [ ] Permission checking (allow/deny)

### Testing & Verification
- [ ] Test iMessage flow end-to-end
- [ ] Test SMS flow end-to-end
- [ ] Test `@agent` routing
- [ ] Test function calling

**Acceptance Criteria:**
- [ ] Same agent reachable via iMessage and SMS
- [ ] `@agentname` routing works
- [ ] Basic functions execute and respond
- [ ] Audit log captures all executions

---

## Phase 2: Production Features (Month 2)

**Goal:** Ready for paying customers

### Web Dashboard
- [ ] Create `apps/web-dashboard/` (Next.js or similar)
- [ ] User authentication
- [ ] Conversation history view
- [ ] Analytics charts (messages, functions, latency)
- [ ] Agent configuration UI
- [ ] Permission management UI

### Rich UI Cards
- [ ] Define UI Card schema
- [ ] Implement card rendering for web
- [ ] Generate shortened URLs for cards
- [ ] Include card links in SMS responses

### Conversation History
- [ ] Persistent storage (PostgreSQL)
- [ ] Full conversation retrieval
- [ ] Search functionality
- [ ] Export capability

### Multi-Agent Management
- [ ] Agent creation UI
- [ ] Agent personality configuration
- [ ] Per-agent permission sets
- [ ] Agent analytics

### Function Registry Expansion
- [ ] Implement remaining 20+ functions
- [ ] Platform-specific adapters
- [ ] Rate limiting per function
- [ ] Usage tracking

### Testing & Verification
- [ ] End-to-end with web dashboard
- [ ] Load testing (1000 msg/hour)
- [ ] Multi-tenant isolation testing
- [ ] Security audit

**Acceptance Criteria:**
- [ ] Web dashboard functional
- [ ] Rich cards render in SMS
- [ ] All 26 functions implemented
- [ ] Ready for beta customers

---

## Phase 3: Enterprise Scale (Month 3+)

**Goal:** Enterprise readiness

### Identity Pool
- [ ] Multiple iCloud account management
- [ ] Account health monitoring
- [ ] Automatic account rotation
- [ ] User-to-account assignment

### Dedicated Numbers
- [ ] Number provisioning via Telnyx
- [ ] Number-to-agent mapping
- [ ] VIP agent numbers
- [ ] Department number ranges

### Compliance Features
- [ ] Data retention policies
- [ ] GDPR data export
- [ ] GDPR data deletion
- [ ] Audit log retention
- [ ] SOC2 preparation

### On-Premise Deployment
- [ ] Docker containerization
- [ ] Kubernetes manifests
- [ ] Helm chart
- [ ] Air-gapped deployment guide
- [ ] On-premise Mac Hive setup

### Local Inference
- [ ] Integrate llama.cpp or MLX
- [ ] Model download/management
- [ ] Hybrid routing (local/cloud)
- [ ] Performance monitoring

### Enterprise Features
- [ ] SSO integration (SAML/OIDC)
- [ ] Custom SLA configuration
- [ ] Dedicated support portal
- [ ] Custom branding

**Acceptance Criteria:**
- [ ] Multi-account Identity Pool working
- [ ] On-premise deployment tested
- [ ] Compliance documentation complete
- [ ] First enterprise customer onboarded

---

## Infrastructure Tasks

### Development Environment
- [ ] Local development setup documented
- [ ] Docker Compose for local services
- [ ] Environment variable management
- [ ] Secrets management (dev)

### CI/CD Pipeline
- [ ] GitHub Actions workflow
- [ ] Automated testing on PR
- [ ] Automated builds
- [ ] Staging deployment
- [ ] Production deployment

### Monitoring & Observability
- [ ] Logging infrastructure (structured logs)
- [ ] Metrics collection (Prometheus)
- [ ] Dashboards (Grafana)
- [ ] Alerting rules
- [ ] Error tracking (Sentry)

### Documentation
- [ ] API documentation
- [ ] Developer guide
- [ ] User guide
- [ ] Deployment guide
- [ ] Troubleshooting guide

---

## Current Sprint Focus

### This Week (Phase 0a)
| Task | Assignee | Status | Notes |
|------|----------|--------|-------|
| Create gateway-imessage Cargo.toml | - | [ ] | |
| Implement chat_db.rs | - | [ ] | |
| Implement poller.rs | - | [ ] | |
| Implement sender.rs | - | [ ] | |
| Create main.rs demo | - | [ ] | |
| Test end-to-end | - | [ ] | |

### Next Week (Phase 0b)
| Task | Assignee | Status | Notes |
|------|----------|--------|-------|
| Create sdk-transport | - | [ ] | |
| Create router-agent | - | [ ] | |
| Create router-model | - | [ ] | |
| Integrate LLM | - | [ ] | |
| Wire full loop | - | [ ] | |

---

## Blockers & Dependencies

| Blocker | Impact | Owner | Resolution |
|---------|--------|-------|------------|
| None currently | - | - | - |

---

## Notes & Decisions

### 2026-01-04
- Decided on Headless iMessage Swarm approach over iOS apps
- Gateway-iMessage is Phase 0 priority
- Cloud LLM first, local inference in Phase 3
- Telnyx for SMS (cost-effective)

---

## Quick Commands

```bash
# Build gateway-imessage
cargo build -p gateway-imessage

# Run gateway-imessage
cargo run -p gateway-imessage

# Run all tests
cargo test --workspace

# Check compilation
cargo check --workspace
```
