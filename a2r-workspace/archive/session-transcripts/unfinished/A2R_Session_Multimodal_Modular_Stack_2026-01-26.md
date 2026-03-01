---
wih:
  id: A2R-SESSION-2026-01-26-MMSTACK
  title: "A2rchitech Multimodal Modular Stack (Non‑Frontier) — Session Consolidation"
  date: "2026-01-26"
  timezone: "America/Chicago"
  scope:
    - a2rchitech
    - multimodal-stack
    - skill-registry
    - model-routing
  roles:
    - Orchestrator
    - Architect
    - Implementer
    - Security
  artifacts:
    - "/spec/MultimodalStack.md"
    - "/spec/Contracts/SkillSchema.json"
    - "/spec/Contracts/ModelProviderAdapter.json"
    - "/spec/AcceptanceTests/MultimodalStack.acceptance.md"
    - "/tools/a2r/* (CLI wrappers)"
  status: "draft-ready"
---

# A2rchitech Session — Multimodal Modular Stack (Non‑Frontier)

## 0) Session Intent

Build a **practical, modular, multi-model tool stack** (non-frontier models) that is easy to use inside **A2rchitech**:
- capability-first routing (OCR / coding / reasoning / writing / image gen / image edit)
- hot-swappable providers
- artifact-first outputs
- CLI-first execution (local + remote + cloud)
- clean contracts for skills + adapters + acceptance tests

## 1) Capability → Model Map (Source of Truth)

> These models are treated as **providers** behind stable A2rchitech capabilities.

### Vision / OCR
- `qwen-3-vl`
- `glm-4.6v`

### Coding (cheap / throughput)
- `qwen-3-coder`

### Coding (high capability)
- `glm-4.7`
- `minimax-m2.1`

### Reasoning
- `deepseek-speciale`

### Writing
- `kimi-k2`
- `kimi-k2-thinking`

### General Purpose
- `deepseek-v3.2`

### Image Generation
- `flux-2-dev`
- `z-image-turbo`

### Image Editing
- `qwen-image-edit-2509`

---

# /spec/MultimodalStack.md (Proposed Spec)

## 2) Problem

A2rchitech needs a **modular multimodal stack** where:
- different tasks route to different non-frontier models for cost/perf
- the OS owns state (memory + policy), models are stateless engines
- every call yields durable artifacts (json/diff/image/log) usable by swarms
- the system runs locally, remotely, or via vendor APIs using the same interface

## 3) Goals / Non‑Goals

### Goals
1. Deterministic capability routing (with explicit fallbacks).
2. Stable interfaces: **Skill API** and **Provider Adapter API**.
3. Artifact-first outputs with typed metadata.
4. CLI-first execution with a uniform command surface (`a2r run ...`).
5. Observability: logs, cost, latency, provider selection trace.
6. Safe execution boundaries: policy gates for tools, data, network.

### Non‑Goals (for v1)
- Training or fine-tuning models.
- Building a new model serving framework (reuse vLLM/llama.cpp/vendor APIs).
- Perfect auto-classification (allow explicit override + guardrails).

## 4) Core Architecture

### 4.1 Components
- **Capability Router**: chooses capability + provider + tier.
- **Skill Registry**: declarative catalog of skills and available providers.
- **Provider Adapter Layer**: provider-specific wrappers behind a common interface.
- **Execution Runtimes**: local (docker/vLLM/llama.cpp), remote (ssh), cloud (API).
- **Artifact Store**: content-addressed artifacts + metadata.
- **Policy Engine**: gates tools, memory scopes, and side effects.
- **Telemetry**: traces, cost estimates, latency, failures.

### 4.2 Data Flow
1. Request enters Brain Runtime.
2. Classifier assigns `capability`, `cost_tier`, `latency_requirement`, `artifact_type`.
3. Router selects provider via rules + constraints.
4. Adapter executes in appropriate runtime.
5. Output normalized into **Artifact**.
6. Artifacts stored + indexed; returned to agent / UI.

## 5) Capability Contract (Skill Surface)

A2rchitech exposes stable capabilities, independent of provider:

- `vision.ocr(image)->artifact:ocr_json`
- `vision.vl_reason(image, prompt)->artifact:json|doc`
- `code.fast(repo|prompt)->artifact:diff|patch`
- `code.heavy(repo|prompt)->artifact:diff|patch|report`
- `reason.solve(prompt)->artifact:plan|proof|trace`
- `write.longform(prompt, style)->artifact:doc`
- `general.chat(messages)->artifact:chatlog|json`
- `image.generate(prompt)->artifact:image_png`
- `image.edit(image, mask, instruction)->artifact:image_png`

## 6) Routing Rules (Deterministic Core)

Routing decision is based on:

- `capability` (required)
- `tier` (low|medium|high)
- `constraints`:
  - max_cost_per_call
  - max_latency_ms
  - required_context_len
  - required_modalities
  - privacy_mode (local_only|remote_ok|cloud_ok)
  - availability (provider health)

### Default mapping (v1)
- OCR: `qwen-3-vl` → fallback `glm-4.6v`
- Cheap code: `qwen-3-coder` → fallback `glm-4.7`
- Heavy code: `glm-4.7` → fallback `minimax-m2.1`
- Reasoning: `deepseek-speciale` → fallback `deepseek-v3.2`
- Writing: `kimi-k2-thinking` → fallback `kimi-k2`
- General: `deepseek-v3.2` → fallback `glm-4.7`
- Image gen: `flux-2-dev` → fallback `z-image-turbo`
- Image edit: `qwen-image-edit-2509` → fallback (future)

## 7) Artifact Model (First‑Class)

All outputs normalize into:

```json
{
  "id": "artf_...",
  "type": "diff|patch|json|doc|image|log|trace",
  "created_at": "2026-01-26T00:00:00-06:00",
  "producer": {
    "capability": "code.heavy",
    "provider": "glm-4.7",
    "runtime": "local|remote|cloud",
    "model": "glm-4.7"
  },
  "inputs": {
    "content_refs": ["..."],
    "params": {}
  },
  "content_ref": "cas://sha256/...",
  "metadata": {
    "tokens_in": 0,
    "tokens_out": 0,
    "latency_ms": 0,
    "cost_usd_est": 0.0
  }
}
```

---

# /spec/Contracts/SkillSchema.json (Contract)

> Defines Skill Registry entries consumed by Router + CLI.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "A2rchitech Skill Schema",
  "type": "object",
  "required": ["name", "version", "capability", "inputs", "outputs", "providers", "policy"],
  "properties": {
    "name": { "type": "string", "pattern": "^[a-z]+\.[a-z0-9_]+$" },
    "version": { "type": "string" },
    "capability": {
      "type": "string",
      "enum": ["ocr", "vision_reasoning", "cheap_code", "heavy_code", "reasoning", "writing", "general", "image_gen", "image_edit"]
    },
    "inputs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "kind", "required"],
        "properties": {
          "name": { "type": "string" },
          "kind": { "type": "string", "enum": ["text", "messages", "image_path", "repo_path", "json", "mask_path"] },
          "required": { "type": "boolean" }
        }
      }
    },
    "outputs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type"],
        "properties": {
          "type": { "type": "string", "enum": ["diff", "patch", "json", "doc", "image_png", "log", "trace"] }
        }
      }
    },
    "providers": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "priority", "adapter", "runtime_modes"],
        "properties": {
          "id": { "type": "string" },
          "priority": { "type": "integer", "minimum": 1 },
          "adapter": { "type": "string" },
          "runtime_modes": {
            "type": "array",
            "items": { "type": "string", "enum": ["local", "remote", "cloud"] }
          },
          "constraints": {
            "type": "object",
            "properties": {
              "max_cost_usd": { "type": "number" },
              "max_latency_ms": { "type": "integer" },
              "min_context_tokens": { "type": "integer" },
              "privacy": { "type": "string", "enum": ["local_only", "remote_ok", "cloud_ok"] }
            }
          }
        }
      }
    },
    "fallback": {
      "type": "array",
      "items": { "type": "string" }
    },
    "policy": {
      "type": "object",
      "required": ["safety_level"],
      "properties": {
        "safety_level": { "type": "string", "enum": ["read_only", "write", "destructive"] },
        "requires_user_confirm": { "type": "boolean" },
        "allowed_memory_scopes": {
          "type": "array",
          "items": { "type": "string", "enum": ["ephemeral", "session", "project", "global"] }
        }
      }
    }
  }
}
```

---

# /spec/Contracts/ModelProviderAdapter.json (Contract)

> Standard interface each provider adapter must implement.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Model Provider Adapter Interface",
  "type": "object",
  "required": ["id", "capabilities", "invoke"],
  "properties": {
    "id": { "type": "string" },
    "capabilities": {
      "type": "array",
      "items": { "type": "string" }
    },
    "invoke": {
      "type": "object",
      "required": ["input", "context", "runtime"],
      "properties": {
        "input": { "type": "object" },
        "context": {
          "type": "object",
          "properties": {
            "trace_id": { "type": "string" },
            "project_id": { "type": "string" },
            "memory_scope": { "type": "string" }
          }
        },
        "runtime": {
          "type": "object",
          "required": ["mode"],
          "properties": {
            "mode": { "type": "string", "enum": ["local", "remote", "cloud"] },
            "endpoint": { "type": "string" },
            "docker_image": { "type": "string" },
            "ssh_host": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

# /spec/AcceptanceTests/MultimodalStack.acceptance.md

## Acceptance Criteria (v1)

### A) Routing Determinism
- Given a request with `capability=ocr`, the router selects `qwen-3-vl` when healthy, else falls back to `glm-4.6v`.
- Given `capability=heavy_code` and `privacy_mode=local_only`, the router must never select a `cloud` runtime.

### B) Artifact Normalization
- Every invocation yields an Artifact JSON with `id`, `type`, `producer`, `content_ref`, and `metadata`.
- Artifacts are content-addressed (hash stable for identical content).

### C) CLI Uniformity
- `a2r run vision.ocr --image <path>` executes end-to-end and returns Artifact ID.
- `a2r run code.fast --repo <path>` returns a patch artifact.

### D) Provider Swap
- Updating a Skill Registry entry to prefer a different provider changes selection without modifying calling code.

### E) Observability
- Each invocation emits: provider selected, latency, cost estimate, and any fallback reason.

---

# Implementation Blueprint (Tasks)

## 8) Phase 1 — Capability Router (MUST FIRST)

1. **Define request classification schema**
   - inputs: modality, task_type, constraints
   - outputs: capability, tier, artifact_type

2. **Implement routing engine**
   - rules: static map + constraints solver
   - features: provider health checks + fallback

3. **Add cost governor**
   - hard caps: max_cost_usd, max_tokens
   - soft policy: choose cheaper provider when “good enough”

Deliverable:
- `packages/router/*` with unit tests

## 9) Phase 2 — Skill Registry + Contracts

1. Implement Skill Registry loader:
   - reads `/skills/**/*.yaml`
   - validates against `SkillSchema.json`

2. Add registry query API:
   - list skills
   - list providers for skill
   - resolve default provider

Deliverable:
- `packages/skills-registry/*`

## 10) Phase 3 — Provider Adapter Layer

Adapters (one per provider family):
- `adapters/qwen/*`
- `adapters/glm/*`
- `adapters/deepseek/*`
- `adapters/kimi/*`
- `adapters/flux/*`
- `adapters/minimax/*`

Each adapter implements:
- `invoke() -> Artifact`
- streaming support (optional v1)
- runtime modes (local/remote/cloud)

Deliverable:
- `packages/adapters/*`

## 11) Phase 4 — CLI Surface (a2r)

Commands:
- `a2r skills list`
- `a2r providers list`
- `a2r run <skill> [args]`
- `a2r artifacts get <id>`
- `a2r trace <id>`

Deliverable:
- `/tools/a2r/*` (node/rust, whichever your repo standardizes)

## 12) Phase 5 — Artifact Store

- content-addressed storage: `cas://sha256/...`
- metadata index: sqlite/postgres (v1 can be sqlite)
- folder mirror for human browsing

Deliverable:
- `packages/artifacts/*`

---

# Pitfalls to Avoid (Hard Lessons)

1. **Provider-specific prompts leaking into callers**
   - Fix: keep provider prompts inside adapters; callers use capability prompts.

2. **No stable artifact contract**
   - Fix: normalize EVERYTHING into Artifact with content_ref + metadata.

3. **Routing that is “LLM magic”**
   - Fix: deterministic rules first; allow LLM classification later as optional.

4. **UI-first thinking**
   - Fix: CLI + contracts first; UI consumes registry + artifacts.

5. **No fallback discipline**
   - Fix: explicit fallback chains and health checks.

---

# Minimal Skill YAML Templates (Drop-In)

## Example: vision.ocr
```yaml
name: vision.ocr
version: 0.1.0
capability: ocr
inputs:
  - name: image
    kind: image_path
    required: true
outputs:
  - type: json
providers:
  - id: qwen-3-vl
    priority: 1
    adapter: adapters/qwen/vl
    runtime_modes: [local, remote, cloud]
  - id: glm-4.6v
    priority: 2
    adapter: adapters/glm/vision
    runtime_modes: [cloud, remote]
fallback: [glm-4.6v]
policy:
  safety_level: read_only
  requires_user_confirm: false
  allowed_memory_scopes: [session, project]
```

## Example: code.fast
```yaml
name: code.fast
version: 0.1.0
capability: cheap_code
inputs:
  - name: prompt
    kind: text
    required: true
  - name: repo
    kind: repo_path
    required: false
outputs:
  - type: patch
providers:
  - id: qwen-3-coder
    priority: 1
    adapter: adapters/qwen/coder
    runtime_modes: [local, remote, cloud]
fallback: [glm-4.7]
policy:
  safety_level: write
  requires_user_confirm: true
  allowed_memory_scopes: [session, project]
```

---

# Next: How to Use This in A2rchitech Immediately

1. Land the spec files in your repo under `/spec` and `/skills`.
2. Implement router + registry (Phases 1–2).
3. Add a single adapter end-to-end (recommend: `vision.ocr`).
4. Wire CLI (`a2r run vision.ocr --image ...`).
5. Expand adapters + skills incrementally.

---

# Session Closeout

This session produced:
- A full **Multimodal Modular Stack** spec for A2rchitech
- Contracts for Skill Registry and Provider Adapters
- Acceptance tests for determinism, artifacts, CLI, swaps, and telemetry
- A phased implementation blueprint + pitfalls
- Drop-in YAML templates for immediate use

