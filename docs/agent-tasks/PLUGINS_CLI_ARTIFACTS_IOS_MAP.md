# Plugins, CLI, Artifacts, iOS, Docs, and Loops Integration Map

## Overview
This document maps 10 external ecosystems across multimodal plugin frameworks, terminal AI CLIs, deep research pipelines, visual diagram templates, mobile clients, and agent workflow cookbooks into the Allternit platform.

---

### 1. `vercel/ai-agent-plugins`
- **Summary:** Composable TypeScript plugin framework for AI agents providing standardized middleware, state stores, and tool hooks.
- **License & Reuse Risk:** Apache 2.0. Low risk.
- **Decision:** **Adopt Interface Standards**. Allternit's `@allternit/plugin-sdk` aligns with its tool declaration and hook middleware shapes.
- **Target Surface:** `packages/@allternit/plugin-sdk` & Gizzi code runtime.

---

### 2. `QwenLM/Qwen-MM-Plugins`
- **Summary:** Specialized vision-language and audio multimodal plugins for document OCR, video frame analysis, diagram extraction, and spatial bounding-box grounding.
- **License & Reuse Risk:** Apache 2.0. Low risk.
- **Decision:** **Adopt as Native Plugin Preset**. Integrated as multimodal plugins callable in Gizzi code and ACI computer vision pipelines.
- **Target Surface:** Gizzi code plugins & ACI Vision canvas.

---

### 3. `loopany.ai/templates`
- **Summary:** Curated library of autonomous automation loops (lead scrapers, PR review bots, content syndication chains, scheduled health check workers).
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Adopt as Automation Loop Presets**. Surfaced as one-click templates inside the Allternit Automation view.
- **Target Surface:** `surfaces/ai.allternit.com/src/views/AutomationView.tsx`.

---

### 4. `0xprincess/SPAWN.md`
- **Summary:** Declarative markdown specification for autonomous sub-agent orchestration, dynamic worker spawning, role assignment, and task delegation.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Native Harness Adoption**. Built into Allternit's sub-agent invocation protocol (`invoke_subagent` / `define_subagent`) and Rails peer registration.
- **Target Surface:** Agent runtime & Rails peer bus.

---

### 5. `vercel-labs/ai-cli`
- **Summary:** Minimal terminal CLI wrapper for stream-answering shell questions, command translation, and piped bash evaluation.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Reference for Gizzi CLI**. Features incorporated into `allternit-rails` and `gizzi exec`.
- **Target Surface:** `cmd/gizzi-code` & CLI tools.

---

### 6. `alphaXiv/openresearch-cli` & `jordan-gibbs/hyperresearch`
- **Summary:** Deep research automation engines combining multi-query search synthesis, PDF paper ingestion, arXiv scraping, and hierarchical report generation.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Adopt Research Subagent**. Implemented as the built-in `research` subagent role and Deep Research tool presets.
- **Target Surface:** Research subagents & second brain ingestion.

---

### 7. `cathrynlavery/diagram-design`
- **Summary:** High-aesthetic Mermaid, SVG, and ASCII diagram templates and visual layouts for software architecture, decision trees, and sequence flows.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Adopt as Artifact Templates**. Built into the artifact rendering engine in Gizzi code and canvas views.
- **Target Surface:** Canvas & Artifact Library.

---

### 8. `happier-dev/happier`
- **Summary:** Swift-based mobile client with native Markdown rendering, token streaming, and haptic feedback.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Adopt Mobile Patterns**. Built into Allternit iOS (`surfaces/allternit-ios/`) for iPhone 16 simulator compatibility and Bot Hub navigation.
- **Target Surface:** `surfaces/allternit-ios/`.

---

### 9. `anthropics/claude-cookbooks` (`08_Dynamic_workflows.ipynb`)
- **Summary:** Production patterns for state machine agents, dynamic workflow routing, human-in-the-loop validation, and tool chaining.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Adopt into Docs & A://Labs**. Featured as interactive cookbooks in the Docs surface and A://Labs module catalog.
- **Target Surface:** `surfaces/ai.allternit.com/src/views/DocsView.tsx` & A://Labs.
