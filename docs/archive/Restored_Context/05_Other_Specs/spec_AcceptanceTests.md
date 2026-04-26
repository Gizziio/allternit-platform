# AcceptanceTests (ACF v1)

This file defines **merge-authoritative** tests. Any change classified as medium/high/critical must satisfy all relevant sections.

## Global Gates (all tiers)
- `npm run typecheck` (or equivalent)
- `npm test` (unit tests)
- `npm run build:ci` (build verification)

## Medium Tier
- `npm run harness:smoke` (fast integration smoke)
- `npm run lint` (if configured)

## High Tier
- `npm run harness:api:smoke`
- `npm run security:scan` (SAST / dependency audit)
- `npm run db:migrate:dry` (if schema touched)

## Critical Tier (UI / Flow)
- `npm run harness:ui:capture` (capture evidence)
- `npm run harness:ui:verify` (verify evidence manifest + assertions)

## Notes
- All commands must produce **machine-parsable** outputs.
- All evidence produced must be bound to the current head SHA.
