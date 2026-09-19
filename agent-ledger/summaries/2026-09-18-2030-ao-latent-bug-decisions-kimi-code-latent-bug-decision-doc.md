# 2026-09-18 — Latent runtime bug decision list (docs)

- **Agent:** kimi-code (subagent)
- **Branch:** `ao/latent-bug-decisions` → PR **#633**, merged `560c13b8a` (merge commit)
- **Deliverable:** `docs/programs/gizzi/LATENT_BUG_DECISIONS.md` (docs-only; the only file in the PR)

## What was done

Compiled the owner-decision document for the latent runtime bugs surfaced by the
2026-09-18 typing / lint / burn-down work (platform PRs #577–#630, allternit-ai PRs
#23–#41) and deliberately left unfixed under behavior-preservation rules. Sources
harvested: PR bodies (grep for latent / runtime bug / not fixed / flagged) on both repos,
plus `agent-ledger/summaries/2026-09-18-*` burn-batch summaries (b0001–b0016).

Every candidate item was **re-verified by reading current main** before receiving a row —
nothing entered the table unverified:

- Platform first read @ `5ca613f8c`, re-verified after b0016 landed @ `ba75db051`
  (b0016 touched none of the flagged files — confirmed by direct re-read of
  `cowork.runtime.ts`, `workspace-loader.ts`, `textHighlighting.ts`, `bash.ts`).
- allternit-ai read @ `53cbeca6` (merge of allternit-ai#41, the final any-burn slice).

Final content:

- **19 still-broken rows** (5 platform P1–P5, 14 allternit-ai A5–A20 — the A-numbering
  keeps the caller's known-item numbering), each with file:line evidence, user-visible
  symptom, specific fix approach, effort S/M/L, risk, source cross-link, blank
  OWNER DECISION column (FIX / DEFER / WON'T).
- **11 DONE rows** for same-day findings already fixed by later merged PRs (platform
  #602 ×2, #613, #616, #620; allternit-ai #30–#33, #40 guard, #41), so "fix all" does not
  re-open them. Known item 14 (DesignPropertiesPanel `type: undefined`) verified as
  GUARDED by allternit-ai#40 — recorded DONE, not still-broken.
- **Appendix "How to execute a FIX"** with per-repo gate recipes (platform: ensure-sdk-dist
  → tsc → bun smoke → release-preflight → eslint + queue.json guard contract; allternit-ai:
  typecheck 24-line baseline → build → lint:ratchet → vitest zero-new-failures rule).

Notable verification outcomes: the `USER_TYPE === 'ant'` family (P3) is a deliberate
build-time DCE pattern (`AgentTool.tsx:1288` documents it) — row framed as
WON'T-with-hygiene after confirming the one genuine gate-mismatch instance was fixed by
PR #613. Item 10's native task/plan branches already have `mapStatus` normalizers; only
the dynamic-tool branch at `CoworkRightRail.tsx:162` still pushes raw status.

## Verification evidence

- Docs-only PR; no code, configs, or `queue.json` touched; no installs.
- Rebase onto `origin/main` after concurrent b0016 / receipt-format-tests merges landed;
  all platform rows re-read on the new HEAD before merge.
- PR #633 merged with `--merge` (merge commit `560c13b8a`); shared checkout
  `pull --ff-only` to `560c13b8a`.

## Incidents / deferrals

- None. The 19 open rows await owner decisions (FIX / DEFER / WON'T) in the document
  itself; A5 and A8 flagged in the doc as needing explicit owner sign-off on the enabled
  behavior, not just the code, because fixing them activates currently-dead features.
