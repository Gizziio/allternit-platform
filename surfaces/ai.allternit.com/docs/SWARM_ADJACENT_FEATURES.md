# Swarm-Adjacent Features — Brainstorm

Product features the swarm sandbox tier (`src/lib/sandbox/swarm/`) would unlock
beyond the MiroFish prediction feature itself. This is a brainstorm for Eoj to
pick from, not a spec — each entry is short on purpose.

## Training-data / preference-pair generation

Run large persona-diverse agent populations against the same prompts or
scenarios and harvest their divergent responses as DPO/RLHF preference pairs
or SFT training data, at a volume that's impractical with real human labelers.
**Tradeoff:** quality is bounded by persona diversity/realism — needs periodic
validation against real human data to avoid synthetic-data drift compounding
over training runs.

## Vertical/domain-specific agent personas (standalone offering)

Package pre-built, curated swarms of realistic personas for a given vertical
(e.g. "1,000 SMB owners," "500 healthcare compliance officers") that
customers can query directly — decoupled from the prediction-report use case,
sold as a persona/panel product on its own.
**Tradeoff:** credibility requires real per-vertical curation and ongoing
upkeep as personas go stale — this becomes a content-ops commitment, not
just infra you build once.

## Synthetic user research / product testing at scale

Run a new feature idea, UX flow, or pricing page copy past thousands of
persona agents to get qualitative reactions and aggregate signal before
committing to real user research or a build.
**Tradeoff:** can't fully substitute for real users — risk of teams
over-trusting synthetic signal for decisions that actually need humans;
positioning as "pre-screening," not "replacement," matters.

## Social/media simulation & virality forecasting

Seed a piece of content (post, headline, ad) into a simulated social graph
of agents and observe propagation, engagement, and backlash patterns before
it goes live.
**Tradeoff:** dual-use risk — the same capability tests manipulation/
propaganda content, so this needs explicit use-case guardrails before launch.

## Multi-agent negotiation / game-theory sandboxes

Spin up opposing agent populations (buyer/seller, union/management,
competing bidders) to stress-test a policy, contract term, or pricing
strategy before real-world deployment.
**Tradeoff:** output quality is entirely dependent on how well each agent's
incentives/utility function is modeled — garbage-in-garbage-out risk is high
and hard to detect from the outside.

## Load/chaos testing for other agentic products

Reuse the swarm tier itself, independent of MiroFish, to spin up thousands
of concurrent agent sessions against a target system (allternit's own APIs,
or a customer's product) purely as a load/chaos-testing tool for
agent-facing infrastructure.
**Tradeoff:** this is an internal dev-tool, not a customer-facing feature —
weaker/different monetization story than the other entries here.

## Digital-twin customer support / onboarding simulation

Replay a support flow or onboarding funnel against a swarm of persona agents
with varied backgrounds to surface drop-off points and confusing steps
before shipping changes to real users.
**Tradeoff:** needs tight integration with the actual product surface (not
just text prompts) to produce realistic signal — meaningfully higher build
cost than the purely text-based ideas above.

## Swarm-as-a-primitive API for internal teams

Expose "swarm + report" as a standalone internal building block other
allternit features or teams can call, independent of the specific
news/policy prediction workflow MiroFish is built for.
**Tradeoff:** requires a stable, documented API contract early, which is in
tension with wanting to iterate fast on the underlying simulation engine
while MiroFish itself is still new.
