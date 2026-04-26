# DELTA-0007: OpenCode TUI Fork Integration

**Status:** Draft
**Created:** 2026-02-21
**Author:** System
**Risk Tier:** 2 (Medium - new component, replaces existing)
**Baseline Reference:** `/spec/Baseline.md`
**WIH Reference:** TUI-INTEGRATION-001

---

## 1. Intent

Fork OpenCode's TypeScript/OpenTUI TUI to replace the current Rust/ratatui agent-shell, establishing a production-grade terminal UI that communicates with Allternit's Rust kernel via HTTP/JSON + SSE.

## 2. Background

- **Current State:** `7-apps/agent-shell/` uses Rust/ratatui for TUI
- **Problem:** Building comprehensive TUI in Rust is slow; OpenCode has 107K+ stars with mature UX
- **Solution:** Fork OpenCode TUI (MIT licensed), adapt SDK layer to call Allternit API endpoints

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Allternit MONOREPO                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────┐      ┌─────────────────────┐  │
│  │   7-apps/agent-shell │      │    7-apps/api       │  │
│  │                      │      │                     │  │
│  │  ┌───────────────┐  │ HTTP │  ┌───────────────┐  │  │
│  │  │  tui/         │  │◄────►│  │ tui_routes.rs │  │  │
│  │  │  (TypeScript) │  │ SSE  │  │ (Rust/Axum)   │  │  │
│  │  │               │  │      │  │               │  │  │
│  │  │  • packages/  │  │      │  └───────────────┘  │  │
│  │  │    allternit-sdk/   │  │      │                     │  │
│  │  │  • src/       │  │      │  ┌───────────────┐  │  │
│  │  │    context/   │  │      │  │ session_      │  │  │
│  │  │    routes/    │  │      │  │ routes.rs     │  │  │
│  │  │  • package.js │  │      │  │               │  │  │
│  │  └───────────────┘  │      │  └───────────────┘  │  │
│  └─────────────────────┘      └─────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 4. Scope

### 4.1 In Scope

| Component | Location | Description |
|-----------|----------|-------------|
| `@allternit/sdk` | `agent-shell/tui/packages/allternit-sdk/` | TypeScript SDK for Allternit API |
| TUI Core | `agent-shell/tui/src/` | OpenCode TUI components adapted |
| API Routes | `api/src/tui_routes.rs` | TUI compatibility endpoints |
| Context Providers | `agent-shell/tui/src/context/` | SDK adapter with SolidJS reactivity |

### 4.2 Out of Scope

- Modifying Allternit kernel internals
- Changing existing session_routes.rs behavior
- Desktop/Electron packaging

## 5. Interface Contracts

### 5.1 SDK → API Endpoint Mapping

| SDK Method | HTTP Method | Endpoint | Request Type | Response Type |
|------------|-------------|----------|--------------|---------------|
| `session.list()` | GET | `/api/v1/sessions` | - | `SessionListResponse` |
| `session.create()` | POST | `/api/v1/sessions` | `CreateSessionRequest` | `Session` |
| `session.getByID(id)` | GET | `/api/v1/sessions/:id` | - | `Session` |
| `session.delete({sessionID})` | DELETE | `/api/v1/sessions/:id` | - | `void` |
| `session.messages({sessionID})` | GET | `/api/v1/sessions/:id/messages` | - | `MessagesListResponse` |
| `session.prompt({sessionID, parts})` | POST | `/api/v1/sessions/:id/messages` | `SendMessageRequest` | `Message` |
| `session.abort({sessionID})` | POST | `/api/v1/sessions/:id/abort` | - | `void` |
| `event.subscribe()` | GET | `/api/v1/sessions/sync` | - | SSE stream |
| `config.fetchConfig()` | GET | `/api/v1/config` | - | `ConfigResponse` |
| `config.providers()` | GET | `/api/v1/config/providers` | - | `ProvidersResponse` |
| `provider.list()` | GET | `/api/v1/providers` | - | `ProviderListResponse` |
| `app.agents()` | GET | `/api/v1/app/agents` | - | `Agent[]` |

### 5.2 Type Definitions

```typescript
interface Session {
  id: string
  title?: string
  time: {
    created: number
    updated: number
    compacting?: number
  }
  message_count?: number
}

interface Message {
  id: string
  sessionID: string
  role: 'user' | 'assistant'
  time: {
    created: number
    completed?: number
  }
  parts: Part[]
}

interface Part {
  id: string
  messageID: string
  type: 'text' | 'tool_call' | 'tool_result'
  text?: string
  status?: string
}

interface SDKResult<T> {
  data: T | undefined
  error?: string
}
```

### 5.3 Error Handling Contract

All SDK methods must:
1. Return `SDKResult<T>` with either `data` or `error`
2. Handle network failures with retry (max 3, exponential backoff)
3. Handle 5xx errors as retriable
4. Handle 4xx errors as non-retriable (except 429)
5. Emit structured logs for all errors

## 6. Invariants

### INV-TUI-001: SDK Response Type Safety

All SDK methods return typed `SDKResult<T>`. No `any` types in public API.

**Validation:** TypeScript strict mode, CI type-check gate

### INV-TUI-002: No Direct Kernel Access

TUI communicates ONLY via HTTP API. No direct filesystem, database, or kernel access.

**Validation:** Import boundary linter, architecture tests

### INV-TUI-003: SSE Reconnection

Event stream must auto-reconnect on disconnect with exponential backoff.

**Validation:** Integration test with simulated disconnect

### INV-TUI-004: Configuration by Environment

Backend URL configured via `Allternit_API_URL` environment variable, default `http://localhost:3000`.

**Validation:** Config test, environment variable parsing

## 7. Quality Requirements

### 7.1 Performance

| Metric | Budget | Validation |
|--------|--------|------------|
| TUI startup time | < 500ms | Benchmark test |
| Key input latency | < 16ms (60fps) | Frame timing test |
| API call latency | < 100ms p50 | Integration test |
| SSE event delivery | < 50ms | Integration test |

### 7.2 Reliability

| Requirement | Target | Validation |
|-------------|--------|------------|
| SDK retry success rate | > 99% | Chaos test |
| SSE reconnection success | > 99.9% | Disconnect test |
| Type safety coverage | 100% | Strict mode CI |

### 7.3 Observability

All SDK operations must:
- Log request/response (debug level)
- Log errors with stack trace (error level)
- Track latency metrics
- Include correlation IDs in requests

## 8. Acceptance Tests

### AC-TUI-001: Session Lifecycle

```gherkin
Given Allternit API is running on localhost:3000
When TUI starts
Then session list is fetched and displayed
When user creates new session
Then session appears in list
When user sends message
Then message appears in session
When user deletes session
Then session is removed from list
```

### AC-TUI-002: SSE Event Stream

```gherkin
Given Allternit API is running with SSE endpoint
When TUI subscribes to event stream
Then events are received in real-time
When API restarts
Then TUI reconnects automatically
When session is created externally
Then TUI receives session.created event
```

### AC-TUI-003: Error Recovery

```gherkin
Given Allternit API is unavailable
When TUI attempts API call
Then error is displayed to user
When API becomes available
Then TUI retries and succeeds
```

## 9. Implementation Phases

### Phase 1: SDK Foundation (1-2 days)
- [ ] Create `@allternit/sdk` package with full type definitions
- [ ] Implement all client classes with error handling
- [ ] Add retry logic with exponential backoff
- [ ] Add correlation ID tracking
- [ ] Add structured logging

### Phase 2: TUI Core (2-3 days)
- [ ] Fork OpenCode TUI components
- [ ] Wire SDK context provider
- [ ] Configure environment-based API URL
- [ ] Add error boundary components
- [ ] Add loading states

### Phase 3: API Routes (1 day)
- [ ] Implement all TUI routes in `tui_routes.rs`
- [ ] Connect to existing session manager
- [ ] Add SSE endpoint
- [ ] Add metrics/observability

### Phase 4: Integration (1-2 days)
- [ ] Build system integration (pnpm workspace)
- [ ] End-to-end tests
- [ ] Performance validation
- [ ] Documentation

## 10. Rollback Plan

If TUI integration fails:
1. Revert to Rust/ratatui agent-shell (existing code preserved)
2. TUI routes in API remain (no breaking changes to other consumers)
3. SDK can be used by other future clients

## 11. References

- OpenCode Repo: `https://github.com/sst/opencode` (MIT License)
- Allternit API: `7-apps/api/`
- System Law: `/SYSTEM_LAW.md`
- Session Routes: `7-apps/api/src/session_routes.rs`

---

**Approval Required:** Architecture review per LAW-META-006

**Evidence Requirements:**
- Type-check passing
- All acceptance tests passing
- Performance benchmarks within budget
- Architecture boundary tests passing
