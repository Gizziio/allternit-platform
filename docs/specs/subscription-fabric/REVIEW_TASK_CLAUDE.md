# Review Task — Subscription Capability Fabric (Architecture Reviewer)

You are reviewing an architecture spec for a new Allternit subsystem. You are the **architecture reviewer**. Your output feeds a synthesis that produces a hardened spec + implementation plan.

## Read first

1. `docs/specs/subscription-fabric/SPEC.md` — the full spec (this is the subject of your review).
2. `REPO_STRUCTURE.md` (repo root) — to ground your recommendations in this monorepo.
3. Explore the repo as needed (it is Rust + TypeScript; long-running daemons live in `services/`, TS libs in `platform/packages/`, web/desktop surfaces in `surfaces/`).

## Context (do not relitigate)

- The user owns every subscription account that will be connected. ToS risk is accepted by the user — do not spend your review arguing ToS. Instead, cover **operational risk**: UI brittleness, session health, detection/abuse-signal avoidance, graceful degradation.
- Target providers: ChatGPT, Claude, Kimi web apps first, with adapter extensibility so Gemini and similar chat-subscription providers can be added cheaply later.
- The implementation will live inside THIS monorepo.

## Your review focus (architecture)

1. **Schema critique** — §9 capability taxonomy, §11 entitlement model, §13 artifact metadata, §20 task schema, §15 thread mapping. What's missing, contradictory, or under-specified? Propose concrete field-level fixes.
2. **Adapter interface (§29) & router (§30)** — is the interface sufficient for streaming, progress, partial artifacts, cancellation mid-stream, auth-expiry recovery? What methods/types are missing?
3. **Extensibility** — is "add a new provider adapter" actually cheap under this design? What would make it cheaper (adapter SDK, selector registry, capability probes, manifest-driven routing)?
4. **Failure taxonomy (§31) & quota model (§33)** — gaps; how should unknown-quota routing actually behave under uncertainty?
5. **Concurrency/session model (§17, §19, §34)** — single-flight per provider, persistent workers, profile isolation. Failure modes not covered?
6. **Security (§25)** — concrete gaps for a localhost daemon holding live provider sessions.
7. **What's over-built for MVP** — what should be cut or deferred vs. what the spec phases already say.

## Deliverable (REQUIRED)

Write exactly one file: `docs/specs/subscription-fabric/REVIEW_CLAUDE.md` starting with YAML frontmatter:

```yaml
---
status: done
reviewer: claude
summary: <one sentence>
---
```

Then sections: `## Verdict`, `## Critical issues` (numbered, each with spec-section ref and a concrete fix), `## Schema changes` (concrete field additions/edits), `## Architecture changes`, `## MVP cuts`, `## Adapter extensibility design`, `## Open questions for the human`.

## Constraints

- Review-only. Do NOT modify any existing file. Do NOT create any file other than your review file. No git operations. No builds or dev servers.
- Be specific: cite spec section numbers; propose actual field names, types, and interface signatures — not vague advice.
