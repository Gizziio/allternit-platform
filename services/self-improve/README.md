# allternit-self-improve

Scaffolding for an evolutionary self-improvement loop, in the
"agents-as-diffs" lineage (pattern: Meta's `facebookresearch/hyperagents`).

A meta-agent rewrites a task-agent's code. Every generation produced is
stored as a diff from its parent (or from nothing, for a root generation).
A protected evaluation surface — the eval harness itself, its golden data,
whatever else a generation must never be able to rewrite to cheat its own
grading — can never appear in a produced diff. A cheap staged evaluation
gates a full evaluation, so a full run only happens once a generation has
already cleared a cheap bar.

This crate is scaffolding: types and traits, a lineage archive, a
working-copy lifecycle, and a staged-gate orchestrator. It does not run an
agent, call an LLM, or drive a loop. See "Non-goals" below.

## The pattern

1. `lineage::LineageArchive` records each generation as `{id, parent_id,
   patches, valid, score}`. Reconstructing generation `g`'s code is a pure
   walk of the parent chain, concatenating each ancestor's ordered patch
   files — see `LineageArchive::patch_chain`.
2. `lineage::ParentSelection` picks which existing generation the *next*
   generation should be bred from: `Latest`, `Best` (highest score), or
   `ScoreProportional` (sigmoid-weighted sampling with an over-use penalty,
   `w = sigmoid(score) * exp(-(children/8)^3)`, so a handful of generations
   don't monopolize every future breeding step). Selection takes a seeded
   RNG and is deterministic for a given seed.
3. `working_copy::WorkingCopy::create` scratch-copies a target repo,
   excluding protected paths from the copy outright. `apply_patches` runs
   `git apply` over the reconstructed patch chain, surfacing the first
   failure rather than continuing past it. `finalize_diff` force-resets
   protected paths back to the original source before producing the
   generation's diff, and that diff is passed through
   `filter_patch_by_paths`, which drops any per-file block touching a
   protected path *and then re-verifies* the protected path string is gone
   from the result — if it isn't, that's a hard error, not a best-effort
   filter.
4. `eval::StagedGate` runs a `ValidityCheck` (a compile/typecheck gate),
   then an `Evaluator::eval_subset` at a small `fraction`, and only runs the
   full (`fraction = 1.0`) evaluation if every staged score was `> 0`. The
   resulting `EvalReport` (`scores` map + `valid` bool + `fraction`) is what
   gets recorded back onto the generation.

## Safety rules

- **Protected paths can never appear in a produced diff.** This isn't a
  best-effort exclusion list — `working_copy::filter_patch_by_paths` filters
  by path and then re-verifies the protected path string is absent from the
  filtered output, returning `WorkingCopyError::ProtectedPathLeak` instead
  of the diff if verification fails. A generation cannot rewrite its own
  grading criteria, the harness that scores it, or anything else marked
  protected.
- **No network assumptions.** Nothing in this crate makes an HTTP request,
  calls a provider API, or assumes internet access. `git apply` / `git diff`
  are the only subprocesses invoked, and only against local paths.
- **Validity gates before evaluation.** `StagedGate` always runs
  `ValidityCheck` first; a generation that doesn't compile/typecheck never
  reaches an evaluator, staged or full.
- **Staged before full.** A full evaluation only runs after every staged
  score clears the `> 0` bar, so a broken generation's cost is bounded by
  the cheap subset, not the full suite.

## Non-goals (intentionally out of scope here)

- Running agent code anywhere — container, VM, or otherwise. Execution is
  entirely behind the `Evaluator` / `ValidityCheck` traits; this crate has
  no process/container/VM spawning of its own beyond `git apply` / `git diff`.
- Any meta-agent, prompt, or LLM/provider call. There is no LLM dependency
  in this crate.
- A wired-up, scheduled loop that actually runs generations end-to-end.
  This is the substrate the platform can build that loop on top of.

See `src/lib.rs` for the module-level integration notes, including how a
real `Evaluator` is expected to eventually dispatch through the platform's
`ExecutionDriver` (`platform/contracts/driver-interface`) rather than
spawning execution itself.
