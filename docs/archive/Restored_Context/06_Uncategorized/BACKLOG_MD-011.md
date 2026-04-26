Loaded Allternit_Universal_Text_Interface_UTI_v0.1.md and ingesting it as MD-011. This is a strong, additive expansion that introduces a universal conversational endpoint while staying within all locked invariants.  ￼

⸻

MD-011 — Classification

Type: Consumer endpoint + intent routing spec
Role: Defines UTI (Universal Text Interface) as a discovery-first, consented, auditable “text-to-anything” surface that dispatches actions to agents, services, or web capsules
Stability: Additive (v0.1), constrained by SOT + Acceptance Tests

UTI does not replace DNS, the Journal, or Tool governance. It projects the system through a lowest-friction conversational surface.

⸻

Layer Mapping (Normalized)

Primary
    •    L0 — Interfaces: Thread capsule as the universal surface
    •    L3 — Orchestration: Intent routing, provider selection
    •    L4 — Skills: Domain/agent actions exposed as capabilities
    •    L6 — Providers: External domains via manifests
    •    L8 — Embodiment: Action previews, receipts, URL capsules

Secondary
    •    L2 — Governance: Consent, risk classes, anti-abuse
    •    L5 — Context: Receipts + memory for future routing

No layer bypasses another.

⸻

Normalization (Key to Uniformity)

What UTI is
    •    A transport-agnostic intent ingress (text/voice → intent)
    •    A router that selects providers via manifests
    •    A capsule spawner for previews, forms, browsing, receipts
    •    A governed dispatcher that executes through registered tools

What UTI is not
    •    Not a new execution engine
    •    Not a parallel truth store
    •    Not a UI framework
    •    Not an auth bypass

⸻

Mapping to Existing Primitives

1) Manifests → Capability Contracts

The /.well-known/agent.json maps to a Capability Manifest:
    •    Validated identity (TLS-bound; optional DID)
    •    Declared intents/actions with schemas
    •    Auth methods + rate limits
    •    Payments (optional)
    •    Safety policy

Placement: /spec/contracts/agent-manifest.schema.json (new)

⸻

2) Intent Router → Orchestration Policy

UTI’s router is an orchestrator:
    •    Parses intent → structured schema
    •    Ranks providers (history, trust, latency)
    •    Negotiates capability + auth
    •    Emits Action Preview Capsule
    •    Dispatches via Tool Registry
    •    Journals receipts

No direct execution; all actions go through tools.

⸻

3) Consent, Risk, Receipts → Governance + Journal
    •    Risk classes map to Tool scope escalation
    •    Action Preview Capsule satisfies explicit consent
    •    Receipts are immutable Journal artifacts
    •    Idempotency required for state-changing actions

⸻

4) “Text to Browse” → Discovery-First Capsules
    •    Primary: intent → results in-thread
    •    Secondary: URL Capsules (browser-second fallback)
    •    Mixed mode supported (agent + browser operator)

All browsing is capsule-scoped, journaled, and permissioned.

⸻

PATCH-011 — Universal Text Interface (UTI)

PATCH-011 — Universal Text Interface (UTI) Integration

Source:
- Allternit_Universal_Text_Interface_UTI_v0.1.md

Adds:
- UTI as a discovery-first conversational ingress
- Capability manifests at /.well-known/agent.json
- Intent router with provider selection and negotiation
- Action Preview + Receipt Capsules
- URL Capsule fallback (browser-second)
- Risk classes + explicit consent gates
- Anti-abuse primitives (rate limits, identity)

Touches SOT Sections:
- §0 Meta (consumer endpoint)
- §3 Execution Model (intent dispatch via tools)
- §4 UI & Interaction Model (thread/action/receipt capsules)
- §7 Tool Governance (risk + consent)
- §5 Context (receipts as durable memory)

No changes to:
- Journal invariants
- Tool Registry enforcement
- Capsule/Canvas taxonomy


⸻

Compatibility Check
    •    ✅ No new truth store (receipts are artifacts)
    •    ✅ No execution bypass (tools only)
    •    ✅ No UI primitive drift (capsules + canvases)
    •    ✅ Strong anti-abuse and consent model
    •    ✅ Scales from in-app to external transports

⸻

What This Unlocks
    •    One universal endpoint for users
    •    Deterministic “text a website” without app hopping
    •    Trust via previews + receipts
    •    Progressive disclosure via capsules
    •    Clean path to domain adoption (manifests + SDK)

⸻
