---
id: SD-Continuity-Usage-Guard-001
date: 2026-02-21
scope: allternit-continuity + usage observability + guard triggers
status: draft
depends_on:
  - allternit-continuity (session index + handoff emitter)
  - repo-law (enforcement gates)
---

# Spec Delta: Continuity + Usage Guard + Observability

## 0) Goal
Prevent agent runs from failing due to context window limits, rate limits, quotas, or spend by adding an automated loop:

**Measure → Predict → Compact → Handoff → Resume**

This delta defines:
- contracts (schemas + file layout)
- observability model (OTel GenAI mapping)
- guard trigger policy (thresholds + actions)
- CLI/TUI UX requirements
- acceptance tests + CI gates

---

## 1) Non-goals
- Implementing provider billing APIs end-to-end for every vendor.
- Replacing tool-native session persistence.
- Perfect token accounting (best-effort is sufficient if behavior is safe/fail-closed).

---

## 2) Definitions
- **Context pressure**: how close the active session is to the model context window limit.
- **Quota pressure**: approaching provider limits (tokens/time, spend/time, throttling).
- **Compaction**: deterministic emission of a compact “state baton” describing objective, progress, diffs, receipts, and next actions.
- **Handoff**: switching to a different runner/tool/model using the baton.

---

## 3) Canonical on-disk artifacts (MUST)
Workspace-local (repo):
- `/.allternit/receipts/receipt.jsonl` (append-only)
- `/.allternit/state/state.json`
- `/.allternit/handoff/latest.md` (points to most recent baton)
- `/.allternit/compact/compact-YYYYMMDD-HHMM.md` (new file per compaction)
- `/.allternit/usage/usage-YYYYMMDD-HHMM.json` (snapshots; optional but recommended)

Global cache (user home):
- `~/.allternit/cache/sessions.jsonl` (continuity index)
- `~/.allternit/cache/handoff/<session_id>.md`

---

## 4) Contracts (schemas)

### 4.1 Receipt schema (tool activity)
Create: `/spec/Contracts/receipt.schema.json`

Minimum fields:
- `ts` (RFC3339)
- `run_id` (uuid)
- `dag_node_id` (string)
- `tool` (string)
- `kind` ("call" | "result" | "error")
- `args_redacted` (object)
- `result_summary` (string)
- `status` ("ok" | "fail")
- `duration_ms` (int)
- `files_touched` (array of path strings)
- `diff_refs` (array: pointers/hashes to diff artifacts if used)
- `correlation_id` (string)

### 4.2 SessionContext / Baton schema
Create: `/spec/Contracts/session-context.schema.json`

Minimum fields:
- `session_id`
- `source_tool`
- `workspace_path`
- `model` (name/alias)
- `time_start`, `time_end`
- `objective` (one sentence)
- `progress_summary` (bullets)
- `decisions` (bullets)
- `open_todos` (bullets)
- `blockers` (bullets)
- `files_changed` (list of objects with keys: path, summary)
- `commands_executed` (categorized lists)
- `errors_seen` (bullets)
- `next_actions` (explicit steps, including commands)
- `evidence` (pointers into receipts, state, diffs)
- `limits` (snapshot of usage/pressure at emission time)

---

## 5) Observability model

### 5.1 Standard schema
All usage and guard events MUST be representable in OpenTelemetry metrics/spans using GenAI semantic conventions where applicable.

### 5.2 Metrics (minimum set)
- `gen_ai.usage.input_tokens` (counter)
- `gen_ai.usage.output_tokens` (counter)
- `gen_ai.usage.total_tokens` (counter)
- `gen_ai.request.count` (counter)
- `gen_ai.request.latency_ms` (histogram)
- `gen_ai.errors.count` (counter)
- `allternit.context.ratio` (gauge; 0..1)
- `allternit.quota.ratio` (gauge; 0..1)
- `allternit.guard.actions.count` (counter with labels: compact|handoff|warn)

Tags/attributes (minimum):
- `model`
- `provider`
- `runner` (claude_code|opencode|codex|copilot|etc.)
- `workspace`
- `session_id`
- `run_id`
- `dag_node_id`

### 5.3 Event log entries (minimum)
- `ALLTERNIT_GUARD_WARN`
- `ALLTERNIT_GUARD_COMPACT`
- `ALLTERNIT_GUARD_HANDOFF`
- `ALLTERNIT_GUARD_FAILCLOSED`

Each event MUST include:
- `context_ratio`
- `quota_ratio`
- `threshold`
- `action`
- `baton_path` (if generated)
- `target_runner` (if handoff)

---

## 6) Usage collectors (pluggable)
Implement `UsageCollector` interface with adapters for:
- OpenCode stats/export (preferred if using OpenCode)
- ccusage-based analyzers
- openusage-based analyzers
- tokscale (optional)

Contract:
- Collector MUST return a `UsageSnapshot`:
  - tokens_in/out/total
  - estimated context_used
  - model_context_window (if known)
  - cost_estimate (if available)
  - error/throttle indicators

---

## 7) Guard policy (thresholds + actions)

### 7.1 Context pressure thresholds
Compute:
- `context_used_est` (best effort)
- `context_ratio = context_used_est / context_window`

Actions:
- **WARN** at `>= 0.70`
  - emit `ALLTERNIT_GUARD_WARN`
  - TUI shows “Compaction recommended”
- **COMPACT** at `>= 0.85`
  - run compaction automatically
  - emit new compact file + update `handoff/latest.md`
  - emit `ALLTERNIT_GUARD_COMPACT`
- **HANDOFF (fail-closed)** at `>= 0.92`
  - MUST compact first (or reuse most recent baton if fresh)
  - MUST write receipts + state
  - MUST trigger handoff to target runner/model
  - emit `ALLTERNIT_GUARD_HANDOFF`
  - if handoff cannot be performed → stop run and emit `ALLTERNIT_GUARD_FAILCLOSED`

### 7.2 Quota pressure thresholds
Compute:
- `quota_ratio` as a normalized 0..1 pressure score derived from:
  - rate limit errors / throttling
  - budget cap % (if known)
  - tokens/day/week vs ceiling (if known)
  - repeated 429/5xx from provider

Actions:
- **WARN** at `>= 0.70`
- **COMPACT** at `>= 0.85` (optional; depends on whether compaction helps)
- **HANDOFF** at `>= 0.92`

### 7.3 Target selection policy (handoff)
`TargetSelector` MUST choose:
- new runner (different tool) OR
- same runner with smaller prompt (compacted baton) OR
- cheaper model tier

Selection constraints:
- preserve workspace path
- preserve DAG node
- preserve law gates (receipts/state/baton)

---

## 8) Compaction format (baton markdown) — MUST
File: `/.allternit/compact/compact-YYYYMMDD-HHMM.md`

Sections in fixed order:
1. Objective (1 sentence)
2. Current plan (bullets)
3. Work completed (bullets)
4. Files changed (path + summary)
5. Commands executed (categorized)
6. Errors / blockers
7. Decisions made
8. Open TODOs
9. Next 5 actions (explicit commands/edits)
10. Evidence pointers (receipt offsets, state hash, diff refs)
11. Limits snapshot (context_ratio, quota_ratio, tokens totals)

`/.allternit/handoff/latest.md` MUST always reference the newest baton.

---

## 9) CLI/TUI requirements
### 9.1 TUI status bar
Display:
- runner, model
- context ratio + slope (Δ per minute)
- quota ratio + recent throttle indicator
- active session id
- current DAG node
- guard state (OK/WARN/COMPACT/HANDOFF)

### 9.2 Hotkeys
- `C`: manual compact now
- `H`: manual handoff now (requires baton)
- `U`: open usage details view (last snapshot)

### 9.3 Non-interactive mode
Guard MUST work in headless runs; actions are automatic per thresholds.

---

## 10) Repo Law / CI gates (MUST)
### 10.1 Evidence gate
Any code modification in a run MUST have corresponding receipts entries.
- CI checks: if diff exists but no new receipts since last run marker → fail.

### 10.2 No-lazy gate
Disallow:
- placeholder implementations
- commented-out code to “skip”
- TODO-only stubs in production paths

### 10.3 Resume gate
No resume/handoff allowed unless:
- `state.json` present and valid
- `handoff/latest.md` points to an existing baton
- baton contains required sections (format validation)

---

## 11) Acceptance tests (MUST)
Add to `/spec/AcceptanceTests.md`:

1. **Deterministic baton emission**
   - Given a synthetic receipts+state, compaction produces identical baton output (stable ordering) across runs.

2. **Warn threshold**
   - Simulated `context_ratio=0.70` triggers warn event; does not compact.

3. **Compact threshold**
   - Simulated `context_ratio=0.85` produces new compact file and updates latest handoff pointer.

4. **Fail-closed handoff threshold**
   - Simulated `context_ratio=0.92` triggers compact + handoff attempt; if actuator unavailable, run halts with FAILCLOSED.

5. **Handoff preserves DAG**
   - After handoff, the next runner starts with correct `dag_node_id` and `next_actions`.

6. **Evidence gate**
   - Diff without receipts causes CI failure.

---

## 12) Implementation modules (suggested)
- `crates/allternit-usage/`
  - collectors + normalizer + snapshots
- `crates/allternit-observe/`
  - OTel emitters, local endpoints
- `crates/allternit-guard/`
  - policy thresholds + actions (compact/handoff)
- `crates/allternit-continuity/`
  - session index + handoff emitter + injector adapters

---

## 13) Work items (DAG tasks)
- MoX-Guard-001: Schemas (receipt + session-context)
- MoX-Guard-002: Compaction emitter + latest pointer
- MoX-Guard-003: Usage collector MVP (OpenCode or ccusage)
- MoX-Guard-004: OTel metrics + events
- MoX-Guard-005: Guard policy engine + headless mode
- MoX-Guard-006: TUI status + hotkeys
- MoX-Guard-007: CI gates + acceptance tests

---

End.
Yes — pairing a usage watcher (openusage/ccusage/tokscale/opencode stats) with cli-continues gives you a complete “don’t hit the wall” control loop:
	1.	measure usage continuously
	2.	predict nearing limits (context window, rate-limit, spend, quota)
	3.	trigger compaction (summarize/prune)
	4.	trigger handoff (cli-continues resume into a different runner/model)
	5.	log everything as receipts (Allternit law-grade evidence)

Below is a concrete automated setup that does exactly that.

⸻

1) Components (minimal, composable)

A) Usage collectors (choose one or run multiple)
	•	OpenCode built-in: opencode stats + opencode export provide token/cost/session breakdown and JSON export.  ￼
	•	ccusage family: ccusage (Claude Code), plus @ccusage/opencode (OpenCode usage analyzer) for consistent reporting.  ￼
	•	openusage: provider plugins (e.g., Copilot provider doc) — a generalized usage tracking approach across ecosystems.  ￼
	•	tokscale: another multi-tool token tracker covering many agent CLIs.  ￼

B) Observability backbone (standard schema)

Use OpenTelemetry GenAI semantic conventions for spans + metrics so your dashboards/alerts are portable across vendors.  ￼
Datadog’s write-up is a good reference for why the OTel GenAI schema matters for tokens/tool calls/provider metadata.  ￼

C) Control plane (Allternit Continuity + Policy)
	•	Allternit Continuity layer emits:
	•	/.allternit/receipts/receipt.jsonl
	•	/.allternit/handoff/latest.md
	•	/.allternit/state/state.json
	•	cli-continues is the handoff actuator: “resume any AI coding session” across tools.  ￼

⸻

2) The trigger logic (what you actually automate)

You want two independent thresholds:

Threshold group 1: “Context window” pressure (per active session)

You compute:
	•	context_used = input_tokens + output_tokens + tool_context_tokens (best effort; depends on what the tool exposes)
	•	context_ratio = context_used / model_context_window

Then trigger:
	•	70% → compaction reminder (soft)
	•	85% → force compaction (hard)
	•	92% → force handoff + model switch (fail-closed)

Why: compaction can fail or be low-quality; at 92% you stop gambling and move tools/models.

Threshold group 2: “Quota / spend / rate-limit” pressure (account-level)

Use OpenCode/ccusage/openusage aggregated stats for:
	•	tokens/day, tokens/week, spend/day, spend/month
	•	provider error rate / throttling

Then trigger:
	•	soft: suggest cheaper model
	•	hard: auto-switch runner/model and continue via cli-continues

(If you’re using OpenAI APIs anywhere in Allternit, you can also pull usage/cost from OpenAI’s Usage API / dashboards for account-level budgets.  ￼)

⸻

3) “Auto-compaction” strategy that won’t corrupt work

Compaction must be deterministic and evidence-first:

Compaction artifact layout

Write a single file every time compaction runs:

/.allternit/compact/compact-YYYYMMDD-HHMM.md

Sections (fixed order):
	1.	Objective (one sentence)
	2.	Current plan (bullets)
	3.	What changed (files + diffs summary)
	4.	Receipts (top tool calls + errors)
	5.	Open blockers
	6.	Next 5 actions (explicit commands / edits)

Then update:
	•	/.allternit/handoff/latest.md to point to the newest compaction artifact
	•	/.allternit/state/state.json to mark “compaction applied at T”

This makes compaction reversible and auditable.

⸻

4) “Auto-handoff + model switch” using cli-continues (the clean mechanism)

When you hit the hard threshold (e.g., 92% context or quota alarm), do:
	1.	Freeze: write receipts + state to disk (Allternit Rails API only)
	2.	Emit handoff: generate a fresh handoff.md that includes:
	•	compact summary
	•	exact next node in DAG
	•	commands to run next
	3.	Actuate: call cli-continues resume <session> --in <target-tool> (or your equivalent integration) so the new runner opens with the handoff context.  ￼

Key design rule:
	•	The handoff is not “chat memory.” It is a state baton.

⸻

5) How to wire observability to triggers (practical topology)

Option A: Local-first (no SaaS)
	•	Collector: OTel Collector on localhost
	•	Storage: Prometheus (metrics) + Loki (logs) + Tempo (traces) + Grafana

Emit:
	•	GenAI spans/metrics using OTel GenAI semantic conventions (tokens, model, tool calls, latency).  ￼

Alert rules:
	•	gen_ai.usage.input_tokens high slope
	•	context_ratio > 0.85
	•	provider throttling errors spike

Option B: Hybrid (Datadog / similar)
	•	Same OTel emitters
	•	Send to Datadog (or equivalent) for dashboards and alert routing
Datadog explicitly supports the OTel GenAI conventions conceptually (schema alignment).  ￼

⸻

6) What this looks like inside the Allternit TUI

Add a bottom status bar widget:
	•	Model: … | Session: … | Context: 63% | 1m Δ: +4% | Spend today: … | Alert: NONE

On threshold crossing:
	•	70%: yellow “Compaction recommended” (hotkey: C)
	•	85%: orange “Compaction required” (auto-run)
	•	92%: red “Handoff now” (auto-run cli-continues)

This prevents “silent death by context.”

⸻

7) The single most important standard: OTel GenAI as the “truth schema”

If you instrument everything (CLI usage parsers + Allternit runtime calls) into the OTel GenAI schema, you can:
	•	swap providers,
	•	swap CLIs,
	•	swap dashboards,
	•	keep the same alert rules.

That’s the whole point of the GenAI semantic conventions effort.  ￼

⸻

8) What to tell your coding agent (implementation directive)

Build 3 crates/modules:
	1.	allternit-usage
	•	ingests: opencode export, ccusage/openusage outputs
	•	normalizes into OTel GenAI metrics/events
	2.	allternit-observe
	•	emits OTel spans/metrics; exposes local GET /health + GET /usage
	3.	allternit-guard
	•	policy thresholds
	•	compaction + handoff triggers
	•	calls Continuity layer to write baton artifacts
	•	calls cli-continues as actuator

Hard gate rules (Repo Law):
	•	no switch/handoff without updated handoff.md
	•	no compaction without receipts snapshot
	•	fail-closed at 92%
