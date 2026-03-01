# A://RCHITECH — Versioning & Backwards Compatibility (N14)
## Versioning Strategy Spec

### 1. Semantic Versioning (SemVer)
All platform components (crates, APIs, schemas) must follow [SemVer 2.0.0](https://semver.org/).

- **MAJOR:** Incompatible API changes.
- **MINOR:** Add functionality in a backwards-compatible manner.
- **PATCH:** Backwards-compatible bug fixes.

---

### 2. API Versioning
The Public API (Layer 3) uses URI versioning for major releases.

- **Current Version:** `/api/v1/...`
- **Deprecation Policy:** When `v2` is released, `v1` remains active for a minimum of 6 months.
- **Header Versioning:** Clients can optionally specify a `X-A2R-Version` header for fine-grained feature gating.

---

### 3. Schema Versioning (JSON Schemas)
All contracts (Environment Spec, Policy, Receipt) include a mandatory `version` field.

- **Invariants:**
    - Schema versions use SemVer strings (e.g., `"1.2.0"`).
    - Consumers MUST support "Graceful Degradation": ignore unknown fields in JSON payloads if the major version matches.
    - Producers MUST NOT remove fields in MINOR updates.

---

### 4. Protocol Compatibility (A2R-IX / Canvas)
- **Negotiation:** Handshake protocols (WebSocket/SSE) MUST include version negotiation.
- **Backwards Compatibility:** The Kernel MUST support the two most recent MINOR versions of the Execution Driver interface.

---

### 5. Migration Paths
- **State Migration:** The Run Ledger (N15) is append-only. Schema migrations for existing records are handled via "Lazy Migration" at read-time or explicit migration tasks in the `a2r-ops` module.
- **Breaking Changes:** Any breaking change to a Layer 1 contract REQUIRES a corresponding update to the 3-Layer Map (N1) and an architecture review.
