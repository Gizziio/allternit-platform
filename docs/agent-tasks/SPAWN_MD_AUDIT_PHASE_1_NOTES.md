---
task: SPAWN.md Audit — Phase 1
status: complete
date: 2026-08-13
source: https://github.com/0xprincess/SPAWN.md (branch: master)
next: docs/agent-tasks/SPAWN_MD_AUDIT_PHASE_2_TASK.md (implementation plan)
---

# SPAWN.md Audit — Phase 1 Notes

## 1. SPAWN.md Specification Summary

SPAWN.md is a **zero-dependency, Markdown-only workflow template** for projects where autonomous agents write most code while human operators steer via bounded grants. It requires no runtime, framework, or tooling — just Markdown files and one JSON seed (`arch/conformance.json`).

### 1.1 Repository Layout

| Path | Purpose |
|------|---------|
| `WORKFLOW.md` | Durable workflow rules (copied verbatim into projects) |
| `ADAPTATION.md` | Guide for deriving project-specific bindings |
| `OVERVIEW.template.md` | Durable project vision template |
| `GOAL.template.md` | Per-mission charter for fresh agent sessions |
| `arch/README.md` | Decision track rules |
| `arch/proposals/0000-template.md` | Architecture improvement proposal template |
| `arch/conformance.json` | Machine-readable conformance map seed |
| `experiments/README.md` | Experiment discipline rules |
| `experiments/0000-template.md` | Experiment record template |
| `experiments/HANDOFF.template.md` | Session handoff briefing template |
| `governance/CHARTER.template.md` | Operator charter template |
| `governance/SELF-CORRECTION.md` | Failure playbook (copied verbatim) |
| `docs/RUNBOOK.template.md` | Verification and operations template |

### 1.2 The Four Tracks

1. **Architecture Track (`arch/`)** — Numbered improvement proposals with EIP-style lifecycle (Draft → Review → Accepted → Final → Superseded/Withdrawn). Proposals are PURE design documents. Final proposals are immutable. Relationship headers: `Supersedes:`, `Superseded-By:`, `Requires:`, `Extended-By:`.

2. **Conformance Map (`arch/conformance.json`)** — Machine-readable map from proposals to code/tests. Statuses: `conformant`, `partial`, `unimplemented`, `n-a`. Must be updated in the SAME commit as code changes.

3. **Experiment Track (`experiments/`)** — Every interaction with reality gets a pre-declared record: hypothesis, scope, risks, acceptance criteria, budget. Mandatory terminal closure: outcome, root cause, actual cost, next action. One experiment in flight at a time. Never retry silently.

4. **Governance Track (`governance/`, `GOAL.md`, `HANDOFF.md`)** — Operator charters with falsifiable Definition of Done, autonomy grants (spend caps, decision scope), hard invariants, escalation triggers, and reporting cadences. `GOAL.md` is normative (what to do); `HANDOFF.md` is descriptive (current state).

### 1.3 Session Lifecycle

- **Startup:** Read `GOAL.md` → `HANDOFF.md` → charter → verify claimed state → read relevant proposals.
- **Working:** Proposals before code, semantic commits (≤800 lines), independent review before irreversible steps, full verification gates green before dispatch.
- **Shutdown:** Update conformance, close experiment records, rewrite `HANDOFF.md`, update `GOAL.md`, STOP at mission boundary.

### 1.4 Adaptation Bindings (7 derived from project description)

| Binding | Description |
|---------|-------------|
| B1 | Proposal naming convention (prefix + 4-digit number) |
| B2 | What requires an architecture-track proposal |
| B3 | Experiment spend unit definition |
| B4 | Verification command set |
| B5 | Charter thresholds (budgets, failure triggers) |
| B6 | Generator-owned artifacts |
| B7 | Reserved holdout surfaces |

### 1.5 Bootstrapping

Agent prompt: `Bootstrap my project from SPAWN.md: <describe your project>`. Agent reads `WORKFLOW.md` + `ADAPTATION.md`, derives bindings, copies template tree, fills `{{PLACEHOLDER}}` markers, seeds conformance, and commits the workflow structure BEFORE writing any product code.

### 1.6 Key Design Principles

1. Decisions are append-only; implementation state is mutable and checked.
2. Honest measurement is absolute — no fabrication, backfill, or estimation as actuals.
3. Autonomy comes from rails (budgeted charters), not permission-seeking.
4. The deliverable is the deliverable — ceremony is a failure mode.
5. Everything expensive gets a free rehearsal first.

### 1.7 Self-Correction Playbook (10 rules)

Distilled failure lessons: question assumptions when failures repeat with new masks, ceremony is not the deliverable, don't gate stochastic processes on exact content, per-unit failure is data not death, rehearse the LAST steps, attribute wins to declared mechanisms only, claims ≠ evidence, losses are deliverables, freeze what you compare against, handoff is part of the work.

---

## 2. Allternit Agent Creation System — Current State

### 2.1 Database Schema (Prisma `Agent` model)

```
agents table:
  id, userId, name, description, type (orchestrator|sub-agent|worker|specialist|reviewer),
  parentAgentId, model, provider (openai|anthropic|local|custom),
  capabilities (JSON[]), systemPrompt, tools (JSON[]),
  maxIterations, temperature, config (JSON), status,
  workspaceId, avatar (JSON), identityKey (Ed25519),
  createdAt, updatedAt, lastRunAt
```

Relations: `memoryEvents`, `memoryEntities`, `testSuites`, `metrics`.

### 2.2 CreateAgentInput Schema (Zod-validated)

Full `CreateAgentInput` includes:
- **Identity:** name, description, type, category, tags
- **Runtime:** model, provider, temperature, maxIterations
- **Character:** setup (coding|creative|research|operations|generalist), temperament (precision|exploratory|systemic|balanced), specialty skills, hard bans
- **Governance:** trustTier (safe|low|standard|elevated|admin|critical), writeScope, dataClassification, allowedSurfaces (chat|cowork|code|design|browser), allowedSkills, allowedTools
- **Harness:** mode (byok|cloud|local|subprocess) with provider-specific config
- **Voice:** style, rules, microBans, tone dimensions
- **Avatar:** primary/secondary colors, pattern, avatar picker config

### 2.3 CreateAgentFlow (6-step wizard)

`CreateAgentForm.tsx` — 825 lines, multi-step form:
1. **Identity** — Name, type, description, backstory
2. **Character** — Setup archetype, specialty skills, temperament, stats
3. **Avatar** — Visual representation (colors, pattern, mascot)
4. **Runtime** — Model selection, voice settings
5. **Harness** — AI routing mode (BYOK/cloud/local/subprocess), mode surfaces
6. **Review** — Final confirmation, workspace layer config

Submission flow:
1. `createAgent(payload)` → API + store update
2. `generateEnhancedWorkspaceDocuments()` → backend workspace initialization
3. `POST /api/v1/agents/:id/workspace/initialize` → workspace docs

### 2.4 AgentHub (4 tabs)

- **Agent Studio** — Create/edit agents
- **Sessions** — Active agent sessions
- **Analytics** — Agent performance metrics
- **Workspace** — File workspace per agent

### 2.5 Existing Import/Export Infrastructure

**`agent-template-io.ts`** — JSON-based agent import/export:
- `exportAgent(config, options)` → `AgentExportData` (version, timestamp, agent config, template ref, metadata)
- `importAgentFromString(jsonString)` → `AgentImportResult` (success, config, warnings)
- `importAgentFromFile(file)` → Promise-based file import
- `validateAgentConfig(config)` → validation with errors/warnings
- Export format version: `1.0`

**Swarm export utilities** (`swarm/lib/export-utils.ts`):
- `exportAgentsToCSV()`, `exportAgentsToJSON()`, `exportAgentsToMarkdown()`
- These are reporting exports, not importable templates

### 2.6 Character System

`CharacterBlueprint` with setup archetypes:
- `coding` | `creative` | `research` | `operations` | `generalist`
- Temperament: `precision` | `exploratory` | `systemic` | `balanced`
- `RoleCardConfig`: domain, inputs/outputs, definitionOfDone, hardBans (with enforcement modes: tool-block | prompt-only), escalation rules, metrics
- `VoiceConfigLayer`: style, rules, microBans, conflictBias

### 2.7 AgentTemplate Types (3 distinct definitions)

1. `swarm/types.ts:AgentTemplate` — id, name, description, role, model, capabilities, config, usageCount
2. `agent.types.ts:AgentTemplate` — id, name, description, setup, capabilities, systemPrompt, color, mascotTemplate, avatarColors, tags, category
3. `agent-advanced.types.ts:AgentTemplate` — (third variant)

### 2.8 `defineAgent()` Factory (Programmatic Path)

`surfaces/ai.allternit.com/src/lib/agents/agent-definition.ts` — The single canonical way to construct a `CreateAgentInput`. Accepts `name`, `description`, `instructions` (→ systemPrompt), plus overrides. Fills defaults for model, provider, harness, surfaces, trust tier, write scope. Validates against both the Zod schema and the creation checklist. Also exports `buildCharacterLayer()` which expands a compact `CharacterLayerSpec` into a full `CharacterLayerConfig`.

### 2.9 Agent Templates DB Table (V15)

`agent_templates` table in SQLite with 3 built-in crew patterns:
- `solo-general` — single worker
- `orchestrator-workers` — orchestrator + researcher + builder
- `company-builder` — founder + CEO + CTO + CMO + COO

Instantiated via `POST /api/v1/agents/from-template` which reads the template spec, injects the resolved brain (model/provider), validates every node against the creation checklist, then persists the orchestrator and all subagents.

### 2.10 Additional Agent Surfaces

- **CLI:** `cmd/gizzi-code/src/cli/ui/ink-app/components/agents/new-agent-creation/CreateAgentWizard.tsx` — Ink-based terminal wizard (Location → Method → Generate → Type → Prompt → Description → Tools → Model → Color → Memory → Confirm).
- **iOS:** `surfaces/allternit-mobile/ios/Features/Agents/AgentHubView.swift` — SwiftUI sidebar with agent list, templates sheet, and marketplace.
- **Cowork Persona:** Separate `CoworkPersona` Prisma model (simpler: name, description, systemPrompt, tools, isDefault) for the Cowork engine — distinct from the full Agent model.
- **Rust Orchestration:** YAML-based persona definitions in the workflow engine (`PersonaYaml`, `PersonaConstraintsYaml`) compiled to kernel contracts.

### 2.11 Mandatory Fields for Any Import

Any external format imported as an agent must satisfy:
- `name` ≥ 3 chars
- `description` ≥ 10 chars
- `type` (orchestrator|sub-agent|worker|specialist|reviewer)
- `model` + `provider`
- `harness.mode` (byok|cloud|local|subprocess)
- `enabled_modes` (at least one surface)
- `trust_tier`
- `characterLayer` with `identity.setup`, `identity.temperament`, and `roleCard.domain`

---

## 3. Comparison: SPAWN.md vs Allternit Agent System

### 3.1 Conceptual Mapping

| SPAWN.md Concept | Allternit Equivalent | Gap |
|------------------|---------------------|-----|
| `GOAL.md` (mission charter) | `RoleCardConfig.definitionOfDone` + agent `systemPrompt` | SPAWN.md goals are richer: ordered deliverables, budget, verification commands, explicit stop boundaries |
| `CHARTER.md` (operator grant) | `trustTier` + `writeScope` + `hardBans` | Closest match. Allternit has enforcement modes; SPAWN.md has autonomy grants + escalation triggers |
| `HANDOFF.md` (session briefing) | `MemoryEntity` / `MemoryEvent` | No direct equivalent. Allternit uses memory system; SPAWN.md uses descriptive handoff docs |
| Architecture proposals | None | Allternit has no decision-tracking system |
| Experiment track | None | Allternit has no experiment/hypothesis tracking |
| Conformance map | None | Allternit has no code-to-design conformance tracking |
| Self-correction playbook | `hardBans` + `escalation` rules | Partial overlap. SPAWN.md's is narrative; Allternit's is rule-based |
| Adaptation bindings | `CreateAgentInput` fields | Different mechanism: SPAWN.md derives from project description; Allternit collects via wizard |
| Session lifecycle | Agent `status` (idle|running|paused|error) | SPAWN.md has richer lifecycle (startup verification, shutdown handoff) |

### 3.2 Key Differences

1. **Philosophy:** SPAWN.md is a *project governance framework* (how to manage agentic work). Allternit's agent system is an *agent configuration platform* (how to define and run agents). They operate at different levels.

2. **Granularity:** SPAWN.md governs an entire project with multiple agents/sessions. Allternit configures individual agents with per-agent governance.

3. **Format:** SPAWN.md is pure Markdown (human-readable, git-native). Allternit uses JSON/database records (machine-readable, API-native).

4. **State:** SPAWN.md tracks state in files committed to a repo. Allternit tracks state in a database + memory system.

5. **Import target:** SPAWN.md describes a *workflow* (how agents should operate). Allternit agents are *entities* (what an agent is and can do). The mapping is not 1:1.

### 3.3 Overlap Zones (importable)

| SPAWN.md Element | Import As | Target Allternit Field |
|-----------------|-----------|----------------------|
| Charter mission | Agent system prompt preamble | `systemPrompt` |
| Definition of Done | RoleCard definitionOfDone | `config.character.definitionOfDone` |
| Hard invariants | Hard bans | `config.character.hardBans` |
| Direction constraints | Escalation rules | `config.character.escalation` |
| Autonomy grants (spend cap) | Trust tier derivation | `trustTier` |
| Autonomy grants (decision scope) | Write scope | `writeScope` |
| Autonomy grants (design discretion) | Allowed tools/skills | `allowedTools`, `allowedSkills` |
| Escalation triggers | Escalation rules | `config.character.escalation` |
| Verification commands | Capabilities | `capabilities` |
| Experiment discipline | Agent type hint | `type` (reviewer for experiment validation) |
| Session handoff protocol | Memory entity seed | Pre-seeded `MemoryEntity` records |

---

## 4. Import Design Options

### 4.1 Option A: SPAWN.md → Agent Persona Import

Parse a SPAWN.md project tree and extract a persona configuration that maps to `CreateAgentInput`.

**Flow:**
1. User uploads/selects a SPAWN.md-instantiated project directory
2. Parser reads `CHARTER.md`, `GOAL.md`, `OVERVIEW.md`, `SELF-CORRECTION.md`
3. Extract governance fields → map to `CreateAgentInput` fields
4. Generate a system prompt that embeds the charter, DoD, hard invariants, and self-correction rules
5. Pre-populate `CreateAgentForm` draft (existing `draftAgent` mechanism)
6. User reviews/adjusts in the wizard, then creates the agent

**Pros:** Leverages existing wizard flow; user gets full control.
**Cons:** SPAWN.md's project-level governance doesn't map cleanly to per-agent config.

### 4.2 Option B: SPAWN.md → Agent Template

Parse SPAWN.md and produce an `AgentTemplate` (using the `agent.types.ts` variant with `systemPrompt`, `capabilities`, `tags`, `category`).

**Flow:**
1. Parse SPAWN.md tree → extract governance/mission/self-correction
2. Generate a rich `AgentTemplate` with synthesized system prompt
3. Save to template storage (existing `templateStorage` in swarm)
4. Available in `AgentTemplateSelector` and `TemplatesView`

**Pros:** Reusable across multiple agents; fits the template pattern.
**Cons:** Templates are simpler than full agent configs; loses some SPAWN.md richness.

### 4.3 Option C: SPAWN.md → Workspace Documents + Agent Config (Hybrid)

Parse SPAWN.md and produce BOTH an agent configuration AND workspace governance documents.

**Flow:**
1. Parse SPAWN.md tree
2. Extract agent config fields → `CreateAgentInput`
3. Generate workspace documents from SPAWN.md templates (proposals README, experiment README, governance docs)
4. Create agent + initialize workspace with SPAWN.md-derived documents
5. Agent has governance baked into both its system prompt AND its workspace

**Pros:** Most faithful to SPAWN.md's intent; governance lives in workspace, not just system prompt.
**Cons:** Most complex implementation; requires workspace document generation.

### 4.4 Option D: SPAWN.md → Loop/Orchestration Template (Future)

Use SPAWN.md's session lifecycle (GOAL → work → HANDOFF) as a loop template for the orchestrator.

**Flow:**
1. Parse SPAWN.md GOAL.md → extract ordered deliverables, verification commands, stop conditions
2. Create an orchestration loop template with mission phases
3. Orchestrator spawns worker agents per deliverable, tracks conformance, generates handoffs

**Pros:** Maps to SPAWN.md's session lifecycle most naturally; leverages orchestrator.
**Cons:** Requires loop template system (doesn't exist yet); most speculative option.

---

## 5. Recommended Approach

**Primary: Option C (Hybrid)** with Option A as MVP fallback.

Rationale:
- SPAWN.md's value is in its *governance structure*, not just agent personality. Option C preserves this by generating workspace documents.
- The existing `generateEnhancedWorkspaceDocuments()` call in `CreateAgentForm` already provides a hook for SPAWN.md-derived documents.
- Option A serves as a simpler MVP that can ship faster and validate the parsing/mapping layer.

### 5.1 Implementation Phases

**Phase 2a — SPAWN.md Parser (core)**
- `packages/@allternit/spawn-parser` or `src/lib/spawn/`
- Parse `CHARTER.md`, `GOAL.md`, `OVERVIEW.md`, `SELF-CORRECTION.md`
- Extract structured fields from `{{PLACEHOLDER}}` markers and section headers
- Output: `SpawnProject` typed object

**Phase 2b — Field Mapper**
- Map `SpawnProject` → `CreateAgentInput` (governance fields, system prompt synthesis)
- Map `SpawnProject` → workspace document payloads
- Handle missing/optional SPAWN.md sections gracefully

**Phase 2c — UI Integration**
- "Import from SPAWN.md" button in AgentHub
- File picker or directory selector
- Preview parsed fields before wizard population
- Populate `draftAgent` state → launch `CreateAgentForm` with pre-filled data

**Phase 2d — Workspace Document Generation**
- Extend `generateEnhancedWorkspaceDocuments()` with SPAWN.md document types
- Generate governance/proposal/experiment README docs for the agent workspace
- Seed initial `GOAL.md` and `HANDOFF.md` as workspace documents

### 5.2 Key Technical Decisions for Phase 2

1. **Parser approach:** Regex-based section extraction vs. LLM-assisted parsing. Recommend regex + heuristics for deterministic parsing; LLM fallback for ambiguous sections.
2. **System prompt synthesis:** Concatenate charter + DoD + hard invariants + self-correction into a structured system prompt preamble, appended before any user-defined prompt.
3. **Storage:** SPAWN.md source files stored as workspace documents (preserving original format) alongside the generated agent config.
4. **Version tracking:** Store SPAWN.md source hash in agent metadata for change detection.

---

## 6. Existing Code That Can Be Reused

| Component | Location | Reuse For |
|-----------|----------|-----------|
| `defineAgent()` factory | `agent-definition.ts` | Natural integration point — parse SPAWN.md → `CreateAgentInput`, pass through factory for Zod validation + checklist enforcement |
| `importAgentFromString()` | `agent-template-io.ts` | Import pipeline pattern (JSON parse → validate → return config) |
| `validateAgentConfig()` | `agent-template-io.ts` | Validation after mapping |
| `draftAgent` state | `agent.store.ts` | Pre-populate wizard from parsed SPAWN.md |
| `CreateAgentForm` draft prefill | `CreateAgentForm.tsx:289-304` | Already reads `draftAgent` on mount |
| `generateEnhancedWorkspaceDocuments()` | `CreateAgentForm.tsx:540-560` | Extend for SPAWN.md-derived workspace docs |
| `substituteTemplateVariables()` | `agent-templates.ts` | Existing engine handles 30+ `{{variable}}` patterns — reusable for SPAWN.md placeholder filling |
| `POST /api/v1/agents/from-template` | `agent_routes.rs` | If SPAWN.md defines multi-agent crews, store as template spec and instantiate |
| `AgentTemplateSelector` | `AgentTemplateSelector.tsx` | Template selection UI |
| `SpecialistTemplate` shape | `agent-templates.specialist.ts` | Map SPAWN.md single-agent to specialist template for picker UI integration |
| `RoleCardConfig` | `character.types.ts` | Target for charter → DoD/hardBans mapping |
| `HarnessConfig` | `agent.types.ts:54` | Target for autonomy grants mapping |
| `WorkspaceLayerConfig` | `agent.types.ts` | Governance layer toggle |
| `validateAgentCreationChecklist()` | `agent-creation-checklist.ts` | Final validation gate — SPAWN.md import must satisfy all 9 required items |
| Server-side `validate_agent_against_checklist()` | `agent_routes.rs:~345` | Server-side enforcement (name ≥3, desc ≥10, type/model/provider, harness mode, ≥1 surface, trust tier) |

---

## 7. Risks and Open Questions

1. **Format stability:** SPAWN.md has no versioned spec — the repo IS the spec. Pinning to a specific commit hash is recommended.
2. **Markdown parsing fragility:** SPAWN.md templates use `{{PLACEHOLDER}}` syntax but also free-form prose. Section boundaries are implicit (H2 headers). Parser must handle variation.
3. **Governance depth mismatch:** SPAWN.md's conformance map and experiment track have no Allternit equivalent. Should these be workspace documents only, or should new database models be created?
4. **Multi-agent projects:** SPAWN.md governs a project (potentially many agents). Allternit creates one agent at a time. Should SPAWN.md import create multiple agents (one per role described in the charter)?
5. **Update propagation:** If the SPAWN.md source files change, should the agent config auto-update, or is the import one-shot?

---

## 8. Summary

SPAWN.md and Allternit's agent system share governance DNA (bounded autonomy, hard invariants, escalation, definition of done) but operate at different levels: SPAWN.md governs projects, Allternit configures agents. The highest-value import path is a hybrid approach that extracts governance fields into agent config AND generates workspace documents preserving SPAWN.md's richer project-level structure. The existing `agent-template-io` import pattern, `draftAgent` wizard prefill, and `generateEnhancedWorkspaceDocuments` hook provide solid integration points.
