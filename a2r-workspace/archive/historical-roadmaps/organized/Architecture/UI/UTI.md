# A2rchitech | Universal Text Interface (UTI)
## “Text-to-Anything” Consumer Endpoint Layer — Spec + Integration Map (v0.1)

**Goal:** Make the *conversation thread* the universal interface so users can **invoke web browsing, services, and task execution** without app context switching.

This document is written to be pasted into the **Unified UI / Dynamic UI** unification chat and mapped into the A2rchitech repo as a canonical integration spec.

---

## 0) Thesis (First-Principles)

### 0.1 What users optimize for
- **Lowest cognitive overhead** (no app-hopping, no re-learning UI)
- **Fast intent → action** (do the thing, don’t navigate)
- **Trust + receipts** (clear authorization, audit trail, reversibility)

### 0.2 What “wins”
A single conversational surface wins if it provides:
- **Comparable power to apps** (deep actions, not just Q&A)
- **Higher trust than the open web** (verified identity, explicit consent)
- **Lower friction than installs** (instant use; progressive disclosure)

---

## 1) Problem Statement

### 1.1 Context shift is the tax
Modern endpoints are fragmented:
- Search → browser → app → login → form → payment → confirmation
- Every hop drops state and increases user error

### 1.2 “Text a website” is not DNS
DNS resolves **known names → IPs**.
The real missing layer is:
- **Natural language intent → service/agent endpoint**
- **Capability negotiation**
- **Auth + anti-abuse**
- **Payments + receipts**
- **Safety**

---

## 2) Core Concept: UTI (Universal Text Interface)

### 2.1 Definition
UTI is an A2rchitech layer where:
- Users send **text (or voice → text)**
- A2rchitech resolves **intent**
- A2rchitech dispatches actions to:
  - **web pages** (browser mini-apps)
  - **service APIs**
  - **domain agents** (intelligent endpoints)

### 2.2 Non-goals (v0.1)
- Not replacing DNS / IP routing
- Not relying on vendor-specific “mini-app” silos
- Not requiring every site to adopt new infra on day 1

---

## 3) Required Building Blocks (Minimum Viable Standard)

This is the smallest set of primitives that makes “text websites” feasible at scale.

### 3.1 Agent Manifest (Domain Capability Contract)
Every participating domain SHOULD expose:

`https://<domain>/.well-known/agent.json`

This is a **capability + identity + policy manifest**.

#### Manifest must declare:
- `domain` and cryptographic identity bindings (TLS-bound + optional DID)
- Supported `intents` / `actions` with schemas
- `auth` methods (OAuth, Passkeys/WebAuthn, token exchange)
- Rate limiting & abuse policy
- Payment rails (optional)
- Human escalation endpoint (optional)

### 3.2 Intent Router (Client/Platform)
A2rchitech hosts an **intent router** that:
1. Interprets user text into a structured intent
2. Finds candidate services (history, preferences, directories)
3. Fetches manifests
4. Chooses best provider
5. Executes action with authenticated consent
6. Stores receipts + audit log

### 3.3 Capability Negotiation
The router and domain agent must agree on:
- Inputs required
- Optional parameters
- Safety constraints
- Expected outputs (receipt, confirmation id, next steps)

### 3.4 Trust & Consent
System must enforce:
- Verified service identity (domain-bound)
- Explicit user consent for state-changing actions
- Replay protection + idempotency
- Receipts

### 3.5 Anti-abuse by design
If “text any website” becomes universal, it becomes a spam surface.
Therefore v0.1 requires:
- Rate limits (per user / per domain / per intent)
- Proof-of-work or reputation gating for anonymous usage
- Verified sender identity for state-changing operations

---

## 4) A2rchitech Stack Mapping (Where This Lives)

### 4.1 New layers/modules (recommended)
**/packages/**
- `uti-core/` — intent schema, manifest schema, receipts, policy engine
- `uti-router/` — intent routing engine, ranking, provider selection
- `uti-transports/` — adapters (RCS, push, email-like, in-app chat)
- `uti-browser-miniapp/` — spawn URL page mini-app (discovery-first browsing)
- `uti-auth/` — consent flows, OAuth/passkey support, token vault
- `uti-safety/` — spam controls, content policy, action gating

### 4.2 Existing layers that this integrates with
- **Dynamic UI / Mini Apps:** UTI can spawn “URL mini-apps” for web tasks
- **Agent Runtime:** UTI provides a standardized action interface
- **Memory/Context:** UTI uses dynamic context discovery (progressive disclosure)
- **Retrieval:** UTI uses your retrieval stack for intent enrichment and service discovery

---

## 5) Canonical Flows

### 5.1 Flow A — “Text a Domain Agent”
User: “Return my last order from ExampleStore”

1) Intent parse → `commerce.return`
2) Resolve target domain:
   - user history or explicit mention
3) Fetch `/.well-known/agent.json`
4) Auth check:
   - if no token, initiate consent (passkey/OAuth)
5) Execute `POST /agent/actions/return`
6) Return receipt:
   - confirmation id
   - return label link
   - refund timeline
7) Store in audit log

### 5.2 Flow B — “Text to Browse” (Discovery-first web)
User: “Find the cheapest flights to Miami next week”

1) Intent parse → `travel.search`
2) Router selects:
   - web discovery plan (search + compare)
3) Spawn **URL mini-app(s)**:
   - comparison pages as mini-app tabs/capsules
4) Summarize results in-thread
5) Optional: handoff to a specific provider agent for booking

### 5.3 Flow C — Mixed Mode (Agent + Browser)
User: “Schedule a haircut tomorrow near 606xx”

1) Intent → `local.service_booking`
2) Candidates:
   - directory agent(s)
   - direct salon agent(s)
3) If no agent manifests exist:
   - spawn web mini-app for booking page
4) Assist form-filling and confirmation
5) Return receipt + add to calendar (if permitted)

---

## 6) Manifest Spec (v0.1 Draft)

### 6.1 Minimal JSON structure
```json
{
  "version": "0.1",
  "domain": "example.com",
  "identity": {
    "tlsBound": true,
    "did": null,
    "signingKeys": ["kid:base64..."]
  },
  "endpoints": {
    "actions": "https://example.com/agent/actions",
    "capabilities": "https://example.com/agent/capabilities",
    "humanEscalation": "mailto:support@example.com"
  },
  "auth": {
    "methods": ["oauth2", "passkey", "apiKey"],
    "oauth2": {
      "authorize": "https://example.com/oauth/authorize",
      "token": "https://example.com/oauth/token",
      "scopes": ["orders.read", "orders.write"]
    }
  },
  "rateLimits": {
    "anonymousRpm": 6,
    "authenticatedRpm": 60
  },
  "intents": [
    {
      "name": "commerce.return",
      "description": "Create a return for an order",
      "inputSchemaRef": "https://example.com/schemas/return.request.json",
      "outputSchemaRef": "https://example.com/schemas/return.receipt.json",
      "idempotency": true
    }
  ],
  "payments": {
    "supported": false,
    "rails": []
  },
  "policy": {
    "requiresExplicitConsent": true,
    "safetyClass": "state-changing"
  }
}
```

### 6.2 Why “well-known”
- Deterministic discovery without centralized directories
- Aligns with web conventions (stable location, cacheable, easy to adopt)

---

## 7) Intent Schema (v0.1)

### 7.1 Canonical intent object
```json
{
  "intent": "commerce.return",
  "entities": {
    "merchant": "ExampleStore",
    "orderHint": "last",
    "reason": "wrong size"
  },
  "constraints": {
    "time": null,
    "budget": null,
    "location": null
  },
  "authContext": {
    "userId": "uid_...",
    "sessionId": "sid_..."
  },
  "risk": {
    "class": "state-changing",
    "requiresConfirmation": true
  }
}
```

### 7.2 Risk classes (recommended)
- `read-only` — safe queries
- `state-changing` — orders, bookings, cancellations
- `financial` — payments, transfers
- `identity` — account changes, password reset

---

## 8) Security Model (Practical)

### 8.1 Identity binding
- Domain identity is anchored in **TLS**
- Optional: DID for cross-domain agent identity

### 8.2 Consent gates
- Require explicit confirmation for `state-changing` and above
- Show a structured “action preview” before execution:
  - what will happen
  - which domain
  - what data is shared
  - reversible yes/no

### 8.3 Receipts + audit
Every action returns a signed receipt:
- `receiptId`
- `domain`
- `intent`
- `timestamp`
- `result`
- `reversal` instructions if available

### 8.4 Anti-phishing constraints
- Always render domain in verified badge state
- Never allow arbitrary “pay here” links without explicit user approval
- Prefer tokenized payments or known rails

---

## 9) Discovery Model (How the Router Finds “Who to Text”)

### 9.1 Inputs
- User history
- User preferences (default merchants/providers)
- Public directories (optional)
- On-demand web discovery (search, compare, verify)

### 9.2 Ranking signals
- Prior user success with provider
- Manifest completeness
- Trust score (verified identity + reputation)
- Latency and reliability
- Cost/payment terms

### 9.3 Fallback path
If no manifest exists:
- Spawn URL mini-app
- Use browser operator to assist navigation
- Offer “suggest agent adoption” to domain

---

## 10) How This Fits the Dynamic UI “Capsules” Model

### 10.1 Capsule types
- **Thread Capsule:** the canonical conversation surface
- **URL Capsule:** spawned web page mini-app (browser second)
- **Action Capsule:** preview + confirmation + receipt
- **Form Capsule:** structured input collection (progressive disclosure)
- **Receipt Capsule:** persistent log entry with reversibility

### 10.2 UX principle
**Discovery-first, browser-second**:
- user experiences “finding + doing”
- not “opening a browser”

---

## 11) MVP Roadmap (Concrete Build Order)

### Phase 0 — Spec & contracts (1–2 iterations)
- Define:
  - `agent.json` schema
  - Intent schema
  - Receipt schema
  - Risk classes + confirmation rules

### Phase 1 — In-app transport (fastest)
- Implement UTI within A2rchitech chat surface first
- Add URL capsule spawner
- Add action preview + receipts

### Phase 2 — Domain agent SDK
- Provide a tiny “agent server” template:
  - Node/TS + OpenAPI
  - manifest generator
  - sample intents: `support.ticket`, `commerce.order_status`, `commerce.return`

### Phase 3 — External transports (optional)
- RCS/other adapters where feasible
- Maintain same UTI core contracts

### Phase 4 — Directory + reputation (needed for scale)
- Optional “agent registry” that indexes manifests
- Reputation system for reliability and abuse resistance

---

## 12) Acceptance Tests (Hard Requirements)

### 12.1 Contract tests
- Manifest is discoverable at well-known URL
- Router validates schema + signature
- Actions require idempotency keys for state changes
- Receipts are stored and retrievable

### 12.2 UX tests
- User can complete a task without opening a standalone browser app
- Action preview appears before state change
- Receipt is generated on success/failure

### 12.3 Safety tests
- Unknown domains cannot trigger payments without explicit confirmation
- Rate limiting prevents spam loops
- Auth tokens never leak into messages

---

## 13) Integration Notes (How This Merges With Other A2rchitech Work)

### 13.1 Dynamic Context Discovery (progressive disclosure)
- Use intent + risk class to decide how much context is loaded
- Only pull the minimum required facts, then expand if needed

### 13.2 Retrieval stack (binary/int8/LEANN)
- Use retrieval for:
  - intent enrichment
  - provider selection memory (“what worked before”)
  - documentation and policy lookup
- Keep retrieval deterministic: cached manifests + typed schemas

### 13.3 Guardrails & modular rules architecture
- Every intent has a policy:
  - allowed tools
  - required confirmations
  - logging obligations

---

## 14) Recommended Repo Artifacts

### 14.1 Specs
- `/spec/UTI.md` (this document)
- `/spec/contracts/agent-manifest.schema.json`
- `/spec/contracts/intent.schema.json`
- `/spec/contracts/receipt.schema.json`

### 14.2 ADRs
- `ADR-UTI-0001-well-known-manifest.md`
- `ADR-UTI-0002-risk-classes-and-consent.md`
- `ADR-UTI-0003-url-capsule-browser-second.md`

### 14.3 Example implementation
- `/examples/domain-agent-node/`
- `/examples/manifests/example.com.agent.json`

---

## 15) Next Build Tasks (Actionable)

1) Implement manifest fetch + validation in `uti-core`
2) Implement `intent → provider selection` in `uti-router`
3) Implement **Action Preview Capsule**
4) Implement **Receipt Capsule + audit log**
5) Implement URL mini-app spawner (browser second)
6) Ship a domain-agent SDK template + sample intents

---

## Appendix A — Minimal “Agent Actions” Endpoint Pattern

### A.1 REST
- `POST /agent/actions/{intentName}`
- Headers:
  - `Idempotency-Key: <uuid>`
  - `Authorization: Bearer <token>`
- Body: intent input schema

### A.2 Response
- Receipt schema with:
  - `status` (`success|failed|pending`)
  - `receiptId`
  - `result`
  - `nextSteps`
  - `reversal` (if possible)

---

## Appendix B — Design Principle Summary

- **Conversation is the OS surface**
- **Typed intents, not freeform glue**
- **Domain manifests enable deterministic discovery**
- **Consent + receipts are non-negotiable**
- **Browser is a capsule fallback, not the primary UX**
