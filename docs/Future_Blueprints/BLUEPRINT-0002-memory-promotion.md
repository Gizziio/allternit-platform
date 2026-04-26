# /spec/Deltas/0002-memory-promotion.md — Layered Memory + Deterministic Promotion (RLM path)

Date: 2026-01-27
Status: PROPOSED

## Intent

Formalize the memory substrate as layered packs and implement a deterministic promotion pipeline that allows agents to auto-learn without silent drift. Add an RLM policy layer to modulate retention/decay/strength, but only within non-law layers.

## Laws enforced

- Memory access requires WIH-declared pack + layer + access.
- Session and proposal activity cannot mutate law memory.
- Promotions are deterministic: rules + required checks + receipts.
- Auto-approve is allowed where rules permit.

## Layers

1) law — boot truth (SOT/spec/contracts/CODEBASE)
2) graph — task DAG state + resume cursors
3) execution — run logs, artifacts, receipts
4) semantic — indexes/embeddings for retrieval speed (non-authoritative)
5) proposal — candidate improvements awaiting promotion

## Proposal artifact

- Stored at `/.allternit/proposals/<proposal_id>.json`
- Must conform to `Proposal.schema.json`

## Promotion rules

- Stored at `/spec/Contracts/PromotionRules.schema.json` (schema) and a concrete ruleset (e.g., `/agent/promotion_rules.json`).
- Each rule declares kinds, risk, required checks, auto_approve.

## RLM policy surface

RLM tunes:
- decay rates per layer
- confidence thresholds
- retention budgets
- recency bias
- write strength

RLM may only influence:
- semantic
- execution
- proposal

RLM must not:
- rewrite law memory
- bypass acceptance tests
- bypass promotion rules

## Acceptance tests

- **AT-MEM-0001..0004** must pass.
- Add: **AT-PROMO-0001** promotion emits diff + receipt.
- Add: **AT-PROMO-0002** auto-approve only when rule satisfied.
- Add: **AT-PROMO-0003** rollback restores prior hashes.

