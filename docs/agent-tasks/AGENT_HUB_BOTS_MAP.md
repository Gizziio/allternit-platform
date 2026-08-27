# Agent Hub & Packaged Bots Integration Map

## Overview
This document analyzes agent catalogs, packaged bot architectures, Manus-style tool loops, two-system agent harnesses, and composer tag systems against the Allternit platform.

---

### 1. `superdesigndev/treg`
- **Summary:** Tool registry and dynamic routing layer for LLM agents ("OpenRouter for tools") providing schema negotiation, fallback tools, and semantic tool search.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Adopt Registry Pattern**. Allternit's native tool belt and MCP router (`cmd/allternit-api/src/mcp_server_routes.rs`) adopt this pattern for dynamic tool discovery.
- **Agent Hub Fit:** Provides tool capabilities to packaged bots via `@` mention chips.

---

### 2. `msitarzewski/agency-agents`
- **Summary:** Comprehensive prompt engineering repository containing dozens of specialized role templates (SEO Specialists, Growth Hackers, Media Buyers, Copywriters, Systems Architects).
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Adopt Templates**. Curated role-specific personas and system prompts imported into Agent Studio and Bot Hub presets.
- **Agent Hub Fit:** Seeds initial bot templates for one-click creation.

---

### 3. `FoundationAgents/OpenManus` & `milind-soni/OpenMausBot`
- **Summary:** Autonomous agent loops with browser automation, terminal execution, file manipulation, and iterative planning capabilities.
- **License & Reuse Risk:** Apache 2.0 / MIT. Low risk.
- **Decision:** **Native Harness Adoption**. Built into Allternit's native agent harness and Gizzi agent mode loops.
- **Agent Hub Fit:** Packaged bots execute with full multi-turn tool calling and ACI browser capabilities.

---

### 4. `PrimeIntellect-ai/prime-agent`
- **Summary:** Two-system agent architecture (System 1 fast heuristic planner + System 2 slow deliberative reasoning engine) designed for decentralized compute and RL fine-tuning.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Reference for Architecture**. Influenced the separation of fast prompt dispatch vs. deep background thinking and nightly review alignment loops.
- **Agent Hub Fit:** Separates interactive turn streaming from background checkpoint synthesis.

---

### 5. `x.ai/bot` (Grok Bot Architecture)
- **Summary:** Packaged conversational bot interface with real-time tool execution chips, inline citations, and collapsible thinking traces.
- **License & Reuse Risk:** Proprietary UI reference.
- **Decision:** **Adopt UI Pattern**. Native implementation of inline tool execution parts (`AgentElementsToolPart`) and thinking toggles in `ModeSessionMessage`.
- **Agent Hub Fit:** Clean presentation of packaged bot sessions.

---

### 6. `CopilotKit/OpenTag` & Allternit Composer Tagging
- **Summary:** Interactive `@` and `#` autocomplete mechanism allowing users to mention specific bots, tools, plugins, or files directly within the message composer.
- **License & Reuse Risk:** MIT / Native implementation.
- **Decision:** **Native Allternit Tag System**. Built directly into `AgentMentionDropdown.tsx`, `ChatComposer.tsx`, and `ShellRail.tsx`.
- **Agent Hub Fit:** Mentioning `@bot` binds the session and injects the bot's custom system prompt and tools into the context pack.
