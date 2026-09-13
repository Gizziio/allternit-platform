# Session attestation — artdecisions-0912 (kimi) — Artifacts API owner decisions

- **Date:** 2026-09-12 (~09:45–10:00 local)
- **Session:** `session/artdecisions-0912` → PR **#405**, merge commit `15362bc8e26501cba86e2c4c6a246b794ed26ac0`
- **Scope:** docs-only. Recorded Eoj's 7 Artifacts API decisions into `docs/design/artifacts-api.md`; no code, no desktop rebuild (docs aren't bundled).
- **Also:** comments on epic #386 and phase issues #387/#388/#389 (Phase 3 unblocked).

## What was done

Recorded the owner's 7 decisions (given verbatim in the session spec; no interpretation added):

1. **§6 hosted publish — DECIDED.**
   1. Shared Cloudflare Pages project with per-user routes (NOT per-user projects).
   2. Publish snapshots an immutable version — "what you reviewed is what is live"; does not track `current_version`.
   3. Deployments stay immutable — unpublish/takedown removes the route only.
   4. Publish IS gated on `sandbox_policy` for v1 — artifacts whose policy requests network access are rejected at publish with a clear error.
2. **§6 org relay — DECIDED.**
   5. Addressing: relay mints a new local id on receive; origin id carried in provenance (design's lean confirmed; no cross-gateway registry).
   6. Trust: NO stricter received sandbox — received artifacts render under the standard policy; provenance is displayed. No `sandbox_policy='received'` promotion flow in v1.
3. **§8 version retention — DECIDED.**
   7. Industry-standard cap of **50 versions per artifact**, admin-configurable (env or config, default 50), prune oldest — same pattern as the memory-store cap.

Mechanics of the edit: the §6 sharing-tier table rows moved OPEN → DECIDED 2026-09-12 (Eoj); the two "OPEN questions for Eoj" lists were **rewritten as dated answer lists, not deleted** (per spec — the questions are preserved as answered); §7 phasing updated (Phase 2 loses its retention item since the cap lands at version-append time in Phase 1; Phase 3 unblocked and must implement the publish gate); header status line gained a decisions-amendment note.

Issue follow-ups (all posted 2026-09-12):
- #386 (epic): summary comment with all 7 decisions.
- #389 (Phase 3): unblocked comment; publish gate (decision 4) flagged as a required Phase 3 build item.
- #387 (Phase 1): retention decided (cap 50, prune oldest) and belongs in Phase 1 at version-append time.
- #388 (Phase 2): retention decided, no retention work in Phase 2; only remaining OPEN item is §2.1 typed renderers.

## How it works

Pure documentation change — no runtime behavior. The doc is the contract the Phase 1/2/3 build sessions implement against.

## Verification evidence

- Docs-only session per spec: markdown consistency verified by full re-read of every edited region (header, §6, §7, §8) after editing.
- `grep -n OPEN docs/design/artifacts-api.md` post-edit: only the pre-existing §2.1 typed-renderers Phase 2 note remains (intentionally untouched — not one of the 7 decisions).
- `git diff --stat`: 1 file, docs/design/artifacts-api.md (+50/−32 region; 3 files incl. steering plan/checkpoint).
- No typecheck/tests applicable; no desktop rebuild (docs aren't bundled into the desktop release).

## Incidents

- None. PR #405 merged clean with `--merge` (merge commit, per convention). Vercel PR checks not a factor (docs-only, and known account-wide deploy rate limit).

## Honest deferrals

- The decisions are recorded, not implemented. Implementation deferrals stay with the phase sessions: Phase 1 owns the retention cap at version-append time (session artphase1-0912, in flight concurrently); Phase 3 owns the publish gate and Pages publish flow (issue #389).
- §2.1 typed renderers (deck/prototype/mobile) remain OPEN for Phase 2 — deliberately out of scope.
- Relay-tier implementation is decided but unscheduled (no phase claims it; §7 keeps org relay out of Phase 3).
