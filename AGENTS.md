# A://Labs — Curriculum-as-Code Pipeline

> **STATUS:** Production-ready. 10 courses, 65 modules, 0 audit issues.
>
> **LAST UPDATED:** 2026-04-17

## Session worktrees (default for ALL repo work)

Every agent session in this repo works in its OWN linked worktree — never in the shared main checkout. On your first prompt (or SessionStart), a hook injects the ritual: create-or-reuse `<repo>-session-<id>` on branch `session/<id>` and `cd` into it. A PreToolUse guard blocks `git commit/checkout/switch/merge/push/rebase/reset` and `branch -d` in the shared checkout (escape for human/orchestrator merges: `STEER_GUARD_OFF=1`). Rationale: concurrent sessions sharing one HEAD collide on branches, commits, and dirty files. gizzi-code additionally has native `--worktree` support (`src/shared/utils/worktree.ts`); making it default-on is tracked as phase W2. Linked worktrees pass all guards automatically (detected via the git dir path).

## Session landing — worktree cleanup

A session's worktree is temporary scaffolding, not a permanent workspace. Clean up so the machine does not accumulate orphaned worktrees, branches, or scratch files.

### Ongoing hygiene

Clean as you go, but never discard work that might be needed to resume.

- **Checkpoint frequently.** Commit meaningful progress and push the `session/<id>` branch to origin often so an interrupted session does not lose work.
- **Clean only disposable scratch.** During the session, delete temporary logs, debug dumps, and downloaded artifacts as soon as they are no longer needed.
- **Protect active work.** Do not delete a worktree, branch, or uncommitted changes that contain unfinished but viable work. If you are unsure whether something is still needed, leave it and document its purpose in `.steering/checkpoint.md` or the session summary.
- **Leave resumable state.** If the session stops for any reason, another agent (or a resumed session) should be able to inspect `git status`, `git branch`, and `git worktree list` and understand what was in progress.

### Final cleanup

Final cleanup happens only after the change is safely in the canonical codebase.

- **Merge first, then clean up.** Push and merge the change to the GitHub codebase, then merge it into the local `main` checkout, before doing any cleanup.
- **Write the session attestation.** Before deleting the worktree, record what was done, how it works, the commit SHA, and any unfinished work. Create a dated summary file in `agent-ledger/summaries/` using the naming convention `YYYY-MM-DD-HHMM-<session-id>-<agent-family>-<brief-topic>.md`. Append a short entry to `agent-ledger/LEDGER.md` that links to the summary file. Treat this as a signed ledger: be honest about what was actually completed versus what was deferred or left unfinished.
- **Delete the session worktree.** Once the work is merged and no longer needed, remove the `<repo>-session-<id>` worktree directory and delete the `session/<id>` branch. Do not leave stale session worktrees on the machine.
- **Remove scratch artifacts.** Delete local logs, temporary scripts, build outputs, downloaded dependencies, and debug files that are not intended to be committed.
- **Restore the original branch.** Return to the branch you started from unless the task explicitly required switching branches.
- **Verify the final state.** Before ending the session, run a quick status check (`git status`, `git worktree list`) and confirm nothing unexpected remains.
- **No local technical debt.** The machine should be left in the same clean state it was in before the task started, with no orphaned branches, worktrees, or leftover files.

## Steering checkpoints

This repo is wired for hook-based steering: when an agent session working here ends a turn, a `Stop` hook consults a **separate steering agent** (a different model family, run via the agent-orchestrator tmux tooling) — but only if `.steering/checkpoint.md` changed since the last review. So at every meaningful checkpoint (subtask finished, design decision made, before a risky change), update `.steering/checkpoint.md`: `Goal`, `Just did`, `Next`, `Open questions`. The steering agent's answers/guidance come back injected as a `[steering]` message — treat them as authoritative and act on them before continuing. Additionally, `git commit`/`git push` pass through a hard gate: they only execute after the steering agent approves. See `.steering/README.md`. Kill switch: `touch .steering/off`.

## Planning and task tracking

Use a written plan as the source of truth for the session.

- **Create a plan file.** After scoping the feature or fix with the user, use plan mode to produce a plan file with detailed, checkable todos.
- **Make todos concrete.** Each todo should describe a single deliverable or verification step that can be clearly marked done.
- **Check off as you finish.** Update the plan file as work is completed. Checked items should coincide with commits, checkpoints in `.steering/checkpoint.md`, and cleanup milestones.
- **Use the plan to verify work.** Before calling a task complete, review the plan and ensure every todo is either done or explicitly deferred with a reason.
- **Clean up the plan file.** Remove or archive the plan file once the work is merged and the session is finished, unless the project requires keeping it.

## Agent creation checklist

> **STATUS:** Canonical schema, registry contract, harness wiring, surface filtering, automation bridge, and workspace artifacts are implemented and passing verification as of 2026-07-02.
>
> See [`AGENT_CREATION_CHECKLIST.md`](./AGENT_CREATION_CHECKLIST.md) for the canonical schema, harness wiring, workspace artifacts, mode surfaces, and verification steps that every agent must satisfy.

## What Is This?

A://Labs is Allternit's learning platform. It turns the Allternit codebase into interactive, self-contained HTML course modules that are synced to Canvas LMS. The entire pipeline is automated — from code analysis → module generation → Canvas publishing → progress tracking.

## Quick Stats

| Metric | Value |
|--------|-------|
| Total Courses | 10 (7 original + 3 ADV) |
| Total Modules | 65 |
| Total Assignments | 51 |
| Canvas Launch Audit | 0 issues |
| Interactive Demo Modules | 10 |

## Course Catalog

| Code | Title | Tier | Course ID | Modules |
|------|-------|------|-----------|---------|
| ALABS-CORE-COPILOT | Build AI-Assisted Software | CORE | 14593493 | 7 |
| ALABS-CORE-PROMPTS | Prompt Engineering | CORE | 14593495 | 7 |
| ALABS-OPS-N8N | Orchestrate Agents & Automations | OPS | 14593499 | 9 |
| ALABS-OPS-VISION | Computer Vision for Agent Systems | OPS | 14593501 | 6 |
| ALABS-OPS-RAG | Local RAG & Document Intelligence | OPS | 14593503 | 7 |
| ALABS-AGENTS-ML | ML Models as Agent Tools | AGENTS | 14593505 | 6 |
| ALABS-AGENTS-AGENTS | Multi-Agent Systems & Orchestration | AGENTS | 14593507 | 7 |
| ALABS-ADV-PLUGINSDK | Build Plugins for Allternit | ADV | 14612851 | 4 |
| ALABS-ADV-WORKFLOW | The Allternit Workflow Engine | ADV | 14612861 | 3 |
| ALABS-ADV-ADAPTERS | Provider Adapters & Unified APIs | ADV | 14612869 | 3 |

## Directory Structure

```
allternit/
├── AGENTS.md                              ← YOU ARE HERE
├── alabs-generated-courses/               ← Generated HTML modules
│   ├── ALABS-ADV-PLUGINSDK-module1.html
│   ├── ALABS-ADV-PLUGINSDK-module2.html
│   ├── ALABS-ADV-PLUGINSDK-module3.html
│   ├── ALABS-ADV-PLUGINSDK-bridge.html
│   ├── ALABS-ADV-WORKFLOW-module1.html
│   ├── ALABS-ADV-WORKFLOW-module2.html
│   ├── ALABS-ADV-WORKFLOW-bridge.html
│   ├── ALABS-ADV-ADAPTERS-module1.html
│   ├── ALABS-ADV-ADAPTERS-module2.html
│   ├── ALABS-ADV-ADAPTERS-bridge.html
│   ├── quizzes/                          ← Quiz JSON files for Canvas Quiz API
│   │   ├── pluginsdk-m1.json
│   │   ├── workflow-m1.json
│   │   └── adapters-m1.json
│   └── analysis/                         ← Package analysis outputs
│       ├── package-analysis.json
│       ├── curriculum-map.json
│       └── platform-course-outline.json
├── alabs-generated-courses/demos/        ← Standalone demo site (was top-level alabs-demos/)
│   ├── index.html                        ← Auto-generated landing page
│   └── cowork-integration-preview.html
├── alabs-module-template/                ← Shared template system
│   ├── shell/shell.html                  ← Common CSS + JS wrapper
│   ├── scripts/build.ts                  ← Build: content JSON → HTML
│   ├── scripts/convert-existing.ts       ← Migrate old modules to new format
│   └── README.md
├── archive/alabs-curator/                ← ARCHIVED 2026-07-22: generalizable CLI scaffold (never finished; stub publish)
├── scripts/                              ← Pipeline scripts
│   ├── sync-course-from-package.ts       ← Main sync (fixed page_url bug)
│   ├── sync-incremental.ts               ← Hash-based incremental sync
│   ├── canvas-quiz-sync.ts               ← Canvas Quiz API integration
│   ├── progress-tracker.ts               ← Poll Canvas → SQLite progress
│   ├── add-module-challenges.ts          ← Adds challenge assignments
│   ├── launch-audit.ts                   ← Validates all courses
│   ├── polish-adv-courses.ts             ← One-shot polish for ADV courses
│   ├── generate-demo-index.ts            ← Auto-builds demo landing page
│   ├── analyze-packages.ts               ← Codebase → topics/challenges
│   ├── platform-as-course.ts             ← Platform → course outline
│   └── fix-unpublished-modules.ts        ← Publishes + sets prerequisites
├── surfaces/ai.allternit.com/
│   └── src/views/
│       ├── LabsView.tsx                  ← Platform UI (shows all courses)
│       └── CertificationsPanel.tsx       ← Certification badge gallery
└── .agents/skills/
    └── alabs-course-pipeline/
        └── SKILL.md                      ← Agent skill for pipeline usage
```

## The Pipeline

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Code Analysis  │────▶│ Module Generate │────▶│  Canvas Publish │
│  (TypeScript)   │     │  (Agent Swarms) │     │  (REST API)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
  analyze-packages.ts     Agent prompts in          sync-incremental.ts
  platform-as-course.ts   .agents/skills/           canvas-quiz-sync.ts
                          alabs-course-pipeline/    progress-tracker.ts
                          SKILL.md
```

## How To: Common Tasks

### 1. Generate a New Module

Use an agent swarm. The skill at `.agents/skills/alabs-course-pipeline/SKILL.md` has the full prompts. Short version:

```bash
# Read source package
# Generate interactive HTML module
# Write to alabs-generated-courses/ALABS-ADV-{COURSE}-module{N}.html
```

Module requirements:
- Self-contained single HTML file
- Dark theme (`#0b0b0c` bg, tier-colored accent)
- JetBrains Mono + Inter typography
- Progress bar + fixed nav + scroll-reveal
- Syntax-highlighted code blocks
- 3 interactive quizzes with instant feedback
- 1 Canvas animation (DAG, scheduler, circuit breaker, etc.)
- Capstone project section

### 2. Sync Module to Canvas

**Incremental (recommended):**
```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit
npx tsx scripts/sync-incremental.ts \
  --html-file alabs-generated-courses/ALABS-ADV-WORKFLOW-module2.html \
  --course-id 14612861 \
  --module-title "Module 2: The Scheduler & Execution Model" \
  --position 2
```

**Legacy (if incremental fails):**
```bash
npx tsx scripts/sync-course-from-package.ts \
  --html-file alabs-generated-courses/ALABS-ADV-WORKFLOW-module2.html \
  --course-id 14612861 \
  --module-title "Module 2: The Scheduler & Execution Model" \
  --position 2
```

> ⚠️ **KNOWN BUG & FIX:** The original `sync-course-from-package.ts` generated `page_url` from the module title, which could mismatch Canvas's URL slug. It was fixed to use `page.url` from the Canvas API response. If you see `invalid page_url parameter`, the script needs this fix.

### 3. Publish Module & Set Prerequisites

```bash
npx tsx scripts/fix-unpublished-modules.ts
```

This publishes all unpublished modules and sets sequential prerequisites (M1 → M2 → M3 → Bridge).

### 4. Add Canvas Quiz (Real Scoring)

Create a quiz JSON:
```json
{
  "title": "Module 1 Quiz: Topic Name",
  "questions": [
    {
      "question": "What is...?",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 1,
      "explanation": "Because..."
    }
  ]
}
```

Sync to Canvas:
```bash
npx tsx scripts/canvas-quiz-sync.ts \
  --course-id 14612851 \
  --module-title "Module 1: Plugin SDK Architecture" \
  --quiz-json alabs-generated-courses/quizzes/pluginsdk-m1.json
```

Result: Real Canvas Quiz with scoring, attached to the module.

### 5. Add Module Challenge

Edit `scripts/add-module-challenges.ts` — add entry to `CHALLENGE_ASSIGNMENTS` map:
```typescript
'ALABS-ADV-WORKFLOW': {
  'Module 2: The Scheduler & Execution Model': {
    title: 'Challenge: Build a Retry-Aware Scheduler',
    description: '...',
  },
},
```

Run:
```bash
npx tsx scripts/add-module-challenges.ts
```

### 6. Run Launch Audit

```bash
npx tsx scripts/launch-audit.ts
```

Checks all 10 courses for:
- Unpublished modules
- Missing prerequisites
- Module/item counts
- Assignment completeness

### 7. Update Demo Site

```bash
npx tsx scripts/generate-demo-index.ts
```

Scans `alabs-generated-courses/` and `alabs-generated-courses/demos/` → generates `alabs-generated-courses/demos/index.html`.

### 8. Analyze a Package for Topics

```bash
npx tsx scripts/analyze-packages.ts --package packages/@allternit/plugin-sdk
```

Outputs:
- `alabs-generated-courses/analysis/package-analysis.json` — exports, types, complexity
- `alabs-generated-courses/analysis/curriculum-map.json` — auto-generated syllabus

### 9. Track Student Progress

```bash
npx tsx scripts/progress-tracker.ts --user-id 12345
```

Polls Canvas for module completion → updates SQLite `certifications` table.

## Canvas API Constraints

- **Free For Teacher plan** on `canvas.instructure.com`
- `POST /accounts/self/courses` returns **403** — course creation requires browser automation (Playwright)
- Token is hardcoded in scripts (production would use env var)
- Rate limits: ~100 requests/minute

## Database Schema (Certifications)

```sql
CREATE TABLE certifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  courseCode TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  completedAt TEXT,
  status TEXT DEFAULT 'in_progress',
  updatedAt TEXT,
  UNIQUE(userId, courseCode)
);
```

## Design System (Module Template)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#0b0b0c` | Page background |
| `--accent` | Tier color | Highlights, badges, links |
| `--accent-dim` | `rgba(color, 0.15)` | Subtle backgrounds |
| `--text` | `#e5e5e5` | Primary text |
| `--text-secondary` | `#a1a1aa` | Secondary text |
| Font body | Inter | All text |
| Font code | JetBrains Mono | Code blocks |

Tier colors:
- CORE: `#3b82f6` (blue)
- OPS: `#8b5cf6` (purple)
- AGENTS: `#ec4899` (pink)
- ADV: `#f59e0b` (amber/gold)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `invalid page_url parameter` on sync | URL slug mismatch | Use `sync-incremental.ts` or the fixed `sync-course-from-package.ts` |
| `pnpm` commands fail | Workspace name conflict (`@allternit/visual-state` in two places) | Use `npx tsx` directly instead of `pnpm` |
| `better-sqlite3` migration fails | Native bindings missing | Use system `sqlite3` CLI for migrations |
| Canvas quiz not attaching | Module doesn't exist yet | Sync the HTML module first, then attach quiz |
| Agent generation timeouts | Large codebase to analyze | Give agent specific file paths, not broad globs |

## Agent Swarm Prompt Template

When generating a new module, use this structure:

```
Generate an interactive HTML course module for A://Labs ADV tier.

Source: Read [specific files]
Title: Module N: [Topic]
Course: ALABS-ADV-[COURSE]
Tier: ADV (amber #f59e0b)

Required sections:
1. Hero
2. The Problem
3. [3-5 content sections with real code]
4. 3 Interactive Quizzes
5. Capstone Project

Design: Self-contained, dark theme, JetBrains Mono + Inter,
  progress bar, fixed nav, scroll-reveal, syntax highlighting,
  ONE Canvas animation, fully inline CSS/JS.

Output: /Users/macbook/Desktop/allternit-workspace/allternit/alabs-generated-courses/ALABS-ADV-[COURSE]-module[N].html
```

## Future Work (Backlog)

- [x] Migrate Canvas token from hardcoded to env-based — **Done.** Use `scripts/canvas-token.ts` (`getCanvasToken()` reads `CANVAS_TOKEN` / `CANVAS_API_TOKEN` with legacy fallback).
- [x] Add "Platform as Course" (ALABS-PLATFORM: 5 modules, ~15 hours) — **Done.** Outline saved to `alabs-generated-courses/platform-course-outline.json` and `alabs-generated-courses/analysis/platform-course-outline.json`; course added to platform `FALLBACK_COURSES`.
- [x] Auto-extract quiz JSON from generated modules (instead of hand-writing) — **Done.** Run `npx tsx scripts/extract-quizzes-from-modules.ts`.
- [ ] Migrate all existing modules to shared template shell (reduces size ~60%)
- [ ] ~~Complete `alabs-curator` CLI (generalize for any codebase)~~ — archived to `archive/alabs-curator/` 2026-07-22 (scaffold with stub publish, superseded by `scripts/alabs-course-pipeline.ts`); restore from archive if revived
- [ ] Build module generation directly into template system (agents output JSON, build script wraps)
- [ ] Add completion webhooks (Canvas → platform notifications)

## Tool Belt, MCP, and ACI Documentation

Phase 4 added public docs for the agent runtime surfaces. When working on tools, MCP integrations, or computer-use features, consult the relevant reference first:

- [`docs/public/tools/tool-belt.md`](./docs/public/tools/tool-belt.md) — Native Tool Belt: `web_search`, `web_fetch`, `bash`, `code_execution`, `memory`, `str_replace_editor`, and `computer`.
- [`docs/public/tools/mcp.md`](./docs/public/tools/mcp.md) — Attaching MCP servers, server-side execution, bundled/remote directory pattern, and tunnel security.
- [`docs/public/tools/strict-tool-use.md`](./docs/public/tools/strict-tool-use.md) — Strict JSON Schema validation and grammar-constrained inputs.
- [`docs/public/aci/index.md`](./docs/public/aci/index.md) — Allternit Computer Interface overview, browser automation, and vision coordinates.
- [`docs/public/guides/build-a-tool.md`](./docs/public/guides/build-a-tool.md) — Step-by-step guide for registering custom tools.

## Key Contacts / Context

- **Canvas Instance:** Free For Teacher, `canvas.instructure.com`
- **Node Version:** v25.6.1 with `tsx`
- **Database:** SQLite (`better-sqlite3`) + PostgreSQL (Prisma)
- **Platform:** Next.js in `surfaces/ai.allternit.com/`
- **Course IDs:** See catalog table above
- **Generated modules:** Stored in `alabs-generated-courses/`
- **Demo site:** `alabs-generated-courses/demos/index.html` — works offline

---

**If you are an agent reading this:** You have everything you need to generate, sync, quiz, audit, and track courses. Do NOT start from scratch. Build on what's here.

---

## Platform Integration

### Demo Files in Platform

Demo HTML files must be copied to the platform's public directory to be served:

```bash
cp alabs-generated-courses/demos/*.html surfaces/ai.allternit.com/public/demos/
```

The `LabsView.tsx` "Try Demo" buttons link to `/demos/ALABS-ADV-{COURSE}-module1.html` which resolves to `public/demos/` in Next.js.

### Keeping Demos In Sync

After generating new modules:
1. Copy to `alabs-generated-courses/demos/`
2. Copy to `surfaces/ai.allternit.com/public/demos/`
3. Regenerate index: `npx tsx scripts/generate-demo-index.ts`
4. Copy updated index to both locations

### Platform UI Updates

When adding new courses/modules, update:
- `surfaces/ai.allternit.com/src/views/LabsView.tsx` — `ALABS_COURSES` array
- Module counts, descriptions, demo URLs

---

## Rails — agent communication and coordination

This repo uses the **Allternit Agent System Rails** as its unified communication and coordination substrate:

- `rails` — Rust library (`allternit-agent-system-rails`).
- `cmd/allternit-api/src/rails/mod.rs` — HTTP surface mounted at `/api/rails` and `/rails`.
- `cmd/gizzi-code/src/runtime/gizzi-core/services/railsPeer.ts` — gizzi-code peer registration + HTTP inbox poller.
- `cmd/gizzi-code/src/cli/ui/ink-app/components/RailsInboxBridge.tsx` — bridges polled envelopes into the TUI mailbox.

Every local agent session can register itself as a **peer** under `.allternit/peers/`. Peers can discover each other and send plain-text messages — the Allternit equivalent of Claude Code's `ListAgents` / `SendMessage`. Messages never leave the machine. UDS sockets are supported for direct push; gizzi-code uses HTTP polling of the durable Bus inbox. Any CLI can participate by registering and polling the HTTP inbox; `.allternit/mux` is not required for Rails messaging.

### Current status (Phase 1–7 complete)

The peer registry, UDS inbox transport, steering checkpoint, `/api/rails/peers` HTTP routes, `/api/rails/steer/*` routes, `allternit-rails` CLI commands, gizzi-code runtime tools, `ao-*` shims, and `.steering/bin` hook delegation are implemented and verified:

- `POST /api/rails/peers` — register a peer (`{ name, cwd, vendor }`).
- `GET /api/rails/peers` — list peers.
- `POST /api/rails/peers/:name/send` — send a message to a peer by name.
- `POST /api/rails/peers/:name/heartbeat` — keep a peer marked active.
- `POST /api/rails/steer/checkpoint` — hash `.steering/checkpoint.md` and emit a `SteeringCheckpoint` ledger event when it changes.
- `POST /api/rails/steer/consult` — build steering context and consult the configured backend.
- `POST /api/rails/steer/commit-gate` — commit/push approval consult.

From the shell:

```bash
allternit-rails peer register <name> --vendor <agent-family>
allternit-rails peer list
allternit-rails peer send <name> "<message>"
allternit-rails peer heartbeat <name>
allternit-rails peer inbox <name>
allternit-rails orchestrator doctor
allternit-rails steer checkpoint --cwd <dir>
allternit-rails steer consult --cwd <dir>
allternit-rails steer commit-gate --cwd <dir>
```

From gizzi-code, the runtime exposes:

- `ListPeers` (alias `ListAgents`) — discover local agent peers.
- `SendMessage` (alias `SendMessageToPeer`) — send to a Rails peer by name, with `uds:` and `bridge:` address support and teammate-mailbox fallback.

### Enabling Rails peer mode in gizzi-code

The `UDS_INBOX` bundle feature is disabled in local dev builds. To opt into Rails peer registration and the new messaging tools:

```bash
GIZZI_ENABLE_RAILS_PEER=1 gizzi
```

This registers the session as `gizzi-<sessionId>` with the Rails API and polls the HTTP inbox for peer messages. The process also exports:

- `ALLTERNIT_RAILS_PEER_NAME`
- `ALLTERNIT_RAILS_INBOX`

### Verification

- `cargo test -p allternit-agent-system-rails` ✅
- `cargo build -p allternit-api` ✅
- `bun run typecheck` in `cmd/gizzi-code` ✅
- `cmd/gizzi-code/test/rails-peer-e2e.ts` registers two peers, lists them, and confirms Bus/UDS message delivery.
- `tmp/rails-two-session-test/run.sh` automates a two-session `GIZZI_ENABLE_RAILS_PEER=1 gizzi-code` TUI exchange and saves evidence to `tmp/rails-two-session-test/evidence/`.
- Two live `GIZZI_ENABLE_RAILS_PEER=1 gizzi` sessions exchanged a `ListPeers` / `SendMessage` round-trip (see `docs/RAILS_PRODUCT_UPDATE_SYSTEM_PROMPT.md`).

### Product-update system prompts

Load these into agent sessions to teach the Rails workflow:

- `docs/RAILS_PRODUCT_UPDATE_SYSTEM_PROMPT.md` — full product update / system prompt.
- `.allternit/context-packs/rails-product-update/inputs/INSTRUCTIONS.md` — concise agent-instruction context pack.
- `.allternit/context-packs/rails-product-update/inputs/templates/QUICKSTART.md` — copy-paste quickstart.

See `docs/RAILS_UNIFIED_COMMUNICATION_PLAN.md` for the full roadmap.

## Agent email rail (services/mailflare)

`services/mailflare/` is a **vendored fork** of [hieunc229/mailflare](https://github.com/hieunc229/mailflare) that gives agents real internet email (inbound webhook → Rails Mail threads; outbound via the Rails Mail review gate). Conventions:

- It is a plain **npm** project with its own `package-lock.json` and OpenNext/Cloudflare build — like `services/open-connector`, it is **excluded from the pnpm workspace** (`!services/mailflare` in `pnpm-workspace.yaml`). Never add it to the workspace; root `pnpm install` ingesting it breaks its Next.js build.
- Verify changes with `npm run build` (lint has pre-existing upstream errors; don't add new ones). Type checking is `ignoreBuildErrors`-gated upstream, so run `npx tsc --noEmit` when touching TS.
- Per-installation deploys go to the installing user's own Cloudflare account via `services/mailflare/setup.sh`.
- Full architecture, ops, and reputation guidance: `docs/AGENT_EMAIL_RAIL.md`.
