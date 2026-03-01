# A2rchitech Unified UI Integration Spec (Merged)
## Dynamic Context Discovery + Directive/Command Architecture + Mini‑App Behavior Schemas
### Includes: Prompt Engineering → Context Engineering mapping (arXiv:2402.07927)

---

## 0. Why This Exists

A2rchitech needs one coherent “execution surface” that:
1) **Discovers** the right context (instead of stuffing prompts),
2) **Compiles** intent into deterministic directives/commands (instead of free‑form prompting),
3) **Executes** inside **Mini‑Apps** that expose service primitives through a unified, discovery‑first UI.

This document is the merge point for:
- **Dynamic Context Discovery** (progressive disclosure + context window control)
- **Directive/Command Architecture** (typed intent → compiled directive → tool/runtime)
- **Mini‑App Behavior Schemas** (capabilities + UI contracts + output contracts)
- **Prompt Engineering** as a *compiled directive layer* (from arXiv:2402.07927)

This is integration, not exploration.

---

## 1. First Principles (Non‑Negotiotiable)

### 1.1 Separation of Concerns

| System Concern | What it controls | Where it lives |
|---|---|---|
| Intent | What the user wants | Unified UI + Intent Parser |
| Directive | How the model should act | **Directive Compiler** |
| Context | What information enters the window | **Context Manager / Assembler** |
| Memory | Durable user/system facts | Memory Store + Policies |
| Execution | Actions and tool calls | Runtime Harness + Tools |
| Presentation | Human legibility + interactivity | Unified UI + Mini‑Apps |

If any layer leaks into another (e.g., UI text becomes “the prompt”), drift and nondeterminism follow.

### 1.2 Golden Rule
> **No agent accepts free‑form prompting as the execution mechanism.**  
All execution must pass through: **Intent → Spec → Directive Compiler → Context Assembler → Runtime**.

---

## 2. Canonical Execution Loop (Unified UI → Runtime)

### 2.1 Top‑Level Flow

1) **Discovery‑First UI** (not “a web browser” feel)
2) **Intent Capture** (structured)
3) **Task Spec** (typed)
4) **Directive Compilation** (pattern selection + slot fill + contracts)
5) **Dynamic Context Discovery** (progressive retrieval + context gating)
6) **Execution** (tools / models / mini‑apps)
7) **Verification** (schema + checks + regression hooks)
8) **Presentation** (interactive UI cards; debug views optional)

### 2.2 Reference Pipeline

```
Unified UI
  ↓
Intent Parser
  ↓
Task Spec (Typed)
  ↓
Directive Compiler  ← Prompt engineering belongs here
  ↓
Context Discovery & Assembler ← Context engineering belongs here
  ↓
Runtime Harness (Tools/Models)
  ↓
Verifier (Schema + policies)
  ↓
UI Renderer (Cards/Mini‑Apps)
```

---

## 3. Dynamic Context Discovery (DCD)

### 3.1 What DCD Is

DCD is a system for:
- **Progressive disclosure** of context (only what’s needed, when needed)
- **Context window control** (budgeting, ordering, gating)
- **Relevance‑first assembly** (signal density over volume)

DCD replaces “prompt stuffing” with a deterministic retrieval + assembly plan.

### 3.2 DCD Stages

**Stage A — Minimal Base Context**
- System policies, safety constraints, user preferences (if applicable)
- Task spec summary (typed, compact)

**Stage B — Retrieval Plan**
- Decide sources: local memory, project docs, web, tools
- Determine query templates + QDF + constraints
- Determine chunking + reranking plan

**Stage C — Progressive Expansion**
- Add only the top‑k chunks that increase task success probability
- Expand only if verification signals indicate insufficiency

**Stage D — Context Window Packing**
- Order by: instruction > constraints > high‑value evidence > examples > long tail
- Deduplicate, compress, and annotate provenance

### 3.3 DCD “Stop Conditions” (Hard)

Stop adding context when:
- Output contract can be satisfied with current evidence
- Marginal context adds redundancy or increases ambiguity
- Token budget threshold reached
- Verification confidence is adequate

### 3.4 DCD Outputs

DCD must emit:
- `ContextBundle` (content + provenance)
- `ContextMap` (what was included, excluded, and why)
- `BudgetReport` (token allocations by type)

---

## 4. Directive/Command Architecture (DCA)

### 4.1 What DCA Is

DCA turns user intent into deterministic execution by enforcing:
- Typed task specs
- Compiled directives (no ad‑hoc prompting)
- Tool contracts and acceptance tests
- Verifiable outputs

### 4.2 Task Spec Schema (Canonical)

```yaml
TaskSpec:
  id: string
  intent_type: enum
  user_goal: string
  inputs:
    - name: string
      type: string
      value: any
  constraints:
    - string
  success_criteria:
    - string
  output_contract:
    format: enum
    schema_ref: string | null
    constraints:
      - string
  risk_level: enum  # low/med/high
  allowed_tools:
    - tool_id
  disallowed_actions:
    - string
```

### 4.3 Command Spec Schema (UI → Runtime Bridge)

Commands are the atomic “do” units for execution.

```yaml
CommandSpec:
  id: string
  verb: enum              # search, retrieve, summarize, transform, generate, execute, verify
  object: string          # what it acts on
  parameters: object
  preconditions:
    - string
  postconditions:
    - string
  tool_binding:
    tool_id: string | null
    mode: enum            # dry_run | execute
  output_binding:
    schema_ref: string | null
```

### 4.4 Directive Compiler (Prompt Engineering as Infrastructure)

The compiler:
- selects a **PromptPattern**
- fills slots from `TaskSpec`
- attaches `OutputContract`
- produces a *compiled directive block*

**Prompt engineering is therefore a compilation step**, not an authoring surface.

---

## 5. Prompt Patterns (From arXiv:2402.07927 → A2rchitech Types)

### 5.1 Prompt Pattern Registry

Prompting techniques become **typed patterns**:
- Zero‑Shot Directive
- Few‑Shot Demonstration
- Chain‑of‑Thought (internal reasoning constraints, not exposed)
- Self‑Consistency (multi‑sample + vote)
- Decomposition Prompting (sub‑tasks)
- Instruction + Constraint Prompting

### 5.2 PromptPattern Schema (Hard Requirement)

```yaml
PromptPattern:
  id: string
  intent_type: enum
  reasoning_mode: enum
  input_slots:
    - name: string
      type: string
  output_contract:
    format: enum
    constraints:
      - string
  failure_modes:
    - hallucination
    - verbosity
    - reasoning_collapse
    - instruction_override
  cost_profile:
    tokens_estimate: number
    latency_estimate: number
```

### 5.3 Output Contracts (Non‑Optional)

Every directive must declare output format constraints.
If output fails schema validation, the system must:
- self‑repair (bounded retries) OR
- return a structured failure with missing requirements

---

## 6. Mini‑App Behavior Schemas (MABS)

### 6.1 What Mini‑Apps Are in A2rchitech

Mini‑Apps are the UI‑native execution containers that:
- expose service primitives
- provide deterministic interaction contracts
- render interactive outputs (cards, flows, visual affordances)
- can spawn “URL Page Mini‑Apps” (discovery‑first browsing)

Mini‑Apps are *not plugins*; they are first‑class runtime surfaces.

### 6.2 MiniApp Manifest (Canonical)

```yaml
MiniApp:
  id: string
  name: string
  description: string
  capabilities:
    - capability_id
  supported_intents:
    - intent_type
  allowed_reasoning_modes:
    - reasoning_mode
  default_prompt_patterns:
    - prompt_pattern_id
  context_policy:
    max_tokens: number
    sources_allowed:
      - source_id
    retrieval_policy_ref: string | null
  ui_contract:
    render_modes:
      - cards
      - timeline
      - graph
      - form
      - workspace
    interactions:
      - click_to_expand
      - drag_drop
      - inline_edit
      - run_command
  output_contracts:
    - schema_ref
  tool_bindings:
    - tool_id
  safety:
    risk_level: enum
    disallowed_actions:
      - string
```

### 6.3 Capability Registry

Capabilities are shared primitives across mini‑apps:

Examples:
- `cap.search.web`
- `cap.retrieve.docs`
- `cap.open.url_miniapp`
- `cap.plan.tasks`
- `cap.render.graph`
- `cap.validate.schema`
- `cap.call.tool`

Mini‑apps declare capabilities; the runtime binds them to tools.

---

## 7. Unification: How the Three Parts Lock Together

### 7.1 The “Three Locks” Model

1) **Directive Lock**: execution must originate from compiled directives  
2) **Context Lock**: only DCD can populate the context bundle  
3) **UI Lock**: mini‑apps enforce UI and output contracts  

If any lock is bypassed, the system becomes brittle.

### 7.2 End‑to‑End Example (Abstract)

User: “Research X and produce a Y report.”

- UI captures intent → `TaskSpec`
- DCA compiles directive: chooses decomposition pattern + output schema
- DCD retrieves progressively: top‑k evidence, rerank, pack
- Runtime executes tool calls
- Verifier checks schema, citations, constraints
- Mini‑app renders interactive report cards + provenance map

---

## 8. Verification, Regression, and Drift Control

### 8.1 Verification Hooks (Always On)
- Output schema validation
- Evidence/provenance presence checks (when required)
- Token budget compliance
- Tool call policy compliance

### 8.2 Prompt Regression Tests
- Golden outputs for common tasks
- Failure mode tests (verbosity, hallucination, format breakage)
- Cost ceilings and latency budgets

### 8.3 Drift Prevention
- Versioned registries: PromptPatterns, MiniApps, Capabilities
- Deprecation and migration paths
- Explicit changes via spec deltas, not silent edits

---

## 9. Implementation Targets in the Repo (Theoretical Mapping)

Adapt names to your scaffold:

- `/spec/`
  - `DirectiveLayer.md`
  - `ContextDiscovery.md`
  - `MiniApps.md`
  - `Schemas/` (TaskSpec, PromptPattern, MiniApp manifests)
  - `AcceptanceTests.md`

- `/runtime/`
  - `directive_compiler/`
  - `context_manager/`
  - `harness/`
  - `verifier/`

- `/ui/`
  - `unified_shell/`
  - `mini_apps/`
  - `renderers/`
  - `debug_views/` (directive graph, context map)

- `/registry/`
  - `prompt_patterns/`
  - `mini_apps/`
  - `capabilities/`
  - `tools/` (contracts + schemas)

---

## 10. Non‑Negotiable Rules (Restated)

1) **No free‑form prompting** as execution.  
2) Prompt engineering exists only as **compiled directives**.  
3) Context enters the window only via **Dynamic Context Discovery**.  
4) Mini‑apps must publish **manifests + contracts**.  
5) Outputs must be **schema‑validated** or explicitly fail with missing requirements.

---

## 11. Status

This merged spec is:
- Integration‑ready
- Deterministic by design
- Compatible with discovery‑first Dynamic UI + Mini‑Apps
- Designed to prevent prompt/context/UI drift
- Ready to be dropped into the Unified UI unification chat as a canonical anchor
