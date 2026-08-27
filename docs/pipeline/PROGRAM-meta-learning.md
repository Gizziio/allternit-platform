# Program: the Meta-Learning Loop (M1–M4)

> Locked decisions (2026-08-02). The system learns facts (taste precedents);
> this program makes it learn SKILLS — systematically, deterministically, at
> the moment learning happens, audited before adoption, stored in the second
> brain, visible across surfaces.

## M1 — Event-driven learning capture (learn when it happens, reflect at boundaries)

Not cron. Two deterministic triggers, mirroring how humans learn:
- **Learnable moments** (capture immediately): every steering verdict
  (APPROVE/STEER/REJECT), every gate block, every outcome, every dismissal
  appends an event to `docs/pipeline/learn/events.jsonl`
  `{ts, kind, refs, summary}` — written by the hook/consult scripts at the
  moment they happen.
- **Reflection points** (synthesize at completion): at the end of every
  pipeline run and every executor phase, `docs/pipeline/bin/learn-reflect.sh`
  distills recent events into playbook rules (imperative, confidence-scored,
  provenance-linked) in `docs/pipeline/playbook.md`, consumed by every future
  consult (steering, spec-checker, brief writer).

## M2 — Learned artifacts, audited before adoption

Learnings become upgrades to skills, plugins, workflows, cookbooks, loops,
and graph loops — but NOTHING is holy writ: every proposed artifact change
(prompts, rubrics, playbooks, new skills) goes through the pipeline's own
audit (spec-checker-style review) before landing. The system edits itself
only through its own gate.

## M3 — The second brain is the learning store (dogfood)

All learnings are written as frontmatter pages (`type: lesson|decision|idea|pain`,
status, domain, provenance_refs) into the Allternit brain repo — we eat our
own cooking. For end users: `gizzi brain init` (or platform onboarding)
creates their brain automatically, and their agents' learnings save there
too, alongside their project files — per-project and cross-project.

## M4 — Second brain across surfaces

Visible and forkable. Decision: the brain is a FIRST-CLASS section of each
surface (not buried in miniapps) — web: dedicated Brain section (pages API);
iOS: capture-first (idea/pain offline queue); desktop: hosts the local
services. Miniapp embeds only for quick-capture widgets. Forking a brain =
git fork semantics (clone-url per brain via D2).

## Phase order

M1 (capture + reflect + playbook consumption) → M3 (brain persistence of
learnings, shares plumbing with M1) → M2 (artifact proposals through audit)
→ M4 (surface sections). M1 builds now.
