# The Self-Steering Program — Features & Future Enhancements

> Companion to `docs/PROGRAM_ARTIFACT.html`. Documents every shipped feature,
> how to use it, and the enhancement roadmap. Last updated: 2026-08-02
> (main @ `f1297f804` + artifact `7082f9ea5`).

---

## 1 · The steering system (`.steering/`)

**What it is.** Independent, model-diverse review of every agent working in
this repo. A persistent steering agent (`ao-steer`, currently claude) reviews
checkpoints and gates commits; workers never grade their own homework.

**Features shipped**

| Feature | What it does | How to use |
|---|---|---|
| Checkpoint reviews | `Stop` hook consults the steering agent when `.steering/checkpoint.md` changes | Working agent updates the checkpoint file at meaningful points; feedback arrives as `[steering]` messages |
| Commit gate | `PreToolUse` hook blocks `git commit`/`git push` until the steering agent approves | Automatic; verdicts logged to `.steering/state/consults.log` |
| Gap analysis | `.steering/spec.md` requirements mapped to DONE/PARTIAL/MISSING with file:line evidence | Fill the spec at scope time; the checker enforces it at every checkpoint |
| Multi-CLI hooks | Same scripts serve kimi, Claude Code, codex, gizzi-code | `bash .steering/bin/steer-install.sh` per machine |
| Session worktrees | Every session gets its own linked worktree; shared-checkout git mutations are hard-blocked | Automatic via hooks; escape for human merges: `STEER_GUARD_OFF=1` |
| Kill switch | Disable steering per project | `touch .steering/off` |
| `steer-status.sh` | Enabled/disabled state + last 5 verdicts, any cwd | `bash .steering/bin/steer-status.sh` |

**Future enhancements**

- **ASK-HUMAN verdict** — a third steering outcome that surfaces questions to
  the user (file + notification) when the checker hits a product decision;
  the human-in-the-loop escape hatch at the loop's edge.
- **Steering verdict calibration** — OSReward-style: periodically sample
  steering verdicts against ground truth and report the reviewer's leniency
  rate (the paper the pipeline itself surfaced).
- **Gate rule packs** — declarative per-repo rules (block force-push to
  release branches, require test-command presence) as data files.

---

## 2 · The discovery pipeline (`.pipeline/`)

**What it is.** Autonomous feature discovery and build: sources → briefs →
deterministic specs → independent spec-check → rails-ticket queue → worktree
builders → human merge.

**Features shipped**

| Feature | What it does | How to use |
|---|---|---|
| Scout | Fetches 20+ sources (HN, Reddit, arXiv, GitHub Trending, RSS), top-5 briefs per run, cross-run dedup, rails announcements | `node .pipeline/bin/scout.cjs` (rails must be up: `make api`) |
| Generator | Deterministic brief → OpenSpec/EARS/Gherkin spec, zero LLM, byte-identical regeneration, strict rejection of malformed briefs | `node .pipeline/bin/generate-spec.cjs` |
| Spec-checker | Independent READY/NEEDS-WORK/REJECT verdicts with cited findings; 3-round cap; STALLED after | `bash .pipeline/bin/check-spec.sh` |
| Charter taste layer | `.pipeline/charter.md` decides what the pipeline may build; REJECT is final and becomes a taste precedent | Edit the charter; rejections teach the pipeline |
| Ticket queue | READY specs become rails tickets; builds ordered by graph triage (unblocks first); dependency edges from `blocks:` frontmatter | `bash .pipeline/bin/build-queue.sh --all` |
| Taste engine | Trust-tiered corpus (repo docs, brain, sessions), outcome feedback (`record-outcome.sh`), 90-day staleness, dismissal ledger | `bash .pipeline/bin/taste-ingest.sh`; `bash .pipeline/bin/record-outcome.sh <slug> <outcome>` |
| Wiki connector | Reads the second brain (frontmatter convention); idea/pain → unverified candidates; injection-proof by test | `bash .pipeline/bin/wiki-ingest.sh` |
| rails-ensure | Hard rails dependency: probe, auto-start dev API, or abort naming the blocker | Runs inside every pipeline stage; `bash .pipeline/bin/rails-ensure.sh` |

**Future enhancements**

- **Live brief-filling LLM** — briefs currently need `KIMI_API_KEY` (CI) or
  the ao-consult route; wire ao-steer as the default brief writer so live
  runs are fully self-contained.
- **Generator Gherkin depth** — acceptance scenarios are mechanical
  expansions today; richer scenario synthesis from mechanism sections
  (flagged by the checker itself as the generator's main limitation).
- **Bandit-ranked suggestions** — once outcome volume exists, Thompson
  sampling over ranking signals (which sources/domains produce accepted
  features) instead of static taxonomy scoring.
- **Dismissal → REJECT promotion** — repeated human dismissals of a pattern
  auto-propose a charter clause (the pipeline suggesting edits to its own
  taste file, human-approved).
- **iOS/web queue visibility** — the ticket queue surfaced in the app canvas
  (rails tickets already render as executor tiles).

---

## 3 · Rails (tickets · graph · mail)

**What it is.** The platform's agent coordination spine, now at full
beads+agent-mail parity, rails-named.

**Features shipped**

| Feature | What it does | How to use |
|---|---|---|
| Tickets | Event-sourced tickets (hash-chained audit), typed dependency graph with cycle rejection, shared ready computation with wait-gates | `POST/GET /api/rails/tickets`, `…/ready`; CLI `allternit-rails ticket ready` |
| Graph engineering | PageRank, HITS, betweenness, critical path, cycles — two-phase, cached, status-flagged | `GET /api/rails/graph/insights|triage|impact/:id`; CLI `allternit-rails graph …` |
| Agent mail | Agent identities, typed envelopes (to/subject/importance/ack_required), per-agent inbox/outbox, FTS search, thread digests, ack/overdue tracking | `/api/rails/mail/agents|send|inbox/:id|outbox/:id|search|overdue` |
| Lazy CLI startup | SQLite stores init per-subcommand, create-if-missing; light commands never touch SQLite | Fixed; all CLI subcommands usable |

**Future enhancements**

- **A2: JSONL interchange** — tickets.jsonl export/import for git-based
  multi-machine sync (mirrors the mail/ledger patterns).
- **A3: admission policies** — capacity limits per status, required fields
  per transition, enforced in-transaction (the beads policy model).
- **E4: contact policies** — cross-project agent links with approval
  handshakes (the agent_mail contact layer, rails-native).
- **CLI SQLite startup fix for the API binary** — same lazy-init pattern
  applied to remaining eager paths.

---

## 4 · gizzi-code

**Features shipped**

| Feature | What it does | How to use |
|---|---|---|
| Native session worktrees | Sessions start in an isolated worktree by default (opt-in), with opt-out | `worktree.autoCreate: true` in settings; `--no-worktree` per launch |
| `gizzi brain` | Second-brain creation and management | `gizzi brain init [--path|--force]`, `gizzi brain` (status), `gizzi brain sync`, `gizzi brain remote <url>` |
| Brain layout | Canonical frontmatter markdown (identity/domains/decisions/runbooks/ideas/MEMORY.md), git-native, local-first | Consumed by the wiki connector + taste corpus with zero adapters |
| `brain.path` setting | Registers the brain for the agent layer | Written by `gizzi brain init`; read by taste/wiki ingest |

**Future enhancements**

- **W3: worktree-by-default GA** — flip `autoCreate` default to true after
  soak time, with symlink/sparse presets for this monorepo.
- **Brain capture commands** — `gizzi brain add decision|idea|pain` writing
  frontmatter pages from the CLI.
- **brain.memory ↔ second brain bridge** — the pre-existing triple-store
  memory (`gizzi brain memory`) and the new git brain unified behind one
  query path.

---

## 5 · Platform & iOS (brain era)

**Features shipped**

| Feature | What it does | How to use |
|---|---|---|
| Brain remotes (D2) | Per-user bare git repos on the platform, smart-HTTP push/pull, `allternit_git_` tokens (hash-stored, mint-once) | `POST /api/v1/brains`; `POST/GET/DELETE /api/v1/tokens/git`; `GET /api/v1/brains/:id/pages` |
| iOS git spike (D3) | Embedded git client proven: clone/commit/push over token auth + TLS from the simulator | Verdict + report: `docs/BRAIN_D3_SPIKE.md` (GO) |

**Future enhancements**

- **D3-R1: onboarding brain creation** — one-tap brain setup in the iOS
  onboarding flow (spike-proven library, page insertion point identified).
- **D3-R2: offline capture queue** — capture idea/pain notes on-device with
  local commit + background push, retry on connectivity.
- **Apple Developer team setup** — device builds are signing-blocked
  (`DEVELOPMENT_TEAM` placeholder; zero identities on the build machine).
- **D2b: brain web surface** — read/edit brain pages in the app canvas via
  the pages API.
- **Remote sync soak** — conflict UX for multi-device brains (git conflicts
  surface as instructions today; guided resolution later).

---

## Cross-cutting knowns

- **Memory agent (port 3201) is down** — taste ingestion is advisory and
  logs to `.pipeline/errors.log`; the corpus fully lights up when it's back.
- **Dev API must hold port 8013** — `make stop && make api` swaps the
  packaged app for the dev instance (`ALLTERNIT_LOCAL_DEV_BYPASS=1`).
- **`--no-verify` convention** — checkpoint-only bookkeeping commits skip
  the gate to avoid circular consults (approved pattern; code commits never
  skip).
- **Executor idle-nudge pattern** — long-running executors occasionally end
  a turn before the final commit; one `ao-send` nudge resumes them. A
  standing improvement would be a turn-end checklist assertion in the
  orchestrator's task template.
