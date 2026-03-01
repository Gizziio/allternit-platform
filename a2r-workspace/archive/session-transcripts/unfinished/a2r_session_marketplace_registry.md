---
topic: A2rchitech • Registry + Marketplace Control Plane + UI
date: 2026-01-26
timezone: America/Chicago
command: "gizzi save a2r session"
artifacts:
  - a2_marketplace_tab_wireframe.png
external_refs:
  - https://www.aitmpl.com/agents
---

# A2rchitech Session Summary — Registry + Marketplace

## Context
You’re building **A2rchitech** as a productivity OS / agentic platform. The focus of this session was the **capability marketplace** concept: how to discover/import **skills, tools, agents/personas, prompts, workflows, and packs** from external repos/marketplaces while keeping an **authoritative registry** inside the platform.

## Core Decision
**Registry and Marketplace are distinct control-plane concepts but should appear as one UI surface.**

- **Registry (authoritative system of record):** editable, testable, activatable.
- **Marketplace (discovery/import lens):** browse/inspect/import → **draft** only (never direct activation).

Recommended UI: one “Registry” tab with two modes:
- **Registered**
- **Marketplace**

And a strict lifecycle boundary:
**Marketplace Import → Draft (Available) → Registry Review/Test → Activate**

## Architecture Model (Federated “Asset” System)
Treat everything as a normalized **Asset** model with a single lifecycle. Asset types:
- Skill
- Tool (MCP/OpenAPI/CLI wrapper)
- Agent/Persona
- Prompt
- Workflow
- Pack (bundle)

Key platform layers:
- **Source adapters** (read-only): GitHub, SkillsMP, MCP registries, prompt hubs, internal catalogs
- **Resolver**: resolves an asset reference, pins to immutable versions, verifies, caches, returns a pinned asset record
- **Content-addressed cache**: stores fetched assets by hash/digest for reproducibility + offline
- **Policy/permissions**: capability-based permissions + trust tiers
- **Sandbox runner**: executes assets under constrained permissions
- **Audit/provenance**: logs of tool calls, provenance chain, activation history

Non-negotiables:
1) No execution without immutable pinning (SHA/digest).
2) Marketplace never activates; activation is Registry-only.
3) All imports go through the resolver and land as draft/available first.

## UX Target (inspired by aitmpl)
Reference experience: https://www.aitmpl.com/agents

Key UX pattern to emulate:
- Browse across asset types
- “Cart/Stack Builder” that builds a **pack** (bundled capabilities) and produces a single “import pack” action (optionally also a CLI command in your ecosystem)

Key governance difference to preserve:
- aitmpl-like systems often do direct “install/enable”; A2rchitech must do **import-to-draft then promote**.

## Prompts Produced (Agent Commands)
### A) Repo audit prompt (marketplace control plane)
A full “repo cartography + gap analysis” prompt was created earlier in the session to force an agent to inventory marketplace primitives: schema, resolver, cache, sandbox, trust, audit, and UI.

### B) Registry vs Marketplace decision
Guidance: keep Registry and Marketplace separate as concepts, unified as one surface with two modes.

### C) Agent prompt to build Marketplace UI correctly (A2rchitech)
A detailed “UI implementation agent” prompt was created with:
- hard rules (work only in a2rchitech, don’t implement backend unless needed)
- Step 1: locate existing registry implementation
- Step 2: add two-mode UI (Registered/Marketplace)
- Step 3: UI-first data layer boundary (marketplaceClient + fixtures)
- Step 4: quality bar (empty/loading/error states, badges, filters)
- Step 5: acceptance tests

### D) “Wrong directory” correction prompt (no git)
A corrective protocol prompt was produced to force an agent to stop assuming repo scope, prove current directory using filesystem-only commands, locate a2rchitech, and re-run audits strictly inside it.

## Artifacts Saved (Images / Visuals)
### Marketplace Tab Wireframe
- **File:** `a2_marketplace_tab_wireframe.png`
- **Purpose:** grayscale wireframe of the desired “Marketplace inside Registry” tab surface (Sources panel, filters, results list, details panel, provenance strip).
- **Local artifact path:** `sandbox:/mnt/data/a2_marketplace_tab_wireframe.png`

## Next Execution Steps (High-confidence)
1) In A2rchitech, locate the existing **Registry tab** implementation (routes/components/services).
2) Implement **two-mode UI** in that tab: Registered / Marketplace.
3) Marketplace mode:
   - discovery UI + filters + detail panel
   - Import action that creates **draft** registry entries (or calls an existing import/register endpoint)
4) Registry mode:
   - keep authoritative edits/tests/activation tools
5) Add “Pack Builder” (cart) UX to mirror aitmpl’s usability, but route through draft + promotion lifecycle.

---
End.
