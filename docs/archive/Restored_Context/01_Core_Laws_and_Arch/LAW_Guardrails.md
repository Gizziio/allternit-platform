# allternit Guardrails & Templates  
## Extracted from Vibe Kanban – Deterministic Agent Design Rules

---

## 0. Purpose

This document defines **hard guardrails, templates, and prohibitions** for the allternit framework.

It exists to:
- Eliminate agent drift
- Prevent incremental entropy
- Enforce architectural clarity
- Bias agents toward **clean breaks over legacy debt**
- Make agent behavior **predictable and auditable**

This file is **policy**, not advice.

---

## 1. Core Philosophy (Non-Negotiable)

### 1.1 No Backwards Compatibility Bias
Agents are **explicitly allowed to break compatibility** when it improves clarity, simplicity, or correctness.

> Backwards compatibility is **not a default constraint**.

Compatibility is only preserved if:
- Explicitly mandated by compliance
- Explicitly specified in task constraints

Otherwise:
- Simplify
- Rename
- Delete
- Restructure

---

## 2. Mandatory Planning Guardrail

### RULE: Plan Before Action

No agent may modify code, schema, UI, or infra **without first producing a structured plan**.

### Required Plan Template

PLAN
- Goal (1–2 sentences)
- Non-Goals
- Constraints
- Affected Modules / Files
- Structural Changes
- Breaking Changes (Yes/No)
- Tests Required
- Rollback Strategy (if applicable)

Execution without an approved plan is **invalid output**.

---

## 3. Separation of Phases (Hard Boundary)

### RULE: Planning ≠ Execution

Agents must **not**:
- Generate plans and code in the same step
- Interleave reasoning with modifications

Phases:
1. Plan
2. Approval / Gate
3. Execution
4. Verification

Context resets are encouraged between phases.

---

## 4. Simplicity Over Legacy Rule

### RULE: Simplest Correct Shape Wins

When choosing between:
- Preserving legacy structure
- Introducing a cleaner abstraction

Agents must choose the **cleaner abstraction**.

Allowed actions:
- Renaming public APIs
- Removing unused abstractions
- Collapsing indirection
- Re-shaping schemas

Disallowed reasoning:
- “This might break existing users” (unless explicitly stated)

---

## 5. Static Safety Guardrails

### RULE: No Rule Disabling Without Justification

Agents may **not**:
- Disable linters
- Silence warnings
- Bypass validators

Forbidden patterns:
- eslint-disable
- @ts-ignore
- Silent try/catch
- Commented-out checks

If an exception is required, agents must emit:

EXCEPTION
- Rule Violated
- Justification
- Scope
- Removal Plan

---

## 6. Structural Separation Rules

### RULE: No Mixed Concerns

Mandatory separations:
- UI ≠ Logic
- State ≠ Presentation
- Orchestration ≠ Execution
- Policy ≠ Implementation

---

## 7. Style & Configuration Guardrails

### RULE: Tokenized Design Only

Agents must not introduce:
- Arbitrary spacing
- Ad-hoc colors
- One-off styles
- Magic numbers

All styling and config must map to:
- Approved tokens
- Defined variables
- Central registries

---

## 8. Testing as a First-Class Output

### RULE: No Untestable Changes

Every change must result in one of:
- Passing automated tests
- Explicit declaration of manual-only verification

---

## 9. Async & Tool Permissioning

### RULE: Explicit Tool Allowlist

Agents may only invoke tools that are:
- Pre-approved
- Declared in the task context

---

## 10. Environment Determinism

### RULE: Reproducible Contexts

Agents must assume:
- Clean environment
- No hidden state
- No manual setup

---

## 11. Canonical Guardrail Summary

REQUIRE:
- Structured plan before execution
- Explicit phase separation
- Tests or declared manual verification
- Tokenized styling/config
- Clear module boundaries

ALLOW:
- Breaking changes
- Renaming
- Deletion
- Structural refactors

DENY:
- Silent compatibility preservation
- Lint suppression
- Mixed concerns
- Untestable changes
- Implicit assumptions
