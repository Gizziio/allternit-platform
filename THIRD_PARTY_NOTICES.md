# Third-Party Notices

This file contains notices for open-source software incorporated into this product.

---

## GenOffice
**License:** Apache-2.0

**Copyright:** Copyright 2026 Mainfunc, Inc.

**Source:** https://github.com/genspark-ai/genoffice

**Used in:**
- `packages/@allternit/office-docx-engine/`
- `packages/@allternit/office-pptx-engine/`
- `packages/@allternit/office-pptx-render/`
- `packages/@allternit/office-file-parse/`
- `packages/@allternit/office-xlsx-engine/` (Rust crate from `apps/sheets/native/xlsx-engine` + Node sidecar client)

**GenOffice document office engines forked and adapted for the Allternit workspace. Each package retains a copy of the GenOffice `LICENSE` and `NOTICE` files.

---

## anydoc
**License:** MIT

**Copyright:** Copyright (c) 2026 Firecrawl

**Source:** https://github.com/firecrawl/anydoc

**Used in:** `services/office-engine/` (`@firecrawl/anydoc` npm package, pinned at `0.1.6`)

**Rust document → GFM Markdown converter with napi prebuilt Node bindings; powers the office engine's `POST /markdown` endpoint.**

---

## Readability
**License:** Apache-2.0

**Copyright:** Copyright (c) 2023 Mozilla

**Source:** https://github.com/mozilla/readability

**Used in:** `services/office-engine/` (`@mozilla/readability` npm package, `0.6.0`)

**Main-content extraction for the office engine's `POST /markdown-url` endpoint (URL → Markdown).**

---

## Turndown
**License:** MIT

**Copyright:** Copyright (c) 2017 Dom Christie

**Source:** https://github.com/mixmark-io/turndown

**Used in:** `services/office-engine/` (`turndown` npm package, `7.2.0`)

**HTML → GFM Markdown conversion for the office engine's `POST /markdown-url` endpoint.**

---

## linkedom
**License:** ISC

**Copyright:** Copyright (c) 2020-present Andrea Giammarchi

**Source:** https://github.com/WebReflection/linkedom

**Used in:** `services/office-engine/` (`linkedom` npm package, `0.18.12`)

**Server-side DOM for Readability in the office engine's `POST /markdown-url` endpoint.**

---

## Kimi Code
**License:** MIT

**Copyright:** Copyright (c) 2026 Moonshot AI

**Source:** https://github.com/MoonshotAI/kimi-code

**Used in:** `cmd/gizzi-code/src/runtime/agents/adaptive-run-batch.ts`

**Adaptive agent batch scheduling adapted to Allternit's launcher contract.**

---

## open-cowork
**License:** MIT  
**Used in:** `packages/@allternit/cowork-engine/src/scheduler/`, `packages/@allternit/cowork-engine/src/memory/`, `packages/@allternit/cowork-engine/src/sandbox/`  
**Portions ported to TypeScript with Prisma/async adaptations.**

---

## mem0
**License:** Apache-2.0  
**Source:** https://github.com/mem0ai/mem0  
**Used in:** `tools/cowork-integration/stack/services/memory/`  
**Docker sidecar; REST and MCP interfaces on port 8765; Qdrant vector backend.**

---

## mcp-memory-service
**License:** Apache-2.0  
**Used in:** `tools/cowork-integration/stack/services/memory-mcp/`  
**Docker sidecar on port 8761; sqlite_vec backend with WAL mode.**

---

## eigent
**License:** Apache-2.0  
**Used in:**  
- `surfaces/allternit-platform/src/views/cowork/components/WorkflowPipeline.tsx` (adapted from `src/components/WorkFlow/`)  
- `surfaces/allternit-platform/src/views/cowork/components/BrowserAgentWorkspace.tsx` (adapted from `src/components/BrowserAgentWorkspace/`)  
**ReactFlow multi-agent pipeline and screenshot workspace UI; Electron dependencies removed.**

---

## cline
**License:** Apache-2.0  
**Source:** https://github.com/cline/cline  
**Used in:** `packages/@allternit/cowork-engine/src/approval/`  
**ApprovalGate class; auto-rules engine with timeout.**

---

## hermes-agent
**License:** MIT  
**Used in:** `cmd/allternit-api/src/cowork/scheduler.rs`  
**Cowork task scheduler; wired into allternit-api main.rs.**

---

## CoWork-OS
**License:** MIT  
**Used in:**  
- `cmd/allternit-api/src/cowork/executor.rs` (SubAgentOrchestrator)  
- `cmd/allternit-api/src/cowork/background_service.rs` (subconscious background loop)  
- `domains/cowork/connectors/linear/`, `connectors/jira/`, `connectors/google-workspace/`, `connectors/hubspot/`, `connectors/figma/`, `connectors/asana/`, `connectors/salesforce/`, `connectors/zendesk/`, `connectors/vercel/`, `connectors/okta/`, `connectors/monday/`, `connectors/discord/`  
**MCP stdio connector servers; CRUD operations for each platform.**

---

## OpenSandbox
**License:** Apache-2.0  
**Used in:** `tools/cowork-integration/stack/services/sandbox/`  
**Docker sidecar on port 8762; opensandbox/server image with Docker socket mount.**

---

## browser-use
**License:** MIT  
**Source:** https://github.com/browser-use/browser-use  
**Used in:** `tools/cowork-integration/stack/services/browser-agent/`  
**Docker sidecar on port 8763; MCP stdio interface for browser automation.**

---

## agent-s (GUI Agents S2)
**License:** Apache-2.0  
**Used in:** `domains/computer-use/core/adapters/hybrid/orchestrator/`  
**Hybrid orchestrator for computer-use; integrated into ACU build.**

---

## DeerFlow
**License:** MIT  
**Source:** https://github.com/bytedance/deer-flow  
**Used in:** `tools/cowork-integration/stack/services/research/`  
**LangGraph-based research super-agent; gateway on port 8764.**

---

## AionUi
**License:** Apache-2.0  
**Used in:** `packages/@allternit/cowork-engine/src/sub-agent/`  
**TeamSession and AgentFactory; concurrency cap and HTTP sub-agent runner.**

---

## agent-zero
**License:** MIT  
**Used in:** `packages/@allternit/cowork-engine/src/personas/`  
**CoworkPersonaStore with built-in persona definitions.**

---

## Scratch / Original (Allternit)
The following were written from scratch for this product:
- `domains/cowork/connectors/slack/`
- `domains/cowork/connectors/github/`
- `domains/cowork/connectors/notion/`
- All platform API routes under `surfaces/allternit-platform/src/app/api/v1/cowork/`
- `packages/@allternit/cowork-engine/src/memory/service.ts`
