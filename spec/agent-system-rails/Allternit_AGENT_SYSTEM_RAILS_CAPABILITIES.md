# A2R Agent System Rails: Advanced Features (V2)

This document details the enterprise-grade agent orchestration and observability features implemented in the Rails system, bringing it to parity with (and exceeding) the `mcp-agent` implementation.

---

## 1. Interactive Elicitation Protocol
Bridges the gap between asynchronous mail and synchronous tool execution.

- **Purpose:** Allows agents/tools to pause execution and request structured information from a human (passwords, 2FA, preferences).
- **Key Events:** `ElicitationRequested`, `ElicitationResponded`.
- **Capabilities:**
    - **JSON Schema Validation:** Tools can provide a `requested_schema` that the UI uses to render a dynamic form.
    - **Active Projections:** Pending requests are projected to `.a2r/ledger/elicitation/active/` for instant UI discovery.
    - **Timeouts:** Supports `timeout_seconds` to prevent hanging execution loops.
- **Endpoint:** `POST /v1/gate/elicitation` | `POST /v1/gate/elicitation/answer`

---

## 2. Dynamic Swarm Handoffs
Enables conversational agent transitions within a single Work Item (WIH).

- **Purpose:** Allows Agent A to transfer the current task context to Agent B dynamically.
- **Key Event:** `AgentHandoffRequested`.
- **Capabilities:**
    - **State Injection:** Supports passing `context_variables` during handoff.
    - **Automatic Re-projection:** The Rails system intercepts handoffs and automatically updates the `WihState` projection to reflect the new owner.
- **Endpoint:** `POST /v1/gate/handoff`

---

## 3. Execution Sampling (Pass-Through)
Enables downstream MCP servers to request generation from the main LLM.

- **Purpose:** Acts as a pass-through proxy for tool-initiated generation requests.
- **Key Events:** `SamplingRequested`, `SamplingResponded`.
- **Capabilities:**
    - **Standardized Payloads:** Uses MCP-compliant `SamplingRequest` structures.
    - **Active Projections:** Projected to `.a2r/ledger/sampling/active/`.
- **Endpoint:** `POST /v1/gate/sampling` | `POST /v1/gate/sampling/answer`

---

## 4. Signal Subscriptions & Broadcasting
A high-performance coordination mechanism for multi-agent swarms.

- **Purpose:** Decouples message senders from recipients using a Pub/Sub model.
- **Database:** Uses a persistent `subscriptions` table in the SQLite-backed Bus.
- **Capabilities:**
    - **Persistence:** Subscriptions survive system restarts.
    - **Reliability:** Broadcasts are converted into individual `BusMessage` entries, ensuring delivery via the standard polling mechanism.
- **Internal API:** `bus.subscribe(actor_id, kind)`, `bus.broadcast_signal(sender, kind, payload)`.

---

## 5. AI Observability & Token Tracking
Standardized cost and performance metrics etched into the immutable Ledger.

- **Purpose:** Provides a permanent audit trail of model usage and costs.
- **Standards:** Implements **OpenTelemetry GenAI Semantic Conventions**.
- **Capabilities:**
    - **Automatic Estimation:** If a tool fails to report tokens, the system estimates usage based on payload size (~4 chars/token).
    - **Metadata Injection:** `create_observed_event` automatically tags events with `gen_ai.agent.name` and `gen_ai.request.model`.
- **Data Structure:** `ReceiptRecord` now includes `input_tokens`, `output_tokens`, and `total_tokens`.

---

## 6. Enterprise Authentication (OAuth Vault)
Secure management of downstream server credentials.

- **Purpose:** Stores and manages OAuth access tokens for third-party integrations (GitHub, Slack, etc.).
- **Key Event:** `OAuthTokenStored`.
- **Capabilities:**
    - **Atomic Updates:** Uses atomic write operations to prevent token corruption.
    - **Audited Access:** Token storage operations are logged to the Ledger for compliance.
- **Endpoint:** `POST /v1/gate/oauth` | `GET /v1/gate/oauth/:server_name`

---

## 7. Operational Integrity
- **Idempotency Checks:** `check_idempotency` prevents duplicate processing of elicitation and sampling responses.
- **Session Proxying:** `register_session_proxy` allows mapping one upstream session to multiple downstream targets for complex swarm scenarios.
