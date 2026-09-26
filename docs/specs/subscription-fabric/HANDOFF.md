# Handoff — Subscription Capability Fabric

**Date:** 2026-09-26
**From:** Kimi session (context exhausted)
**To:** Fresh Kimi session
**Owner:** Eoj

---

## 1. What this is

Allternit **Subscription Capability Fabric**: a normalized, provider-agnostic capability layer that turns paid consumer AI subscriptions (ChatGPT, Claude, Kimi — later Gemini etc.) into addressable entitlements that Allternit Bots/Threads invoke programmatically. Bots request capabilities; the fabric chooses entitlements; adapters execute them; artifacts come back normalized (SPEC §44 invariant).

Origin doc: `~/Downloads/ALLTERNIT_SUBSCRIPTION_CAPABILITY_FABRIC.md` (copied here as `SPEC.md`).

## 2. Where everything lives

Worktree: `~/Desktop/allternit-workspace/allternit-session-subsfab` (branch `session/subsfab`, cut from `origin/main` @ `b1bf20057`).
All docs in `docs/specs/subscription-fabric/`:

| File | What it is |
|---|---|
| `SPEC.md` | Original architecture lock (terminology, phases, interfaces) |
| `HARDENING.md` | **Binding amendments — supersedes SPEC.md on conflict.** Decisions D1–D15, critical fixes A1–A10, schemas S1–S7 summary, extensibility X1–X7, MVP cuts C, progress/completion P (D11–D12), surface matrix §M |
| `IMPLEMENTATION_PLAN.md` | Stack/placement, full file layout, phases P0–P7 with per-phase verify gates, testing strategy, risk register |
| `REVIEW_CLAUDE.md` | Claude's architecture review (accepted in full; normative TypeScript schemas/interfaces in §S1–S7, §A1–A2 — transcribe these in P0) |
| `DESKTOP_BRIDGE_RESEARCH.md` | Web-researched desktop-automation stack (CDP-first, Windows guest, fallback ladder, caveats) |
| `REVIEW_TASK_CLAUDE.md` / `REVIEW_TASK_CHATGPT.md` | The review briefs used (ChatGPT one unused — codex quota was exhausted; can rerun for a second opinion) |

**Git state: everything is UNTRACKED and UNMERGED on `session/subsfab`.** Per repo AGENTS.md ("merge before you leave"), approved work must be committed → PR → merged to `origin/main` (merge commit, not squash), then shared checkout fast-forwarded, attestation in `agent-ledger/`, worktree teardown. Eoj has NOT yet approved the docs — confirm with him before merging.

## 3. Decisions locked (don't re-litigate)

- **Stack:** TypeScript/Node ≥20, pnpm. Daemon = `services/subscription-gateway/`; contracts + adapter SDK in `platform/packages/`; CLI subcommands in existing `cmd/allternit`. SQLite (better-sqlite3, pinned 13.0.3), state at `~/.allternit/subscriptions/`. UDS default, TCP 7788 optional+token-always (7788 verified collision-free; add to `docs/Operations/QUICK_REFERENCE.md` port table in P1).
- **Adapter contract is streaming** (`AsyncIterable<AdapterEvent>`), **at-most-once submission** with `markSubmitted()` + crash `reconcile()` (no blind resubmit, ever), **detached watches** for long provider-side tasks.
- **Progress streaming (D11) and push completion (D12) are v1 requirements**: scrape native provider progress + 15s heartbeats; durable per-caller outbox + CommRails/desktop/MCP notify. Callers never poll.
- **Model picker naming (D13):** `subs/<provider>:<model_class>` (e.g. `subs/chatgpt:reasoning`), registered via the same provider-registry path gizzi-code uses for CLI-subscription OAuth.
- **Quota (A4):** pool-based (`QuotaPool` per provider/account/pool), `observed_model` downgrade detection, unknown pools stay eligible above metered lanes, cooldown ladder, circuit breaker → `ui_drift`.
- **Two adapter lanes (D14):** web default, **desktop apps as committed geo-block-resilient fallback lane**. Desktop bridge is **CDP-first** (Electron `--remote-debugging-port`; Kimi/Tauri via WebView2 env flag) on a **Windows guest image** → UIA (FlaUI/pywinauto) → vision agents (Agent S2/UI-TARS-desktop) as last resort. Research in `DESKTOP_BRIDGE_RESEARCH.md`.
- **Containment (D15):** fabric NEVER runs on the user's daily driver. One managed "Allternit Sessions" machine image, three provisioning tiers: **T1 Hosted** (user's Allternit cloud VPS allotment), **T2 BYOC** (user's own machine via `cmd/allternit-node`), **T3 Local-contained** (local VM via `drivers/apple-vf`/`firecracker` or bot-desktop-sandbox). Settings → Sessions Computer panel in the desktop app shows it in every tier.
- **Security:** gateway sole owner of browser profiles; real Chrome, human pacing (ChatGPT 150 / Claude 80 / Kimi 60 tasks/day defaults); challenge → halt worker + human, never auto-retry; keychain-held secrets; structurally local/single-tenant only (refuses boot without keychain).
- **Gates:** publish/external side effects always human-approved (D9); refusals never auto-shopped (D7); thread migration asks interactive, waits background (D8); metered fallback opt-in per task (off by default).
- **Extensibility (X):** adapter SDK + selector registry with drift telemetry + `DeclarativeChatAdapter` — Gemini is the designated proof (P6: `gemini-web` with NO `adapter.ts`).
- **`chatgpt-image` lane migrates onto the fabric** (D6, one automation identity per account) in P3.
- Owner accepted ToS risk for his own accounts; do not relitigate. Legal review flagged before ever offering the desktop lane commercially.

## 4. Repo grounding (verified paths)

- Reuse: `@allternit/browser-tools` (Playwright/CDP), `@allternit/replies-contract` + `replies-reducer` (streaming vocab), `bot_desktop_queue.rs` queue pattern, `bot_events` ledger (V180), `content_artifacts` (V148), `llm_gateway/provider_routing.rs` (metered fallback boundary — do NOT duplicate), `bb_threads.provider_thread_id`, `provider_routes.rs` subscription-connect UX, office-pptx/xlsx/docx packages (artifact rendering).
- Port discipline: 8013 = installed Desktop; dev default 18013; never export `ALLTERNIT_API_PORT=8013`.
- Naming: always "Subscription Gateway" — "gateway" is overloaded in this repo.

## 5. What happens next (in order)

1. **Eoj reviews the docs.** Open items for him: approve/amend HARDENING decisions; then commit + PR + merge per repo lifecycle (this session left them unmerged deliberately).
2. Optional: rerun the ChatGPT second opinion — codex quota resets ~2:29 AM; brief is `REVIEW_TASK_CHATGPT.md`, output `REVIEW_CHATGPT.md`. Orchestrate via `ao-spawn` (skill: agent-orchestrator; `ao-doctor` first). Claude ran headless: `claude -p "$(cat TASK)" --dangerously-skip-permissions; touch <sentinel>`. Watch with `ao-watch`; note the known PANE-DEAD race — check the review file itself before concluding failure.
3. **Start P0** (contracts package) per `IMPLEMENTATION_PLAN.md` §2 — fully scoped; transcribe REVIEW_CLAUDE.md §S1–S7/A1–A2 into zod + TS. Each phase = one session worktree + one reviewable PR. Consider orchestrating implementation via the agent-orchestrator skill (Gate 0: `allternit-commrails plan new` if the CLI is on PATH — it wasn't in the previous session).

## 6. Gotchas from the previous session

- The repo's AGENTS.md mandates session worktrees, pnpm-only, `CARGO_TARGET_DIR=~/Desktop/allternit-workspace/.shared-target`, disk gate, and `scripts/git-discipline-check.sh` PASS at session end.
- agy (Antigravity) shows a folder-trust prompt on spawn — press Enter via `tmux send-keys -t <session> Enter` before `ao-send`. (agy and codex were both quota-maxed on 2026-09-25.)
- `allternit-commrails` / `wih` were NOT on PATH in the previous session; the DAG gate was skipped (≤2-step justification). Check again.
- Do not create review/task files in the shared checkout — that mistake was made and cleaned up once already.
