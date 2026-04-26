Below is a production-grounded taxonomy of agent types (what’s emerging in the wild), the infra primitives each one forces, and a straight answer on “platform that runs agents” vs “autonomous engineering cloud.”

1) Agent types emerging in production use (and what infra they require)

A. Interactive “in-the-loop” coding agents (IDE / PR assist)

What they are: user-driven sessions; agent helps draft changes, respond to review, small scoped tasks.
Common surfaces: GitHub/VS Code “assign agent to issue/PR” style workflows.  ￼
Infra required:
	•	short-lived sessions
	•	repo access + branch/PR integration
	•	moderate isolation (often trusted user context)
	•	receipts for reviewability
Allternit offering check: Yes, as a mode of your Control Plane + Execution Driver, but it’s not your differentiator.

⸻

B. Background agents (scheduled / queue-driven PR factories)

What they are: autonomous workers pulling from issue trackers/queues, producing mergeable PRs repeatedly. Ramp’s “Inspect” is a direct example: it verifies work (tests), produces previews/screenshots for UI work.  ￼
Infra required (non-negotiable):
	•	spawnable isolated envs at scale (many concurrent clean rooms)
	•	deterministic env definition + automated lifecycle
	•	internal services access (staging/test), safely
	•	policy + quota + cost controls
	•	provenance/receipts to justify merges
Allternit offering check: Must be first-class. This is the core reason you’re doing microVM isolation + driver abstraction.

⸻

C. “Cloud agents” / remote agents (off-device execution)

What they are: agent runs in cloud VM/microVM, not on the user laptop; can be triggered by GitHub events, schedules, etc. Google Jules explicitly describes cloud-VM autonomous PR creation, and provides GitHub Action triggers.  ￼
Infra required:
	•	remote execution substrate
	•	event triggers (webhooks/schedules)
	•	secrets/credentials broker
	•	artifact storage + receipts
Allternit offering check: Yes, via drivers + eventing + governance.

⸻

D. 24/7 “continuous maintenance” agents

What they are: always-on agents doing dependency bumps, test fixes, lint/format, refactors, doc updates, backlog grooming. Jules pitches “random tasks you don’t want to do” (version bumps, tests, bug fixes) and can be triggered repeatedly.  ￼
Infra required:
	•	persistent queues + schedules
	•	cost metering + budgets (or they will run forever)
	•	merge governance (risk-tiered auto-merge)
	•	replayability + rollback
Allternit offering check: Yes, but only if you implement N11 (economics), N19 (merge gates), N12 (replay).

⸻

E. Swarm / “agent teams” (parallel decomposition)

What they are: lead agent splits work across multiple agents, aggregates results. Claude Code “agent teams” is the canonical example of coordinated multi-session work.  ￼
Infra required:
	•	DAG orchestration + task sharding
	•	concurrent env spawn with strong isolation
	•	conflict arbitration (file/PR merges)
	•	shared context via explicit channels (not shared state)
Allternit offering check: This is your differentiator—your scheduler + swarm runtime + arbitration.

⸻

F. Closed-loop verification agents (test/preview/monitoring feedback)

What they are: agents that don’t stop at “diff”; they run tests, generate previews, capture screenshots, check monitoring, iterate until green. Ramp’s Inspect emphasizes visual verification and previews.  ￼
Infra required:
	•	full inner loop automation in env lifecycle
	•	service orchestration (dbs, caches, local stacks)
	•	UI verification pipelines (headless browser, screenshot artifacts)
	•	strict policy boundaries (monitoring access ≠ prod write access)
Allternit offering check: Yes, but it forces “environment lifecycle automation” as core (Layer 3 + hooks).

⸻

G. Agent hub integrations (platforms aggregating multiple agents/models)

What they are: “pick your agent” hubs that let users assign different agents to tasks, often integrated into SCM tooling. GitHub Agent HQ is explicitly a hub model.  ￼
Infra required:
	•	agent registry + capability model
	•	run routing + eval harness
	•	consistent receipts/provenance across agent backends
Allternit offering check: Yes (marketplace + agent registry), but only after the execution fabric is real.

⸻

2) The infrastructure primitives all these share

Across every serious production class above, you keep seeing the same invariants:
	•	Isolated execution units (microVM/VM is the clean baseline for multi-tenant)  ￼
	•	Reproducible environment definitions (Dev Containers is a standard portability surface)  ￼
	•	Automated lifecycle (install/start services/seed/readiness)
	•	Policy + ephemeral creds (assume compromise)
	•	Provenance + replay (enterprise trust)
	•	Economics (metering, quotas, budgets)

That aligns exactly with your 3 layers.

3) “Platform that runs agents” vs “Autonomous engineering cloud”

Yes—when I say “autonomous engineering cloud,” I’m implying more than a hub.

Option 1: Platform that runs agents (Control-plane product)

Think: “agent OS” that can orchestrate work, but execution can be “bring your own substrate.”
	•	You provide: scheduler, policies, receipts, registry, governance UI.
	•	Execution happens: in the customer’s CI, their K8s, their VPC worker pool, etc., via drivers.

Pros
	•	Faster to ship
	•	Easier enterprise adoption (they keep compute inside their world)
	•	Lower capital burden (you’re not a cloud provider)

Cons
	•	Harder to guarantee autonomy outcomes (customers’ substrate quality varies)
	•	You inherit “works on my infrastructure” variability
	•	Swarm performance/latency less predictable

Option 2: Autonomous engineering cloud (Full-stack managed execution fabric)

Think: you are effectively offering a managed swarm compute fabric with strong guarantees:
	•	You operate the execution substrate (microVM pools, caching, prewarm, autoscale)
	•	You provide end-to-end “agents produce mergeable PRs reliably” as a managed service
	•	You may still support “run in your VPC” like Ona positions (their stories emphasize sandboxed ephemeral environments and running in customer VPC).  ￼

Pros
	•	You can guarantee autonomy and throughput (the “productivity exponent”)
	•	You can standardize env lifecycle and security posture
	•	Best path to “agents > humans in usage hours”

Cons
	•	You become a cloud operations company (SRE, incident response, capacity planning)
	•	Compliance/security burden increases
	•	Cost control becomes existential (prewarm pools + egress + storage)

The real difference in one line
	•	Platform that runs agents: you sell orchestration + governance.
	•	Autonomous engineering cloud: you sell orchestration + governance + guaranteed execution throughput (you own the fleet).

4) Your “utility thesis” is correct

scale + parallelism creates productivity exponents, and being the platform that enables that setup is the real utility

Correct—but the exponent only appears when:
	•	spawn latency is low (prewarm/caching)
	•	isolation is real
	•	lifecycle is automated
	•	governance is enforceable
	•	economics are boun
