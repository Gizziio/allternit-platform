# A2rchitech Unified Architecture Handoff

> **Date:** January 4, 2026
> **Session:** Deep Research & Architecture Consolidation
> **Status:** Documentation Complete, Ready for Implementation

---

## What Was Accomplished

### 1. Deep Codebase Analysis

Analyzed the existing A2rchitech codebase and determined:

**Implemented (60-70% of backend):**
- WASM Runtime (`packages/orchestration/wasm-runtime/`) - Production-ready
- Capsule System (`packages/data/capsule/`) - Signing, bundling complete
- Policy Engine (`packages/security/policy/`) - Capability grants
- History/UOCS Ledger (`packages/data/history/`) - Append-only
- Messaging Core (`packages/data/messaging/`) - SQLite storage
- Registry (`packages/data/registry/`) - Agents, tools, fabric
- Cloud Runner (`packages/orchestration/cloud-runner/`) - Scheduler works
- API Server (`apps/api/`) - Registry + capsule endpoints
- Workflow Engine (`packages/orchestration/workflows/`) - DAG executor

**Critical Gaps Identified:**
- `services/gateway-imessage/` - **Not implemented** (directory empty)
- `services/gateway-sms/` - **Not implemented**
- `services/router-agent/` - **Not implemented**
- `services/router-model/` - **Not implemented**
- `packages/function-compiler/` - **Not implemented**
- `services/local-inference/` - **Not implemented**

**Partially Implemented (Stubs):**
- iOS App Intents - Print statements only, no actual system calls
- iOS App Clip - UI complete, calls localhost:3000
- iMessage Extension - Shell only

---

### 2. Platform Research Completed

**iOS App Clips:**
- 10MB size limit (cannot bundle LLMs)
- No background tasks, CloudKit, Contacts, EventKit
- Privacy restrictions (identifierForVendor empty)
- **Conclusion:** Use for onboarding only

**iMessage Extensions:**
- Cannot replace Messages thread UI
- Can access camera/microphone
- No background execution
- **Conclusion:** Bypass entirely with Headless Swarm approach

**App Intents/Shortcuts:**
- Available on app install
- Requires companion app
- **Conclusion:** Add as Phase 3 enhancement

**Local LLM Options:**
- MLX (Apple): ~230 tok/s, best for Mac
- llama.cpp: ~150 tok/s, cross-platform
- ExecuTorch: ~40 tok/s on iPhone 15
- **Conclusion:** Cloud-first, local inference Phase 3

**SMS Providers:**
- Telnyx: $0.0025/msg out, free inbound - **Recommended**
- Plivo: $0.0076/msg out, free inbound
- Twilio: $0.0079/msg both ways

---

### 3. Architecture Decision: Headless iMessage Swarm

**Key Insight:** Instead of fighting iOS platform constraints, use a Mac as a gateway.

**The Approach:**
- Mac Mini(s) act as "The Hive"
- Users text an Apple ID email (e.g., agent@a2rchitech.net)
- Mac reads `~/Library/Messages/chat.db` (SQLite)
- Mac sends replies via AppleScript
- **Result:** Native blue bubble experience, no app required

**Why This Is Superior:**
| iOS App Approach | Headless Swarm |
|------------------|----------------|
| App Clips: 10MB limit | Mac runs 24/7, unlimited |
| iMessage Extension: Can't replace thread | We ARE the thread |
| App Intents: Require app | Direct message, no app |
| No background execution | Always running |

---

### 4. Documents Created

**Location:** `docs/unified-architecture/`

| File | Size | Purpose |
|------|------|---------|
| `README.md` | 5.5 KB | Quick start guide |
| `00_MASTER_ARCHITECTURE.md` | 27 KB | Complete system architecture, all layers |
| `01_GATEWAY_IMESSAGE_SPEC.md` | 10 KB | Technical spec for chat_db reader, AppleScript sender |
| `02_BUSINESS_STRATEGY.md` | 11 KB | Three-tier model (SMB→Pro→Enterprise), pricing |
| `03_FUNCTION_REGISTRY.md` | 18 KB | All 26 functions with JSON schemas |
| `04_RISK_REGISTER.md` | 13 KB | 16 risks with mitigations |
| `05_IMPLEMENTATION_CHECKLIST.md` | 9.3 KB | Phase-by-phase task tracking |
| `06_HEADLESS_IMESSAGE_SWARM_ORIGINAL.md` | 3.8 KB | Original concept document |

**Total:** ~98 KB of consolidated documentation

---

## What Needs to Be Done

### Immediate: Phase 0a (Week 1)

**Goal:** Text your Mac, get a response in terminal

**Create `services/gateway-imessage/`:**
```
services/gateway-imessage/
├── Cargo.toml
└── src/
    ├── lib.rs           # Module exports
    ├── main.rs          # Entry point, polling loop
    ├── chat_db.rs       # SQLite reader for ~/Library/Messages/chat.db
    ├── poller.rs        # Real-time change detection
    ├── sender.rs        # AppleScript wrapper for sending
    ├── bridge.rs        # Connection to orchestrator (stub for now)
    ├── config.rs        # Configuration loading
    └── error.rs         # Error types
```

**Key Implementation Details:**

1. **chat_db.rs** - Read messages from SQLite:
```sql
SELECT m.ROWID, m.guid, m.text, m.date, m.is_from_me, h.id as sender_id
FROM message m
JOIN handle h ON m.handle_id = h.ROWID
WHERE m.ROWID > ? AND m.is_from_me = 0
ORDER BY m.ROWID ASC;
```

2. **Date Conversion:** Mac stores dates as nanoseconds since 2001-01-01
```rust
let unix_ts = (mac_timestamp / 1_000_000_000) + 978307200;
```

3. **sender.rs** - Send via AppleScript:
```applescript
tell application "Messages"
    set targetService to 1st account whose service type is iMessage
    set targetBuddy to participant "{recipient}" of targetService
    send "{message}" to targetBuddy
end tell
```

4. **Permissions Required:**
   - Full Disk Access (to read chat.db)
   - Automation permission (to control Messages)

**Acceptance Test:**
- [ ] Text Mac's Apple ID from iPhone
- [ ] Message appears in terminal
- [ ] Send reply from terminal
- [ ] Reply appears on iPhone as blue bubble

---

### Next: Phase 0b (Week 2)

**Goal:** Automated LLM responses

1. Create `packages/sdk-transport/` with TransportEnvelope
2. Create `services/router-agent/` for session management
3. Create `services/router-model/` for cloud LLM (OpenAI/Claude)
4. Wire gateway → router → LLM → response

---

### Then: Phase 1 (Weeks 3-4)

**Goal:** SMS + iMessage unified

1. Create `services/gateway-sms/` with Telnyx
2. Implement `@agent` routing syntax
3. Basic function calling (set_alarm, create_note)
4. Permission checking

---

### Later: Phase 2-3

- Web dashboard
- Rich UI cards
- Function Registry expansion (26 functions)
- Identity Pool (multi-iCloud account)
- On-premise deployment
- Local inference

---

## Key Files to Reference

**Existing Specs (still valid):**
- `spec/FunctionRegistry.v0.json` - Function schema definition
- `spec/PermissionModel.v0.json` - Permission schema
- `spec/AppsSDK.v0.md` - Third-party integration spec

**Existing Implementations (working):**
- `packages/orchestration/wasm-runtime/src/lib.rs` - WASM runtime
- `packages/data/capsule/src/lib.rs` - Capsule system
- `apps/api/src/main.rs` - API server

**Root Cargo.toml:** Already has workspace members defined, add:
```toml
"services/gateway-imessage",
```

---

## Commands

```bash
# Check existing core compiles
cargo check -p a2r-capsule -p a2r-wasm-runtime -p a2rchitech-registry

# After creating gateway-imessage:
cargo build -p gateway-imessage
cargo run -p gateway-imessage

# Grant Full Disk Access:
# System Preferences → Security & Privacy → Privacy → Full Disk Access
# Add Terminal.app or the compiled binary
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                      TRANSPORT LAYER (TO BUILD)                     │
│  gateway-imessage (P0) | gateway-sms (P1) | gateway-web (P2)       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER (TO BUILD)                   │
│  router-agent | router-model | function-compiler | policy          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EXECUTION LAYER (DONE)                         │
│  executor | wasm-runtime ✓ | apps-registry                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER (DONE)                            │
│  history ✓ | capsule ✓ | registry ✓ | messaging ✓                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Business Model Summary

| Tier | Price | Messages | Gateway |
|------|-------|----------|---------|
| Free | $0 | 100/mo | Single Mac |
| Pro | $20/mo | 1,000/mo | Single Mac |
| Professional | $100/mo | 5,000/mo | Multi-Mac |
| Enterprise | $1,000+/mo | 50,000+/mo | Identity Pool |

---

## Risks to Watch

| Risk | Priority | Mitigation |
|------|----------|------------|
| Apple rate-limits iMessage | High | Identity Pool, throttling |
| chat.db schema changes | Medium | Version detection |
| Prompt injection | Medium | Output validation, guardrails |
| Slow user adoption | Medium | Free tier, referrals |

---

## Next Session Action

**Scaffold `gateway-imessage` service:**

1. Create `services/gateway-imessage/Cargo.toml`
2. Implement `chat_db.rs` with SQLite reader
3. Implement `poller.rs` with 500ms polling
4. Implement `sender.rs` with AppleScript
5. Create `main.rs` demo that echoes messages
6. Test end-to-end with iPhone → Mac → iPhone

**Expected Outcome:** Working demo where texting your Mac's Apple ID results in an echo response appearing as a blue bubble.

---

## Files Changed This Session

**Created:**
- `docs/unified-architecture/README.md`
- `docs/unified-architecture/00_MASTER_ARCHITECTURE.md`
- `docs/unified-architecture/01_GATEWAY_IMESSAGE_SPEC.md`
- `docs/unified-architecture/02_BUSINESS_STRATEGY.md`
- `docs/unified-architecture/03_FUNCTION_REGISTRY.md`
- `docs/unified-architecture/04_RISK_REGISTER.md`
- `docs/unified-architecture/05_IMPLEMENTATION_CHECKLIST.md`
- `docs/unified-architecture/06_HEADLESS_IMESSAGE_SWARM_ORIGINAL.md`
- `docs/unified-architecture/HANDOFF.md` (this file)

**Not Modified:** All existing code unchanged

---

*End of Handoff*
