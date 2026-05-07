# Third-Party Notices

This file contains notices for open-source software incorporated into this product.

---

## open-cowork
**License:** MIT  
**Used in:** `packages/@allternit/cowork-engine/src/scheduler/`, `packages/@allternit/cowork-engine/src/memory/`, `packages/@allternit/cowork-engine/src/sandbox/`  
**Portions ported to TypeScript with Prisma/async adaptations.**

---

## mem0
**License:** Apache-2.0  
**Source:** https://github.com/mem0ai/mem0  
**Used in:** `domains/cowork/services/memory/`  
**Docker sidecar; REST and MCP interfaces on port 8765; Qdrant vector backend.**

---

## mcp-memory-service
**License:** Apache-2.0  
**Used in:** `domains/cowork/services/memory-mcp/`  
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
**Used in:** `domains/cowork/services/sandbox/`  
**Docker sidecar on port 8762; opensandbox/server image with Docker socket mount.**

---

## browser-use
**License:** MIT  
**Source:** https://github.com/browser-use/browser-use  
**Used in:** `domains/cowork/services/browser-agent/`  
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
**Used in:** `domains/cowork/services/research/`  
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
