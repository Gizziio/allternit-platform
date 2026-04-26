Understood.

This will not be “CI advice.”

This will be a native Allternit control-plane specification for turning A://TERNIT into a deterministic autonomous code factory.

What follows is a formal implementation blueprint aligned with:
	•	/SOT.md authority
	•	Spec → Plan → Implement → Verify → Release loop
	•	WIH enforcement
	•	Role-scoped agents
	•	Contract-enforced boundaries
	•	Deterministic Runner kernel
	•	Rails control plane
	•	AcceptanceTests as executable truth

No GitHub dependency assumptions.
GitHub becomes optional transport only.

⸻

A://TERNIT

Autonomous Code Factory (ACF)

Native Control-Plane Implementation Specification

Version: ACF-v1
Scope: Repo-native autonomous governance
Layer: Runner + Rails + Spec

⸻

I. Core Objective

Transform Allternit repos into deterministic autonomous engineering systems where:
	1.	Coding agents implement changes
	2.	Governance is contract-enforced
	3.	Review agents validate changes
	4.	Evidence is machine-verifiable
	5.	Incidents convert into permanent harness upgrades
	6.	No merge occurs without deterministic state validation

This is not CI orchestration.

This is autonomous engineering governance embedded in the Allternit runtime.

⸻

II. Architectural Placement

This system spans three existing Allternit layers:

Spec Layer
Runner Kernel
Rails Control Plane

GitHub (or any VCS host) becomes an event relay only.

⸻

III. Spec Layer Additions

We introduce a first-class primitive:

/spec/Contracts/RiskPolicy.schema.json

And a required config instance:

/spec/RiskPolicy.json


⸻

1️⃣ RiskPolicy Contract

This defines:
	•	Risk tiers
	•	Path classification rules
	•	Required gates by tier
	•	Required evidence
	•	Review requirements
	•	Docs drift rules

Example conceptual structure:

{
  version,
  riskTiers: [low, medium, high, critical],
  pathRules: [
    { pattern, tier }
  ],
  requiredGates: {
    tier: [
      "policy-gate",
      "review-clean-head",
      "acceptance-tests",
      "ui-evidence",
      ...
    ]
  },
  docsDriftRules,
  evidenceRequirements
}

This becomes executable truth.

Runner must load this before any execution begins.

⸻

2️⃣ AcceptanceTests Authority

No merge state is valid unless:
	•	All AcceptanceTests pass
	•	Tests are bound to current head SHA
	•	Evidence artifacts embed SHA

AcceptanceTests.md remains canonical.
Runner uses it as executable validation set.

⸻

3️⃣ Docs Drift Rules

Control-plane changes must enforce:
	•	/SOT.md update
	•	Relevant /spec delta
	•	ADR entry

If control-plane paths modified without spec delta → fail preflight.

This prevents governance drift.

⸻

IV. Runner Kernel Modifications

We introduce a deterministic preflight stage.

Runner execution order becomes:

⸻

Stage 0 — Preflight Risk Evaluation

Runner performs:
	1.	Load WIH
	2.	Load RiskPolicy
	3.	Detect changed files
	4.	Compute risk tier
	5.	Resolve required gates
	6.	Validate docs drift rules

If failure → hard stop.

No expensive DAG execution occurs before this.

⸻

Stage 1 — Review State Reconciliation

Runner loads:

ReviewAgentState {
  prId,
  headSha,
  reviewRunId,
  status,
  findingsHash,
  timestamp
}

Rules:
	•	headSha must match current working commit
	•	reviewRunId must correspond to latest run
	•	status must be success
	•	findingsHash must equal zero actionable findings

If stale → fail.
If findings exist → remediation path.

⸻

Stage 2 — Deterministic Remediation Loop

If findings present:

Spawn RemediationAgent with constraints:
	•	Implementer role only
	•	Cannot modify /spec
	•	Cannot modify RiskPolicy
	•	Tool allowlist enforced
	•	Model pinned
	•	Temperature fixed
	•	Deterministic patch mode

Flow:
	1.	Load review context
	2.	Apply minimal patch
	3.	Run targeted validation
	4.	Commit patch
	5.	Trigger new review cycle
	6.	Repeat until clean OR maxAttempts reached

If maxAttempts exceeded → escalate to human gate.

This entire loop is internal to Runner.
No external workflow required.

⸻

Stage 3 — Evidence Validation

For risk tiers requiring UI or flow validation:

Runner must validate:
	•	Evidence manifest exists
	•	SHA embedded in artifact metadata
	•	Flow assertions passed
	•	Artifacts timestamp recent
	•	No stale evidence allowed

Evidence directory structure:

/evidence/{sha}/flowName/
  manifest.json
  screenshot.png
  logs.json

Runner verifies integrity before allowing merge state.

⸻

Stage 4 — Acceptance + Security Gate

Execute:
	•	AcceptanceTests
	•	Static analysis
	•	Type check
	•	Build verification
	•	Security contracts

All results must bind to headSha.

No cross-SHA reuse allowed.

⸻

V. Rails Control Plane Responsibilities

Rails acts as canonical authority.

Only Rails may:
	•	Emit review rerun requests
	•	Auto-resolve bot-only threads
	•	Write audit receipts
	•	Update ReviewAgentState
	•	Record evidence receipts

Workers cannot emit control-plane mutations.

This prevents race conditions.

⸻

Canonical Rerun Discipline

Rails enforces:
	•	Only one rerun request per SHA
	•	Marker-based dedupe
	•	SHA-bound rerun request
	•	No multi-writer comment collisions

Review requests become control-plane commands,
not ad-hoc comments.

⸻

Bot Thread Auto-Resolution

After clean review for current head:

For each thread:
	•	If all comments role == ReviewAgent → resolve
	•	If any human present → never auto-resolve

After resolution:
	•	Re-run policy gate to reflect conversation resolution

⸻

VI. Evidence as First-Class Primitive

Evidence must be structured and machine-validated.

Add:

/spec/Contracts/Evidence.schema.json

Define:
	•	Required flows
	•	Required assertions
	•	Required metadata
	•	Freshness policy
	•	Integrity hash

Evidence is not screenshots.
It is structured proof.

⸻

VII. Harness Gap Loop

When production incident occurs:
	1.	Create HarnessGap WIH
	2.	Add failing case to AcceptanceTests
	3.	Track SLA in metrics store
	4.	Close only when deterministic validation added

This prevents recurrence.

Over time:
Coverage grows.
Human debugging shrinks.

⸻

VIII. Agent Role Model

Formalize role boundaries:

Architect:
	•	May change spec
	•	Cannot write implementation code

Implementer:
	•	May write code
	•	Cannot modify spec

Reviewer:
	•	May flag findings
	•	Cannot modify code

RemediationAgent:
	•	Implementer subtype
	•	Patch only
	•	Spec locked

Security:
	•	Gates destructive tools

Runner enforces these permissions.
Not convention.

⸻

IX. Merge State Definition

A commit may be considered “merge-eligible” only if:
	•	RiskPolicy gate passed
	•	ReviewAgentState clean for current headSha
	•	AcceptanceTests pass
	•	Evidence valid (if required)
	•	Docs drift rules satisfied
	•	No unresolved human threads
	•	No stale receipts

This becomes:

MergeEligibilityReceipt {
  headSha,
  timestamp,
  riskTier,
  evidenceHash,
  reviewRunId,
  acceptanceHash,
  policyVersion
}

Stored immutably.

⸻

X. Control Plane Independence

This entire system must:
	•	Work locally
	•	Work on VPS
	•	Work without GitHub Actions
	•	Work with any VCS

GitHub integration becomes adapter only.

All logic lives in Allternit.

⸻

XI. Why This Is Strategic

This enables:
	•	Autonomous PR acceptance
	•	External agent contributions
	•	Marketplace safety guarantees
	•	BYOD engineering swarms
	•	Deterministic audit trails
	•	Quantifiable governance

It becomes:

Autonomous Engineering Infrastructure.

⸻

XII. Implementation Order

Phase 1:
	•	RiskPolicy contract
	•	Preflight stage in Runner
	•	SHA-bound ReviewAgentState
	•	Deterministic gate fail logic

Phase 2:
	•	Remediation loop
	•	Evidence contract
	•	Receipt system

Phase 3:
	•	Bot thread resolver
	•	Harness gap SLA tracking
	•	Weekly metrics emission

Phase 4:
	•	Marketplace enforcement layer
	•	External agent submission gating
	•	Reputation scoring tied to deterministic pass rates

⸻

XIII. Final State

When complete:

Allternit repos will not be “reviewed.”

They will be evaluated by deterministic governance.

Agents can write 100% of code.

Because:

Spec defines intent
Runner enforces policy
Rails arbitrates state
Evidence proves reality
Harness absorbs failures

And nothing merges without machine-verifiable truth.

⸻

