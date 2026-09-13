# Attestation — session/adocs2-0913 — A:// second-pass documentation

**Date:** 2026-09-13 (morning)
**Agent:** kimi
**PR:** #463 — merged as `550cccd96060d1e5ef0081dc9436c63b960d97f4` (docs-only)
**Desktop rebuild:** skipped per ritual (docs-only; nothing the desktop bundles touched)

## What was done

Grounding pass over the owner's five A:// docs, corrections, and six new
second-pass reference documents (all grounded in cited code or marked
Specified / Planned):

- Corrections: migration citations V149–V151 → V152–V154 in three docs (the
  cowork set was renumbered during #422; V149 is an unrelated data-residency
  migration); added V156–V158 everywhere; documented approval TTL/expiry,
  risk-policy path, and event idempotency in FABRIC_TRANSPORT.md and the
  developer guide; A_PROTOCOL.md §16 gained five implemented phase-2/3 items.
  No aspirational-as-implemented items found in the owner's status lists.
- New docs: A_PROTOCOL_SCHEMA.md (wire shapes + HTTP surface + error table),
  COWORK_RUNTIME_STATE_MACHINES.md, BOT_AUTHORING_SPEC.md,
  AL_IMPLEMENTATION_SPEC.md, GIZZI_WORKER_SPEC.md,
  A_PROTOCOL_CONFORMANCE_MATRIX.md (proof index + adjacent-plumbing
  not-conformance inventory). Index README updated (reference taxonomy);
  llms.txt left alone (public-docs index by established pattern).

## Verification

- 18 cited paths + key symbols grep-verified.
- cargo test -p allternit-cowork-runtime 15/15; cargo build -p allternit-api 0 errors (docs-only).

## Deferrals (now the owner's next directive)

The docs' recorded gaps — mint default principals (al/gizzi), bot dual-record
linkage, delegation-chain enforcement, canonical IntentEnvelope (+ replacing
the cowork_executions dead end), UI control-surface conformance — were handed
back as implementation work.
