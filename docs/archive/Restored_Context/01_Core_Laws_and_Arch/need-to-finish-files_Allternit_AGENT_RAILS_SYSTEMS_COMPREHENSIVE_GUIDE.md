# Allternit Agent Rails Systems
## Comprehensive Architecture & Implementation Guide

---

> **Version:** 2026.02  
> **Status:** Production Ready (Phase 11+)  
> **Last Updated:** 2026-02-17  
> **System:** Allternit (allternit Runtime) - Agentic Operating System

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Philosophy & Design Principles](#system-philosophy--design-principles)
3. [High-Level Architecture](#high-level-architecture)
4. [The Seven Layers](#the-seven-layers)
5. [Core Subsystem: Agent System Rails](#core-subsystem-agent-system-rails)
6. [Data Flow & Execution Models](#data-flow--execution-models)
7. [Policy & Governance Framework](#policy--governance-framework)
8. [Storage & Persistence Architecture](#storage--persistence-architecture)
9. [CLI Interface Reference](#cli-interface-reference)
10. [Integration Patterns](#integration-patterns)
11. [Technology Stack](#technology-stack)
12. [Directory Structure](#directory-structure)

---

## Executive Summary

The **Allternit Agent Rails Systems** (Allternit) represents a paradigm shift in AI agent infrastructure—a **Unix-first Agentic Operating System** designed for enterprise-grade autonomous agent deployment. Unlike traditional agent frameworks that operate as libraries or services, Allternit functions as a complete operating environment with:

- **Deterministic execution rails** for agent workflows
- **Policy-gated transitions** at every operational boundary
- **Immutable audit trails** via append-only event ledgers
- **Multi-modal transport systems** (tmux, sockets, HTTP)
- **Hierarchical work identity** through DAGs and WIHs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Allternit SYSTEM OVERVIEW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Traditional AI Agent Framework          Allternit Agent Rails System            │
│   ─────────────────────────────          ───────────────────────            │
│                                                                              │
│   ┌─────────────┐    ┌─────────┐         ┌──────────────────────────┐      │
│   │   Agent     │───▶│  Tools  │         │  Policy-Gated Execution  │      │
│   │   Code      │    └─────────┘         │  ┌────────────────────┐  │      │
│   └─────────────┘                        │  │   DAG Planning     │  │      │
│         │                                │  │   ↓                │  │      │
│         ▼                                │  │   WIH Assignment   │  │      │
│   ┌─────────────┐                        │  │   ↓                │  │      │
│   │   Output    │                        │  │   Gate Check ◄─────┼──┤      │
│   └─────────────┘                        │  │   ↓                │  │      │
│                                          │  │   Ledger Write     │  │      │
│   • Ephemeral state                      │  │   ↓                │  │      │
│   • No audit trail                       │  │   Vault Archive    │  │      │
│   • Manual error handling                │  └────────────────────┘  │      │
│                                          └──────────────────────────┘      │
│                                                                             │
│   • Persistent work identity              • Complete provenance chain       │
│   • No governance boundaries              • Immutable event ledger          │
│   • Single-threaded                       • Multi-agent orchestration       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## System Philosophy & Design Principles

### 1. Policy-First Architecture

Every action in the Allternit system must pass through a **Gate**—a policy enforcement checkpoint that validates:
- **Preconditions** before execution
- **Postconditions** after completion
- **Provenance** of the action initiator
- **Lease validity** for resource access

```
┌─────────────────────────────────────────────────────────────┐
│                    POLICY GATE FLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    Agent Request                                             │
│         │                                                    │
│         ▼                                                    │
│    ┌─────────────┐                                          │
│    │   INTENT    │  "I want to modify file X"               │
│    └─────────────┘                                          │
│         │                                                    │
│         ▼                                                    │
│    ┌─────────────────────────────────────────────────────┐  │
│    │              POLICY GATE CHECK                       │  │
│    │  ┌───────────────────────────────────────────────┐  │  │
│    │  │ 1. Is AGENTS.md policy bundle injected?       │  │  │
│    │  │ 2. Does agent have lease on file X?           │  │  │
│    │  │ 3. Is risk level acceptable?                  │  │  │
│    │  │ 4. Are preconditions satisfied?               │  │  │
│    │  └───────────────────────────────────────────────┘  │  │
│    └─────────────────────────────────────────────────────┘  │
│         │                                    │               │
│    PASS │                                    │ FAIL          │
│         ▼                                    ▼               │
│    ┌─────────────┐                    ┌──────────────┐      │
│    │  EXECUTE    │                    │   REJECT     │      │
│    │  Write to   │                    │  Log reason  │      │
│    │  Ledger     │                    │  Return 403  │      │
│    └─────────────┘                    └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. Work Identity Handles (WIH)

Every unit of work in Allternit receives a **Work Identity Handle**—a persistent, trackable identity that follows the work from creation through completion:

```
┌────────────────────────────────────────────────────────────────────┐
│                     WIH LIFECYCLE                                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   CREATED        PICKED UP        EXECUTING         CLOSED          │
│      │               │                 │               │            │
│      ▼               ▼                 ▼               ▼            │
│   ┌──────┐      ┌──────┐         ┌──────┐       ┌──────┐          │
│   │ Open │─────▶│Active│────────▶│ Work │──────▶│Closed│          │
│   └──────┘      └──────┘         └──────┘       └──────┘          │
│      │               │                 │               │            │
│      │               │                 │               │            │
│   Events:        Events:           Events:        Events:          │
│   • WIHCreated   • WIHPickedUp    • ToolCalled   • WIHClosed       │
│   • DagAssigned  • WIHOpenSigned  • Output       • WIHClosedSigned │
│   • PromptLinked • LeaseGranted   • Checkpoint   • GateTurnCloseout│
│                                                                     │
│   WIH ID: dag_abc123/node_7/wih_xyz789                            │
│   Canonical identity for tracing, billing, audit                    │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 3. Append-Only Ledger

The **Ledger** is the single source of truth—an append-only log of JSONL events that enables:
- **Deterministic replay** of system state
- **Complete audit trails** for compliance
- **Time-travel debugging** through event sourcing
- **Multi-agent coordination** via shared state

```
┌────────────────────────────────────────────────────────────────────┐
│                    LEDGER STRUCTURE                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   .allternit/ledger/events/                                               │
│   ├── 2026-02-01.jsonl                                              │
│   │   {"timestamp": "2026-02-01T10:00:00Z",                         │
│   │    "event_type": "DagCreated",                                  │
│   │    "dag_id": "dag_abc123",                                      │
│   │    "prompt": "Implement auth system"}                           │
│   │   {"timestamp": "2026-02-01T10:01:00Z",                         │
│   │    "event_type": "WIHCreated",                                  │
│   │    "wih_id": "dag_abc123/node_1/wih_001",                       │
│   │    "assignee": "agent_dev_01"}                                  │
│   │   {"timestamp": "2026-02-01T10:05:00Z",                         │
│   │    "event_type": "WIHPickedUp",                                 │
│   │    "wih_id": "dag_abc123/node_1/wih_001",                       │
│   │    "agent_pubkey": "ed25519:..."}                               │
│   │                                                                 │
│   ├── 2026-02-02.jsonl                                              │
│   │   {"timestamp": "2026-02-02T14:30:00Z",                         │
│   │    "event_type": "ToolExecution",                               │
│   │    "tool": "file_write",                                        │
│   │    "wih_id": "dag_abc123/node_1/wih_001",                       │
│   │    "input_hash": "blake3:abc...",                               │
│   │    "output_hash": "blake3:def..."}                              │
│   │                                                                 │
│   └── ...                                                           │
│                                                                     │
│   Properties:                                                       │
│   • Immutable - Never delete or modify                             │
│   • Ordered - Strict temporal sequence                             │
│   • Hashed - Content-addressable with Blake3                       │
│   • Signed - Cryptographic agent signatures                        │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## High-Level Architecture

### System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL INTERFACES                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│    Users              Developers          External Services                         │
│      │                    │                      │                                   │
│      ▼                    ▼                      ▼                                   │
│ ┌──────────┐      ┌──────────────┐      ┌──────────────┐                           │
│ │ Shell    │      │ CLI (allternit)    │      │ MCP Servers  │                           │
│ │ Electron │      │ API Client   │      │ (ADK, etc.)  │                           │
│ └────┬─────┘      └──────┬───────┘      └──────┬───────┘                           │
│      │                    │                      │                                   │
│      └────────────────────┼──────────────────────┘                                   │
│                           │                                                         │
│                           ▼                                                         │
│              ┌────────────────────────┐                                            │
│              │    API GATEWAY         │  ◄── Port 8013 (Public)                    │
│              │    (Python/FastAPI)    │                                            │
│              │  • Auth/Rate Limiting  │                                            │
│              │  • Request Routing     │                                            │
│              │  • CORS Handling       │                                            │
│              └───────────┬────────────┘                                            │
│                          │                                                         │
└──────────────────────────┼─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           Allternit CORE SYSTEM                                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         PUBLIC API LAYER (Port 3000)                         │   │
│  │                           Rust (Axum Framework)                              │   │
│  │                                                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │   │
│  │  │   RLM       │  │  Capsule    │  │  Terminal   │  │    Client Adapters  │ │   │
│  │  │  Executor   │  │  Runtime    │  │  Sessions   │  │  • VoiceClient      │ │   │
│  │  │             │  │             │  │             │  │  • WebVMClient      │ │   │
│  │  │ Recursive   │  │ Sandboxed   │  │ PTY/Shell   │  │  • OperatorClient   │ │   │
│  │  │ Language    │  │ Execution   │  │ Management  │  │  • RailsClient      │ │   │
│  │  │ Model       │  │             │  │             │  │                     │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                              │
│           ┌─────────────────────────┼─────────────────────────┐                    │
│           │                         │                         │                    │
│           ▼                         ▼                         ▼                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐    │
│  │  KERNEL SERVICE │    │  MEMORY SERVICE │    │      REGISTRY SERVICE       │    │
│  │    Port 3004    │    │    Port 3200    │    │        Port 8080            │    │
│  │                 │    │                 │    │                             │    │
│  │ • Brain Session │    │ • Working       │    │ • Agent Definitions         │    │
│  │   Management    │    │   Memory        │    │ • Skill Catalog             │    │
│  │ • Tool Execution│    │ • Episodic      │    │ • Tool Schemas              │    │
│  │ • Session Fork  │    │   Memory        │    │ • Framework Registry        │    │
│  │ • Compression   │    │ • Knowledge     │    │                             │    │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────────┘    │
│           │                       │                          │                    │
│           └───────────────────────┼──────────────────────────┘                    │
│                                   │                                                 │
│                                   ▼                                                 │
│                    ┌──────────────────────────────┐                                │
│                    │     POLICY SERVICE           │                                │
│                    │       Port 3003              │                                │
│                    │                              │                                │
│                    │  • Authorization Engine      │                                │
│                    │  • Permission Evaluation     │                                │
│                    │  • Risk Assessment           │                                │
│                    │  • Confirmation Gates        │                                │
│                    └──────────────────────────────┘                                │
│                                   │                                                 │
│                                   ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    Allternit AGENT SYSTEM RAILS (Port 3011)                        │   │
│  │                         ⭐ CORE SUBSYSTEM                                    │   │
│  │                                                                              │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │   │
│  │   │   DAG    │  │   WIH    │  │   GATE   │  │  LEDGER  │  │  VAULT   │     │   │
│  │   │ Planning │  │  Manager │  │ Enforcer │  │  Store   │  │ Archiver │     │   │
│  │   └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │   │
│  │                                                                              │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐    │   │
│  │   │  Leases  │  │   Bus    │  │  Runner  │  │      Mail System         │    │   │
│  │   │  Atomic  │  │  Queue   │  │  Loop    │  │  (Agent-to-Agent Messaging) │   │
│  │   └──────────┘  └──────────┘  └──────────┘  └──────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## The Seven Layers

Allternit follows a strict 7-layer architecture where each layer can only depend on layers below it:

### Layer 0: Substrate (Foundation)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 0: SUBSTRATE                                                                  │
│ "The Bedrock" - Foundational primitives and protocols                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Allternit AGENT SYSTEM RAILS                                      │  │
│  │  Location: infrastructure/allternit-agent-system-rails/                                 │  │
│  │                                                                                │  │
│  │  ⭐ THE CORE RAIL SYSTEM ⭐                                                    │  │
│  │                                                                                │  │
│  │  ┌────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │ LAYER A: WORK SURFACE                                                   │   │  │
│  │  │ • DAG plans with hard dependencies (blocked_by)                         │   │  │
│  │  │ • Soft links (related_to)                                               │   │  │
│  │  │ • WIH selectors and assignment                                          │   │  │
│  │  │ • Canonical dag_id work identity                                        │   │  │
│  │  └────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                │  │
│  │  ┌────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │ LAYER B: GATE & POLICY                                                  │   │  │
│  │  │ • Policy bundle injection (AGENTS.md)                                   │   │  │
│  │  │ • GateTurnCloseout enforcement                                          │   │  │
│  │  │ • Lease enforcement                                                     │   │  │
│  │  │ • Mutation provenance tracking                                          │   │  │
│  │  └────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                │  │
│  │  ┌────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │ LAYER C: LEDGER, BUS & TRANSPORTS                                       │   │  │
│  │  │ • Append-only event ledger                                              │   │  │
│  │  │ • Durable SQLite bus queue                                              │   │  │
│  │  │ • tmux/socket transport runners                                         │   │  │
│  │  │ • Runner autopipeline                                                   │   │  │
│  │  └────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                │  │
│  │  ┌────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │ LAYER D: VAULT                                                          │   │  │
│  │  │ • End-of-line bundling                                                  │   │  │
│  │  │ • Workspace compaction                                                  │   │  │
│  │  │ • Archive snapshots                                                     │   │  │
│  │  │ • Learning/memory extraction                                            │   │  │
│  │  └────────────────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────────────┐ │
│  │  allternit-substrate     │  │ allternit-intent-graph   │  │  allternit-presentation-kernel       │ │
│  │  ─────────────     │  │ ────────────────   │  │  ─────────────────────────     │ │
│  │  • ProcessResult   │  │ • Intent nodes     │  │  • IntentTokenizer             │ │
│  │  • ToolRequest/    │  │ • Task/Goal/Plan   │  │  • SituationResolver           │ │
│  │    Response        │  │ • DependsOn edges  │  │  • CanvasProtocol              │ │
│  │  • PolicyContext   │  │ • Policy-gated     │  │  • Layout strategies           │ │
│  │                    │  │   mutation         │  │                                │ │
│  └────────────────────┘  └────────────────────┘  └────────────────────────────────┘ │
│                                                                                      │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────────────┐ │
│  │  allternit-embodiment    │  │ allternit-canvas-protocol│  │  TypeScript Contracts          │ │
│  │  ──────────────    │  │ ─────────────────  │  │  ───────────────────           │ │
│  │  • Agent identity  │  │ • Canvas execution │  │  • capsule-spec.ts             │ │
│  │  • Presence mgmt   │  │ • Serialization    │  │  • a2ui-types.ts               │ │
│  │  • Embodiment      │  │ • Protocol version │  │  • Cross-layer types           │ │
│  │    protocols       │  │                    │  │                                │ │
│  └────────────────────┘  └────────────────────┘  └────────────────────────────────┘ │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Layer 1: Kernel (Execution Engine)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: KERNEL                                                                     │
│ "The Engine" - Process execution, sandboxing, resource management                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐                   │
│  │      COMPUTE/EXECUTOR       │  │       WASM RUNTIME          │                   │
│  │        Port 3510            │  │                             │                   │
│  │                             │  │  • Sandboxed execution      │                   │
│  │ • Function/tool execution   │  │  • Wasmtime integration     │                   │
│  │ • Sandboxed environment     │  │  • WASI support             │                   │
│  │ • Distributed compute       │  │  • Capability-based         │                   │
│  │ • HTTP POST /execute        │  │    security                 │                   │
│  │                             │  │                             │                   │
│  └─────────────────────────────┘  └─────────────────────────────┘                   │
│                                                                                      │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐                   │
│  │      CAPSULE SYSTEM         │  │      LOCAL INFERENCE        │                   │
│  │                             │  │                             │                   │
│  │ • Capsule specification     │  │ • GGUF model support        │                   │
│  │ • Capsule compiler          │  │ • MLX inference (Apple)     │                   │
│  │ • Capsule runtime           │  │ • Local LLM execution       │                   │
│  │ • Sandboxed packaging       │  │ • On-device ML              │                   │
│  │                             │  │                             │                   │
│  └─────────────────────────────┘  └─────────────────────────────┘                   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         CONTROL PLANE                                        │   │
│  │                                                                              │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────────┐  │   │
│  │  │ Agent          │  │ Model          │  │ Context Router                 │  │   │
│  │  │ Orchestration  │  │ Router         │  │ • Intent-based routing         │  │   │
│  │  │ • Workflows    │  │ • Load balance │  │ • Situation resolution         │  │   │
│  │  │ • Hooks        │  │ • Fallback     │  │ • Context aggregation          │  │   │
│  │  │ • Agent router │  │ • Model cache  │  │ • Priority handling            │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐                   │
│  │      UNIFIED REGISTRY       │  │      MESSAGING              │                   │
│  │                             │  │                             │                   │
│  │ • Artifact registry         │  │ • Inter-agent comms         │                   │
│  │ • Tool registry             │  │ • Message bus               │                   │
│  │ • Framework registry        │  │ • Event streaming           │                   │
│  │ • Registry replication      │  │ • Pub/sub patterns          │                   │
│  │                             │  │                             │                   │
│  └─────────────────────────────┘  └─────────────────────────────┘                   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Layer 2: Governance (Policy & Audit)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: GOVERNANCE                                                                 │
│ "The Guardian" - Policy enforcement, audit trails, compliance                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    POLICY ENGINE                                             │   │
│  │                       Port 3003                                              │   │
│  │                                                                              │   │
│  │  Input                    Processing                    Output               │   │
│  │    │                           │                          │                  │   │
│  │    ▼                           ▼                          ▼                  │   │
│  │  ┌─────────┐  ┌─────────────────────────────┐  ┌─────────────────────┐      │   │
│  │  │ Action  │  │ 1. Parse policy context     │  │ ALLOW / DENY        │      │   │
│  │  │ Request │  │ 2. Check permissions        │  │ Risk Level          │      │   │
│  │  │  + WIH  │  │ 3. Evaluate risk            │  │ Required Confirm    │      │   │
│  │  └─────────┘  │ 4. Validate leases          │  │ Audit Log Entry     │      │   │
│  │               │ 5. Check preconditions      │  └─────────────────────┘      │   │
│  │               └─────────────────────────────┘                               │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────┐  │
│  │    AUDIT LOGGING        │  │   EVIDENCE MANAGEMENT   │  │  GOVERNANCE         │  │
│  │    ─────────────        │  │   ──────────────────    │  │  WORKFLOWS          │  │
│  │                         │  │                         │  │                     │  │
│  │ • Structured logging    │  │ • Receipt collection    │  │ • Approval flows    │  │
│  │ • Correlation IDs       │  │ • Blob storage          │  │ • Escalation paths  │  │
│  │ • Performance metrics   │  │ • Content hashing       │  │ • Review queues     │  │
│  │ • Error rate tracking   │  │ • Evidence chains       │  │ • Decision records  │  │
│  │ • Resource monitoring   │  │ • Proof bundles         │  │ • Delegation rules  │  │
│  │                         │  │                         │  │                     │  │
│  └─────────────────────────┘  └─────────────────────────┘  └─────────────────────┘  │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │              IDENTITY & ACCESS CONTROL                                       │   │
│  │                                                                              │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────────┐  │   │
│  │  │ Authentication │  │ Authorization  │  │ Worktree Management            │  │   │
│  │  │ • Pubkey auth  │  │ • RBAC         │  │ • Workspace isolation          │  │   │
│  │  │ • JWT tokens   │  │ • ABAC         │  │ • Git worktree integration     │  │   │
│  │  │ • API keys     │  │ • Policies     │  │ • Multi-agent coordination     │  │   │
│  │  │ • Ed25519 sigs │  │ • Gates        │  │ • Concurrent work management   │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Layers 3-7: Adapters, Services, Agents, UI, Apps

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: ADAPTERS                                                                   │
│ "The Bridges" - External integrations and protocol translations                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                     BRIDGE SYSTEMS                                           │   │
│  │                                                                              │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────────┐  │   │
│  │  │ Native Bridge  │  │ WebVM Bridge   │  │ IO Daemon                      │  │   │
│  │  │ Port 8002      │  │ Port 8002      │  │ • File watching                │  │   │
│  │  │                │  │                │  │ • Process monitoring           │  │   │
│  │  │ • System calls │  │ • WASM VM      │  │ • Event forwarding             │  │   │
│  │  │ • Native tools │  │ • Sandboxed    │  │ • Stream multiplexing          │  │   │
│  │  │ • OS interface │  │   execution    │  │                                │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                     MCP (Model Context Protocol)                             │   │
│  │                                                                              │   │
│  │  ┌────────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ MCP Client                                                              │ │   │
│  │  │ • A2P protocol support                                                  │ │   │
│  │  │ • Server discovery                                                      │ │   │
│  │  │ • Tool aggregation                                                      │ │   │
│  │  │ • Capability negotiation                                                │ │   │
│  │  └────────────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                     RUST ADAPTERS                                            │   │
│  │                                                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   Skills    │  │ Marketplace │  │  Providers  │  │   Extensions        │  │   │
│  │  │ • Skill SDK │  │ • Registry  │  │ • Model     │  │ • Custom adapters   │  │   │
│  │  │ • Execution │  │ • Discovery │  │   providers │  │ • Third-party       │  │   │
│  │  │ • Porting   │  │ • Install   │  │ • Tool      │  │   integrations      │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 4: SERVICES                                                                   │
│ "The Orchestrators" - Business logic, coordination, AI services                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐                   │
│  │      GATEWAY                │  │      ORCHESTRATION          │                   │
│  │      Port 8013              │  │                             │                   │
│  │                             │  │  ┌───────────────────────┐  │                   │
│  │ • Single entry point        │  │  │  Kernel Service       │  │                   │
│  │ • SSL/TLS termination       │  │  │  Port 3004            │  │                   │
│  │ • JWT/API key auth          │  │  │                       │  │                   │
│  │ • Rate limiting             │  │  │ • Brain session mgmt  │  │                   │
│  │ • Request routing           │  │  │ • Tool execution      │  │                   │
│  │ • CORS handling             │  │  │ • Agent runtime       │  │                   │
│  │                             │  │  │ • Session compression │  │                   │
│  └─────────────────────────────┘  │  └───────────────────────┘  │                   │
│                                    │                             │                   │
│  ┌─────────────────────────────┐  │  ┌───────────────────────┐  │                   │
│  │      MEMORY SERVICE         │  │  │  Platform             │  │                   │
│  │      Port 3200              │  │  │  Orchestration        │  │                   │
│  │                             │  │  └───────────────────────┘  │                   │
│  │ • Working memory            │  │                             │                   │
│  │ • Episodic memory           │  │  ┌───────────────────────┐  │                   │
│  │ • Knowledge memory          │  │  │  Workspace Service    │  │                   │
│  │ • Context aggregation       │  │  │                       │  │                   │
│  │ • Memory slicing            │  │  │ • Workspace mgmt      │  │                   │
│  └─────────────────────────────┘  │  │ • Project isolation   │  │                   │
│                                    │  │ • Resource allocation │  │                   │
│  ┌─────────────────────────────┐  │  └───────────────────────┘  │                   │
│  │      REGISTRY               │  │                             │                   │
│  │      Port 8080              │  └─────────────────────────────┘                   │
│  │                             │                                                    │
│  │ • Agent definitions         │  ┌──────────────────────────────────────────────┐  │
│  │ • Skill catalog             │  │  ML/AI SERVICES                              │  │
│  │ • Tool schemas              │  │                                              │  │
│  │ • Framework registry        │  │  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │ • Version management        │  │  │   VOICE      │  │   PATTERN SERVICE    │  │  │
│  └─────────────────────────────┘  │  │   Port 8001  │  │                      │  │  │
│                                    │  │              │  │ • Pattern matching   │  │  │
│                                    │  │ • TTS        │  │ • Anomaly detection  │  │  │
│                                    │  │ • Voice clone│  │ • Trend analysis     │  │  │
│                                    │  │ • Piper/XTTS │  │ • Classification     │  │  │
│                                    │  └──────────────┘  └──────────────────────┘  │  │
│                                    │                                              │  │
│                                    │  ┌──────────────────────────────────────┐    │  │
│                                    │  │   PROMPT PACK SERVICE                │    │  │
│                                    │  │   • Prompt templates                 │    │  │
│                                    │  │   • Version control                  │    │  │
│                                    │  │   • A/B testing                      │    │  │
│                                    │  └──────────────────────────────────────┘    │  │
│                                    └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 5: AGENTS                                                                     │
│ "The Workers" - Agent implementations and specialized behaviors                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    AGENT TYPES                                               │   │
│  │                                                                              │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────────┐  │   │
│  │  │ Coding Agent   │  │ Research Agent │  │ Analysis Agent                 │  │   │
│  │  │ • Code gen     │  │ • Web search   │  │ • Data analysis                │  │   │
│  │  │ • Refactoring  │  │ • Doc retrieval│  │ • Pattern recognition          │  │   │
│  │  │ • Testing      │  │ • Synthesis    │  │ • Report generation            │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────────────────────┘  │   │
│  │                                                                              │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────────┐  │   │
│  │  │ DevOps Agent   │  │ Trading Agent  │  │ Orchestrator Agent             │  │   │
│  │  │ • Deployments  │  │ • Market data  │  │ • Multi-agent coord            │  │   │
│  │  │ • Monitoring   │  │ • Risk mgmt    │  │ • Task decomposition           │  │   │
│  │  │ • Incident     │  │ • Execution    │  │ • Resource scheduling          │  │   │
│  │  │   response     │  │                │  │                                │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 6: UI                                                                         │
│ "The Interface" - User-facing applications and components                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    Allternit PLATFORM (Web UI)                                     │   │
│  │                    Location: surfaces/allternit-platform/                              │   │
│  │                                                                              │   │
│  │  ┌────────────────────────────────────────────────────────────────────────┐  │   │
│  │  │                              VIEWS                                      │  │   │
│  │  │                                                                         │  │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │  │   │
│  │  │  │ Chat View    │  │ Agent Mode   │  │ Session Management           │  │  │   │
│  │  │  │              │  │              │  │                              │  │  │   │
│  │  │  │ • Threaded   │  │ • Tool access│  │ • Native ChatStore           │  │  │   │
│  │  │  │   messaging  │  │ • Context    │  │ • Auto-migration             │  │  │   │
│  │  │  │ • Markdown   │  │   awareness  │  │   from OpenClaw              │  │  │   │
│  │  │  │   rendering  │  │ • Streaming  │  │ • Session persistence        │  │  │   │
│  │  │  └──────────────┘  └──────────────┘  └──────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    SHELL ELECTRON (Desktop App)                              │   │
│  │                    Location: 6-apps/shell-electron/                          │   │
│  │                                                                              │   │
│  │  Features:                                                                   │   │
│  │  • Desktop application with native OS integration                            │   │
│  │  • WebVM terminal embedding                                                  │   │
│  │  • Voice output integration                                                  │   │
│  │  • Allternit Operator automation controls                                          │   │
│  │  • System tray integration                                                   │   │
│  │  • Native notifications                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    CANVAS MONITOR                                            │   │
│  │                                                                              │   │
│  │  • A2UI protocol rendering                                                   │   │
│  │  • Agent-driven UI generation                                                │   │
│  │  • Real-time canvas updates                                                  │   │
│  │  • Interactive components                                                    │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 7: APPS                                                                       │
│ "The Products" - Complete applications and distribution targets                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    Allternit CLI                                                   │   │
│  │                    Location: cmd/cli/                                     │   │
│  │                    Binary: allternit                                               │   │
│  │                                                                              │   │
│  │  Capabilities:                                                               │   │
│  │  • allternit rails plan create "Implement auth"                                    │   │
│  │  • allternit rails wih pickup <wih_id>                                             │   │
│  │  • allternit rails gate check                                                      │   │
│  │  • allternit rails runner start                                                    │   │
│  │  • allternit rails bus send                                                        │   │
│  │  • allternit rails ledger tail                                                     │   │
│  │                                                                              │   │
│  │  Distribution:                                                               │   │
│  │  • Single binary (cargo build --release)                                     │   │
│  │  • Debian package (cargo deb)                                                │   │
│  │  • RPM package (cargo-generate-rpm)                                          │   │
│  │  • Universal macOS binary (x86_64 + aarch64)                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    PUBLIC API SERVER                                         │   │
│  │                    Location: cmd/api/                                     │   │
│  │                    Port: 3000                                                │   │
│  │                                                                              │   │
│  │  • REST API endpoints                                                        │   │
│  │  • WebSocket support                                                         │   │
│  │  • GraphQL (future)                                                          │   │
│  │  • OpenAPI specification                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Subsystem: Agent System Rails

### The Heart of Allternit

The **Agent System Rails** is the foundational subsystem that provides **unified work execution under policy gates**. It is the innovation that distinguishes Allternit from traditional agent frameworks.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    Allternit AGENT SYSTEM RAILS                                           │
│                    Location: infrastructure/allternit-agent-system-rails/                    │
│                    Port: 3011                                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                         DESIGN PRINCIPLES                                    │   │
│   │                                                                              │   │
│   │  1. Naming Locks:                                                            │   │
│   │     • "Gate" = WIH policy enforcer (NOT "kernel" or "control plane")        │   │
│   │     • Event actor.type uses "gate"                                          │   │
│   │                                                                              │   │
│   │  2. Reimplementation Strategy:                                               │   │
│   │     • References Beads + MCP Agent Mail behavior                            │   │
│   │     • NO runtime dependency on Beads/MCP Mail                               │   │
│   │     • Best-of-breed logic harvested and reimplemented                       │   │
│   │                                                                              │   │
│   │  3. CLI Namespace:                                                           │   │
│   │     • All commands under `allternit rails` (NOT `bd`)                             │   │
│   │     • Single binary: src/bin/allternit-rails.rs                                   │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                    FOUR-LAYER INTERNAL ARCHITECTURE                          │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │  LAYER A ─────────────────── WORK SURFACE ─────────────────────────────    │   │
│   │                                                                              │   │
│   │  ┌────────────────────────────────────────────────────────────────────────┐ │   │
│   │  │                     DAG (DIRECTED ACYCLIC GRAPH)                        │ │   │
│   │  │                                                                           │ │   │
│   │  │    ┌─────────┐      ┌─────────┐      ┌─────────┐                       │ │   │
│   │  │    │  Task 1 │─────▶│  Task 2 │─────▶│  Task 4 │                       │ │   │
│   │  │    │ (Root)  │      │ (Async) │      │ (Merge) │                       │ │   │
│   │  │    └─────────┘      └────┬────┘      └─────────┘                       │ │   │
│   │  │           │              │                     ▲                        │ │   │
│   │  │           │              ▼                     │                        │ │   │
│   │  │           │         ┌─────────┐               │                        │ │   │
│   │  │           │         │  Task 3 │───────────────┘                        │ │   │
│   │  │           │         │ (Parallel)│                                      │ │   │
│   │  │           │         └─────────┘                                        │ │   │
│   │  │           │                                                            │ │   │
│   │  │           │              blocked_by: ["Task 1"]                        │ │   │
│   │  │           │              related_to: ["Task 3"]  (soft link)           │ │   │
│   │  │           └──────────────────────────────────────────►                 │ │   │
│   │  │                                                                           │ │   │
│   │  │  Canonical Work Identity: dag_<hash>/node_<index>/<wih_id>              │ │   │
│   │  │                                                                           │ │   │
│   │  └────────────────────────────────────────────────────────────────────────┘ │   │
│   │                                                                              │   │
│   │  Key Abstractions:                                                           │   │
│   │  • dag_id: Canonical identifier for a work plan                             │   │
│   │  • Node: Individual task/subtask in the DAG                                 │   │
│   │  • blocked_by: Hard dependencies (must complete first)                      │   │
│   │  • related_to: Soft links (contextual relationships)                        │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │  LAYER B ─────────────── GATE & POLICY ENFORCEMENT ──────────────────────  │   │
│   │                                                                              │   │
│   │                    ┌──────────────────────────────┐                          │   │
│   │                    │         THE GATE             │                          │   │
│   │                    └──────────────────────────────┘                          │   │
│   │                                  │                                            │   │
│   │         ┌────────────────────────┼────────────────────────┐                  │   │
│   │         │                        │                        │                  │   │
│   │         ▼                        ▼                        ▼                  │   │
│   │  ┌──────────────┐       ┌────────────────┐      ┌────────────────┐          │   │
│   │  │ Preconditions│       │   Mutations    │      │ Postconditions │          │   │
│   │  │   Check      │       │   Stamping     │      │   Validation   │          │   │
│   │  └──────────────┘       └────────────────┘      └────────────────┘          │   │
│   │                                                                              │   │
│   │  Gate Responsibilities:                                                      │   │
│   │  ┌────────────────────────────────────────────────────────────────────────┐  │   │
│   │  │ 1. Policy Bundle Injection                                             │  │   │
│   │  │    • Read AGENTS.md                                                    │  │   │
│   │  │    • Read .allternit/agents/**                                               │  │   │
│   │  │    • Read .allternit/spec/**                                                 │  │   │
│   │  │    • Hash and log bundle                                               │  │   │
│   │  │    • Emit AgentsPolicyInjected event                                   │  │   │
│   │  │                                                                         │  │   │
│   │  │ 2. Lease Enforcement                                                   │  │   │
│   │  │    • Verify active leases on resources                                 │  │   │
│   │  │    • Check for conflicts                                               │  │   │
│   │  │    • Reject if no valid lease                                          │  │   │
│   │  │                                                                         │  │   │
│   │  │ 3. Mutation Provenance                                                 │  │   │
│   │  │    • Stamp every DAG mutation                                          │  │   │
│   │  │    • Include prompt/agent IDs                                          │  │   │
│   │  │    • Create MutationProvenance event                                   │  │   │
│   │  │                                                                         │  │   │
│   │  │ 4. GateTurnCloseout                                                    │  │   │
│   │  │    • Re-check receipts after iteration                                 │  │   │
│   │  │    • Release completed leases                                          │  │   │
│   │  │    • Update WIH heartbeat                                              │  │   │
│   │  │    • Log metadata                                                      │  │   │
│   │  └────────────────────────────────────────────────────────────────────────┘  │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │  LAYER C ─────────────── LEDGER, BUS & TRANSPORTS ───────────────────────  │   │
│   │                                                                              │   │
│   │  ┌────────────────────────────────────────────────────────────────────────┐  │   │
│   │  │                     LEDGER STORE                                        │  │   │
│   │  │                                                                           │  │   │
│   │  │  Path: .allternit/ledger/events/YYYY-MM-DD.jsonl                              │  │   │
│   │  │                                                                           │  │   │
│   │  │  Properties:                                                              │  │   │
│   │  │  ┌─────────────────────────────────────────────────────────────────┐    │  │   │
│   │  │  │ • Append-only        │ Never modify or delete existing events   │    │  │   │
│   │  │  │ • Idempotent replay  │ Same input → Same state (deterministic)  │    │  │   │
│   │  │  │ • Content-addressed  │ Blake3 hashes for verification           │    │  │   │
│   │  │  │ • Cryptographically  │ Ed25519 signatures for non-repudiation   │    │  │   │
│   │  │  │   signed                                                      │    │  │   │
│   │  │  │ • Temporally ordered │ Strict event sequence for causality      │    │  │   │
│   │  │  └─────────────────────────────────────────────────────────────────┘    │  │   │
│   │  │                                                                           │  │   │
│   │  │  Event Types:                                                             │  │   │
│   │  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐    │  │   │
│   │  │  │ DAG Events       │  │ WIH Events       │  │ Runner Events        │    │  │   │
│   │  │  │ ──────────       │  │ ──────────       │  │ ─────────────        │    │  │   │
│   │  │  │ DagCreated       │  │ WIHCreated       │  │ RailsLoopStarted     │    │  │   │
│   │  │  │ DagNodeCreated   │  │ WIHPickedUp      │  │ RailsLoopIteration*  │    │  │   │
│   │  │  │ DagUpdated       │  │ WIHOpenSigned    │  │ VaultArchiveStarted  │    │  │   │
│   │  │  │ DagCompleted     │  │ WIHClosed        │  │ VaultArchiveComplete │    │  │   │
│   │  │  │                  │  │ WIHClosedSigned  │  │                      │    │  │   │
│   │  │  └──────────────────┘  └──────────────────┘  └──────────────────────┘    │  │   │
│   │  └────────────────────────────────────────────────────────────────────────┘  │   │
│   │                                                                              │   │
│   │  ┌────────────────────────────────────────────────────────────────────────┐  │   │
│   │  │                     BUS QUEUE                                           │  │   │
│   │  │                                                                           │  │   │
│   │  │  Path: .allternit/bus/queue.db (SQLite)                                       │  │   │
│   │  │                                                                           │  │   │
│   │  │  Features:                                                                │  │   │
│   │  │  • Durable message queue                                                  │  │   │
│   │  │  • At-least-once delivery                                                 │  │   │
│   │  │  • Priority ordering                                                      │  │   │
│   │  │  • Events: BusMessageSent/Delivered/Failed/Processed                      │  │   │
│   │  └────────────────────────────────────────────────────────────────────────┘  │   │
│   │                                                                              │   │
│   │  ┌────────────────────────────────────────────────────────────────────────┐  │   │
│   │  │                     TRANSPORT SYSTEM                                    │  │   │
│   │  │                                                                           │  │   │
│   │  │  ┌────────────────────────┐  ┌────────────────────────────────────────┐  │  │   │
│   │  │  │   tmux Transport       │  │   Socket Transport                     │  │  │   │
│   │  │  │   ──────────────       │  │   ────────────────                     │  │  │   │
│   │  │  │                        │  │                                        │  │  │   │
│   │  │  │ Path:                  │  │ Path:                                  │  │  │   │
│   │  │  │ .allternit/transports/tmux/  │  │ .allternit/transports/socket/                │  │  │   │
│   │  │  │                        │  │                                        │  │  │   │
│   │  │  │ State per pane:        │  │ State per socket:                      │  │  │   │
│   │  │  │ {                      │  │ {                                      │  │  │   │
│   │  │  │   busy: bool,          │  │   busy: bool,                          │  │  │   │
│   │  │  │   owner: agent_id,     │  │   owner: agent_id,                     │  │  │   │
│   │  │  │   iteration: uuid,     │  │   iteration: uuid,                     │  │  │   │
│   │  │  │   last_message: id,    │  │   last_message: id,                    │  │  │   │
│   │  │  │   last_output: text    │  │   last_output: {                       │  │  │   │
│   │  │  │ }                      │  │     status, stdout, stderr             │  │  │   │
│   │  │  │                        │  │   }                                    │  │  │   │
│   │  │  │                        │  │ }                                      │  │  │   │
│   │  │  │ Busy-State Guards:     │  │                                        │  │  │   │
│   │  │  │ Reject send if busy    │  │ JSON message format                    │  │  │   │
│   │  │  │ Prevents overwrites    │  │                                        │  │  │   │
│   │  │  └────────────────────────┘  └────────────────────────────────────────┘  │  │   │
│   │  └────────────────────────────────────────────────────────────────────────┘  │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │  LAYER D ─────────────────────── VAULT ──────────────────────────────────  │   │
│   │                                                                              │   │
│   │  Path: .allternit/vault/                                                           │   │
│   │                                                                              │   │
│   │  Purpose: End-of-line bundling and workspace compaction                      │   │
│   │                                                                              │   │
│   │  Process:                                                                    │   │
│   │  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │   │
│   │  │ WIH Close│───▶│ Vault Archive│───▶│   Bundle     │───▶│   Compact    │   │   │
│   │  │   Event  │    │   Trigger    │    │   Receipts   │    │   Storage    │   │   │
│   │  └──────────┘    └──────────────┘    └──────────────┘    └──────────────┘   │   │
│   │                                                                              │   │
│   │  Features:                                                                   │   │
│   │  • Receipt bundling for completed work                                       │   │
│   │  • Blob compaction (deduplication)                                           │   │
│   │  • Learning extraction for memory systems                                    │   │
│   │  • Archive snapshots for long-term storage                                   │   │
│   │                                                                              │   │
│   │  Events:                                                                     │   │
│   │  • VaultArchiveStarted                                                       │   │
│   │  • VaultArchiveCompleted                                                     │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### The Ralph Loop Autopipeline

The **Runner** implements the Ralph loop—a self-managing execution pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    RALPH LOOP AUTOPROTOCOL                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                    RUNNER STATE MACHINE                                      │   │
│   │                                                                              │   │
│   │                    start_runner()                                            │   │
│   │                         │                                                    │   │
│   │                         ▼                                                    │   │
│   │              ┌─────────────────────┐                                         │   │
│   │         ┌───▶│   TAIL LEDGER       │◀─────────────────────────────┐          │   │
│   │         │    │   Read events       │                              │          │   │
│   │         │    └──────────┬──────────┘                              │          │   │
│   │         │               │                                         │          │   │
│   │         │               ▼                                         │          │   │
│   │         │    ┌─────────────────────┐                              │          │   │
│   │         │    │  CHECK IDEMPOTENCY  │                              │          │   │
│   │         │    │  RunnerState holds: │                              │          │   │
│   │         │    │  - processed: Set   │                              │          │   │
│   │         │    │  - cursor: Position │                              │          │   │
│   │         │    └──────────┬──────────┘                              │          │   │
│   │         │               │                                         │          │   │
│   │         │    Processed? │                                         │          │   │
│   │         │    ┌─────────┴─────────┐                                │          │   │
│   │         │    │YES                │NO                              │          │   │
│   │         │    │                   ▼                                │          │   │
│   │         │    │       ┌─────────────────────┐                     │          │   │
│   │         │    │       │  HANDLE EVENT       │                     │          │   │
│   │         │    │       └──────────┬──────────┘                     │          │   │
│   │         │    │                  │                                │          │   │
│   │         │    │     ┌────────────┴────────────┐                   │          │   │
│   │         │    │     │                         │                   │          │   │
│   │         │    │     ▼                         ▼                   │          │   │
│   │         │    │ ┌───────────┐          ┌───────────┐             │          │   │
│   │         │    │ │WIH Closed │          │  Other    │             │          │   │
│   │         │    │ │  Event    │          │  Events   │             │          │   │
│   │         │    │ └─────┬─────┘          └─────┬─────┘             │          │   │
│   │         │    │       │                      │                   │          │   │
│   │         │    │       ▼                      │                   │          │   │
│   │         │    │ ┌─────────────────────┐      │                   │          │   │
│   │         │    │ │ handle_wih_closed() │      │                   │          │   │
│   │         │    │ └──────────┬──────────┘      │                   │          │   │
│   │         │    │            │                 │                   │          │   │
│   │         │    │            ▼                 │                   │          │   │
│   │         │    │  ┌───────────────────────┐   │                   │          │   │
│   │         │    │  │ 1. Vault Archive      │   │                   │          │   │
│   │         │    │  │ 2. Release Leases     │   │                   │          │   │
│   │         │    │  │ 3. Rebuild Index      │   │                   │          │   │
│   │         │    │  │ 4. Log Gate Events    │   │                   │          │   │
│   │         │    │  └───────────────────────┘   │                   │          │   │
│   │         │    │                              │                   │          │   │
│   │         │    └──────────────┬───────────────┘                   │          │   │
│   │         │                   │                                    │          │   │
│   │         │                   ▼                                    │          │   │
│   │         │    ┌─────────────────────┐                             │          │   │
│   │         │    │  UPDATE STATE       │                             │          │   │
│   │         │    │  Write to:          │                             │          │   │
│   │         │    │  .allternit/meta/         │                             │          │   │
│   │         │    │  rails_runner_      │                             │          │   │
│   │         │    │  state.json         │                             │          │   │
│   │         │    └──────────┬──────────┘                             │          │   │
│   │         │               │                                        │          │   │
│   │         │               │                                        │          │   │
│   │         └───────────────┘                                        │          │   │
│   │                                                                  │          │   │
│   │         ┌────────────────────────────────────────────────────────┘          │   │
│   │         │                                                                    │   │
│   │         ▼                                                                    │   │
│   │    ┌─────────────────────┐                                                   │   │
│   │    │  LOOP ITERATION     │                                                   │   │
│   │    │  PROCESSING         │                                                   │   │
│   │    └─────────────────────┘                                                   │   │
│   │                                                                              │   │
│   │    Events:                                                                   │   │
│   │    • RailsLoopIterationStarted                                               │   │
│   │    • RailsLoopIterationCompleted                                             │   │
│   │    • RailsLoopIterationSpawnRequested                                        │   │
│   │    • RailsLoopIterationEscalated                                             │   │
│   │                                                                              │   │
│   │    LoopPolicy:                                                               │   │
│   │    {                                                                         │   │
│   │      max_iterations: number,                                                 │   │
│   │      timeout_seconds: number,                                                │   │
│   │      spawn_policy: "allow" | "deny" | "review",                              │   │
│   │      escalation_threshold: number                                            │   │
│   │    }                                                                         │   │
│   │                                                                              │   │
│   │    LoopProgress:                                                             │   │
│   │    {                                                                         │   │
│   │      current_iteration: number,                                              │   │
│   │      spawn_requests: number,                                                 │   │
│   │      escalation_state: "normal" | "elevated" | "critical"                    │   │
│   │    }                                                                         │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow & Execution Models

### Complete Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE AGENT REQUEST FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   USER                                                                          OUTPUT│
│     │                                                                             │   │
│     │ "Implement user authentication"                                             │   │
│     ▼                                                                             │   │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │   │
│  │                         SHELL ELECTRON / WEB UI                            │   │   │
│  └────────────────────────────────┬──────────────────────────────────────────┘   │   │
│                                   │                                               │   │
│                                   │ POST /api/v1/plan                             │   │
│                                   ▼                                               │   │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │   │
│  │                         API GATEWAY (Port 8013)                            │   │   │
│  │  • JWT/API Key Authentication                                              │   │   │
│  │  • Rate limiting check                                                     │   │   │
│  │  • CORS handling                                                           │   │   │
│  └────────────────────────────────┬──────────────────────────────────────────┘   │   │
│                                   │                                               │   │
│                                   │ Route to API Service                          │   │
│                                   ▼                                               │   │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │   │
│  │                      PUBLIC API (Port 3000) - Rust/Axum                    │   │   │
│  │                                                                            │   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │   │
│  │  │ 1. Validate  │  │ 2. Call      │  │ 3. Policy    │  │ 4. Call      │   │   │   │
│  │  │    Request   │──▶│ RailsClient  │──▶│    Check     │──▶│ Kernel       │   │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │   │   │
│  │                                                                            │   │   │
│  │  5. Return plan_id (dag_id)                                                │   │   │
│  └────────────────────────────────┬──────────────────────────────────────────┘   │   │
│                                   │                                               │   │
│                                   │ POST /v1/plan to Rails                        │   │
│                                   ▼                                               │   │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │   │
│  │                    Allternit AGENT SYSTEM RAILS (Port 3011)                      │   │   │
│  │                                                                            │   │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │   │   │
│  │  │  PLAN CREATION                                                       │   │   │   │
│  │  │                                                                      │   │   │   │
│  │  │  Input: "Implement user authentication"                              │   │   │   │
│  │  │       ▼                                                              │   │   │   │
│  │  │  Parse → Decompose → Structure as DAG                                │   │   │   │
│  │  │                                                                      │   │   │   │
│  │  │  DAG:                                                                │   │   │   │
│  │  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │   │   │   │
│  │  │  │ Design Auth │───▶│ Implement   │───▶│ Write Tests │              │   │   │   │
│  │  │  │   Schema    │    │   Backend   │    │             │              │   │   │   │
│  │  │  └─────────────┘    └─────────────┘    └─────────────┘              │   │   │   │
│  │  │                                                                      │   │   │   │
│  │  │  Events:                                                             │   │   │   │
│  │  │  • PromptCreated (prompt_id, text)                                   │   │   │   │
│  │  │  • DagCreated (dag_id, prompt_link)                                  │   │   │   │
│  │  │  • DagNodeCreated (node_id, dag_id, blocked_by, related_to)          │   │   │   │
│  │  │  • WIHCreated (wih_id, node_id, assignee)                            │   │   │   │
│  │  └─────────────────────────────────────────────────────────────────────┘   │   │   │
│  │                                                                            │   │   │
│  └────────────────────────────────┬──────────────────────────────────────────┘   │   │
│                                   │                                               │   │
│                                   │ Return dag_id + wih_ids                       │   │
│                                   │                                               │   │
│                                   ▼                                               │   │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │   │
│  │                         RUNNER PICKUP                                       │   │   │
│  │                                                                            │   │   │
│  │  Agent polls /v1/wihs or receives BusMessage                               │   │   │
│  │                                                                            │   │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │   │   │
│  │  │  WIH PICKUP                                                          │   │   │   │
│  │  │                                                                      │   │   │   │
│  │  │  POST /v1/wihs/pickup                                                │   │   │   │
│  │  │                                                                      │   │   │   │
│  │  │  ┌──────────────────────────────────────────────────────────────┐   │   │   │   │
│  │  │  │ GATE CHECK (Layer B)                                          │   │   │   │   │
│  │  │  │                                                                │   │   │   │   │
│  │  │  │ 1. Inject AGENTS.md policy bundle                              │   │   │   │   │
│  │  │  │    → Hash bundle                                               │   │   │   │   │
│  │  │  │    → Emit AgentsPolicyInjected                                 │   │   │   │   │
│  │  │  │                                                                │   │   │   │   │
│  │  │  │ 2. Verify agent capabilities                                   │   │   │   │   │
│  │  │  │                                                                │   │   │   │   │
│  │  │  │ 3. Grant lease on work context                                 │   │   │   │   │
│  │  │  │                                                                │   │   │   │   │
│  │  │  │ 4. Emit: WIHPickedUp, WIHOpenSigned                            │   │   │   │   │
│  │  │  └──────────────────────────────────────────────────────────────┘   │   │   │   │
│  │  │                                                                      │   │   │   │
│  │  │  Return: WIHContextPack {                                            │   │   │   │
│  │  │    wih_id, dag_context, tool_permissions,                            │   │   │   │
│  │  │    lease_scope, policy_bundle_hash                                   │   │   │   │
│  │  │  }                                                                   │   │   │   │
│  │  └─────────────────────────────────────────────────────────────────────┘   │   │   │
│  │                                                                            │   │   │
│  └────────────────────────────────┬──────────────────────────────────────────┘   │   │
│                                   │                                               │   │
│                                   │ Agent executes work...                        │   │
│                                   │                                               │   │
│                                   ▼                                               │   │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │   │
│  │                         WORK EXECUTION                                      │   │   │
│  │                                                                            │   │   │
│  │  Agent uses tools (file_write, shell_exec, etc.)                           │   │   │
│  │                                                                            │   │   │
│  │  Each tool call:                                                           │   │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │   │   │
│  │  │  PRE-TOOL GATE                                                     │   │   │   │
│  │  │                                                                      │   │   │   │
│  │  │  POST /v1/gate/pre-tool                                              │   │   │   │
│  │  │                                                                      │   │   │   │
│  │  │  Checks:                                                             │   │   │   │
│  │  │  • Valid lease on resource?                                          │   │   │   │
│  │  │  • AgentsPolicyInjected marker present?                              │   │   │   │
│  │  │  • Risk level acceptable?                                            │   │   │   │
│  │  │                                                                      │   │   │   │
│  │  │  Pass → Execute tool → Emit ToolExecution event                      │   │   │   │
│  │  │  Fail → Return 403 with reason                                       │   │   │   │
│  │  └─────────────────────────────────────────────────────────────────────┘   │   │   │
│  │                                                                            │   │   │
│  └────────────────────────────────┬──────────────────────────────────────────┘   │   │
│                                   │                                               │   │
│                                   │ Work complete                                 │   │
│                                   ▼                                               │   │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │   │
│  │                         WIH CLOSE                                           │   │   │
│  │                                                                            │   │   │
│  │  POST /v1/wihs/{id}/close                                                  │   │   │
│  │                                                                            │   │   │
│  │  Body: { status: "completed", evidence: [...], artifacts: [...] }          │   │   │
│  │                                                                            │   │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │   │   │
│  │  │  GATE TURN CLOSEOUT                                                │   │   │   │
│  │  │                                                                      │   │   │   │
│  │  │  1. Verify all receipts present                                      │   │   │   │
│  │  │  2. Validate lease coverage                                          │   │   │   │
│  │  │  3. Check postconditions                                             │   │   │   │
│  │  │  4. Update WIH heartbeat                                             │   │   │   │
│  │  │  5. Emit: WIHClosed, WIHClosedSigned, GateTurnCloseout               │   │   │   │
│  │  └─────────────────────────────────────────────────────────────────────┘   │   │   │
│  │                                                                            │   │   │
│  │  → Trigger Vault Archive                                                   │   │   │
│  │  → Release Leases                                                          │   │   │
│  │  → Rebuild Index                                                           │   │   │
│  │                                                                            │   │   │
│  └────────────────────────────────┬──────────────────────────────────────────┘   │   │
│                                   │                                               │   │
│                                   │ Response to User                              │   │
│                                   │                                               │   │
│                                   ▼                                               │   │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │   │
│  │                         RESULT TO USER                                      │   │   │
│  │                                                                            │   │   │
│  │  {                                                                         │   │   │
│  │    dag_id: "dag_abc123",                                                   │   │   │
│  │    status: "completed",                                                    │   │   │
│  │    summary: "User authentication system implemented",                      │   │   │
│  │    artifacts: [                                                            │   │   │
│  │      { path: "auth/schema.sql", hash: "blake3:..." },                      │   │   │
│  │      { path: "auth/backend.rs", hash: "blake3:..." },                      │   │   │
│  │      { path: "auth/tests.rs", hash: "blake3:..." }                         │   │   │
│  │    ],                                                                      │   │   │
│  │    wih_count: 3,                                                           │   │   │
│  │    completion_time: "2026-02-17T12:00:00Z"                                 │   │   │
│  │  }                                                                         │   │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Policy & Governance Framework

### Policy Bundle Injection

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    POLICY BUNDLE INJECTION                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   When: On every context boundary (WIH pickup, iteration start, tool usage)          │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                    BUNDLE COMPOSITION                                        │   │
│   │                                                                              │   │
│   │  Sources:                                                                    │   │
│   │  ┌───────────────────────────────────────────────────────────────────────┐  │   │
│   │  │ 1. AGENTS.md (workspace root)                                         │  │   │
│   │  │    • Agent behavior guidelines                                        │  │   │
│   │  │    • Tool usage policies                                              │  │   │
│   │  │    • Safety guardrails                                                │  │   │
│   │  │                                                                       │  │   │
│   │  │ 2. .allternit/agents/**                                                     │  │   │
│   │  │    • Agent-specific configurations                                    │  │   │
│   │  │    • Specialized policies                                             │  │   │
│   │  │                                                                       │  │   │
│   │  │ 3. .allternit/spec/**                                                       │  │   │
│   │  │    • Schema definitions                                               │  │   │
│   │  │    • Interface contracts                                              │  │   │
│   │  │                                                                       │  │   │
│   │  │ 4. Environment overrides                                              │  │   │
│   │  │    • ALLTERNIT_POLICY_EXTRA                                                 │  │   │
│   │  │    • Runtime policy injection                                         │  │   │
│   │  └───────────────────────────────────────────────────────────────────────┘  │   │
│   │                                                                              │   │
│   │  Process:                                                                    │   │
│   │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │   │
│   │  │ Collect  │───▶│  Hash    │───▶│  Verify  │───▶│  Emit    │              │   │
│   │  │ Sources  │    │ (Blake3) │    │  Bundle  │    │  Event   │              │   │
│   │  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │   │
│   │                                                                              │   │
│   │  Event: AgentsPolicyInjected                                                 │   │
│   │  {                                                                           │   │
│   │    timestamp: "2026-02-17T12:00:00Z",                                        │   │
│   │    actor: { type: "gate", id: "gate_001" },                                  │   │
│   │    scope: { wih_id: "...", iteration: 3 },                                   │   │
│   │    bundle_hash: "blake3:abc123...",                                          │   │
│   │    sources: [                                                                │   │
│   │      { path: "AGENTS.md", hash: "..." },                                     │   │
│   │      { path: ".allternit/agents/coding.md", hash: "..." }                          │   │
│   │    ]                                                                         │   │
│   │  }                                                                           │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Storage & Persistence Architecture

### The .allternit Directory Structure

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    Allternit STORAGE LAYOUT                                               │
│                    Path: .allternit/ (in workspace root)                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  .allternit/                                                                               │
│  ├── 📁 ledger/                      ← Authoritative source of truth               │
│  │   └── 📁 events/                                                                   │
│  │       ├── 📄 2026-02-01.jsonl     ← Daily append-only event logs                │
│  │       ├── 📄 2026-02-02.jsonl                                                     │
│  │       └── 📄 ...                                                                   │
│  │                                                                                   │
│  ├── 📁 leases/                      ← Atomic resource locks                        │
│  │   └── 📄 leases.db                ← SQLite: active, atomic, durable              │
│  │       Tables:                                                                      │
│  │       - leases (id, path, wih_id, agent, expiry, created_at)                     │
│  │       - lease_history (audit trail)                                               │
│  │                                                                                   │
│  ├── 📁 bus/                         ← Durable message queue                        │
│  │   └── 📄 queue.db                  ← SQLite: ordered, persistent                 │
│  │       Tables:                                                                      │
│  │       - messages (id, type, payload, priority, status, attempts)                 │
│  │       - dead_letter (failed messages)                                             │
│  │                                                                                   │
│  ├── 📁 transports/                  ← Transport state tracking                     │
│  │   ├── 📁 tmux/                     ← tmux pane states                            │
│  │   │   └── 📄 pane_0.json           ← { busy, owner, iteration, last_* }         │
│  │   └── 📁 socket/                   ← Socket connection states                    │
│  │       └── 📁 socket_001/                                                         │
│  │           └── 📄 iter_abc123.json  ← { busy, owner, status, stdout, stderr }    │
│  │                                                                                   │
│  ├── 📁 receipts/                    ← Immutable evidence                           │
│  │   └── 📁 2026/                                                                   │
│  │       └── 📁 02/                                                                 │
│  │           └── 📁 17/                                                             │
│  │               └── 📄 rec_def456.json                                             │
│  │                                                                                   │
│  ├── 📁 blobs/                       ← Content-addressed storage                    │
│  │   └── 📁 blake3/                                                                 │
│  │       └── 📁 ab/                   ← First 2 chars of hash                       │
│  │           └── 📄 c123...           ← Blob content                                │
│  │                                                                                   │
│  ├── 📁 index/                       ← Derived search index                         │
│  │   └── 📄 index.db                  ← SQLite FTS (rebuildable from ledger)       │
│  │       Can be rebuilt: allternit rails index rebuild                                    │
│  │                                                                                   │
│  ├── 📁 vault/                       ← Archive storage                              │
│  │   └── 📁 archives/                                                               │
│  │       └── 📄 vault_2026-02-17.tar.gz                                             │
│  │                                                                                   │
│  ├── 📁 meta/                        ← Runtime metadata                             │
│  │   ├── 📄 rails_runner_state.json   ← Runner cursor, processed events            │
│  │   └── 📄 system_config.json        ← System configuration                       │
│  │                                                                                   │
│  ├── 📁 work/                        ← Working state                                │
│  │   └── 📁 dags/                                                                   │
│  │       └── 📁 dag_abc123/                                                         │
│  │           └── 📁 wih/              ← WIH snapshots (derived from ledger)        │
│  │                                                                                   │
│  ├── 📁 agents/                      ← Agent configurations                         │
│  │   └── 📄 agent_dev_01.json                                                       │
│  │                                                                                   │
│  ├── 📁 spec/                        ← System specifications                        │
│  │   └── 📄 GATE_RULES.md             ← Policy rules                               │
│  │                                                                                   │
│  └── 📄 .gitignore                     ← Ignore: *.db, blobs/, vault/               │
│                                                                                      │
│  Legend:                                                                             │
│  📁 = Directory    📄 = File    ← = Data flow                                        │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Event Structure

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    LEDGER EVENT FORMAT                                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  Standard Event Envelope:                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                            │   │
│  │   // REQUIRED FIELDS                                                         │   │
│  │   "event_id": "evt_abc123...",         // UUID v4                            │   │
│  │   "event_type": "WIHCreated",          // PascalCase event type              │   │
│  │   "timestamp": "2026-02-17T12:00:00Z", // ISO 8601 UTC                       │   │
│  │   "version": "1.0",                    // Event schema version               │   │
│  │                                                                              │   │
│  │   // ACTOR CONTEXT                                                           │   │
│  │   "actor": {                                                                 │   │
│  │     "type": "gate",                  // "gate", "agent", "system"            │   │
│  │     "id": "gate_001",                // Actor identifier                     │   │
│  │     "pubkey": "ed25519:...",         // Optional: cryptographic identity    │   │
│  │     "signature": "base64:..."        // Optional: event signature           │   │
│  │   },                                                                         │   │
│  │                                                                              │   │
│  │   // SCOPE CONTEXT                                                           │   │
│  │   "scope": {                                                                 │   │
│  │     "dag_id": "dag_abc123",                                                │   │
│  │     "node_id": "node_1",                                                     │   │
│  │     "wih_id": "dag_abc123/node_1/wih_xyz",                                   │   │
│  │     "iteration": 3,                                                          │   │
│  │     "prompt_id": "prompt_def456"                                             │   │
│  │   },                                                                         │   │
│  │                                                                              │   │
│  │   // PAYLOAD (event-specific)                                                │   │
│  │   "payload": {                                                               │   │
│  │     // Event-specific fields here                                            │   │
│  │   },                                                                         │   │
│  │                                                                              │   │
│  │   // PROVENANCE                                                              │   │
│  │   "provenance": {                                                            │   │
│  │     "parent_events": ["evt_parent_1", "evt_parent_2"],                       │   │
│  │     "source_hash": "blake3:...",       // Content hash of triggering data   │   │
│  │     "policy_bundle_hash": "blake3:..." // Policy in effect                   │   │
│  │   },                                                                         │   │
│  │                                                                              │   │
│  │   // METADATA                                                                │   │
│  │   "meta": {                                                                  │   │
│  │     "schema_hash": "blake3:...",       // Hash of event schema              │   │
│  │     "compression": "none",             // Compression algorithm             │   │
│  │     "encrypted": false                                                        │   │
│  │   }                                                                          │   │
│  │ }                                                                            │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Example Events:                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ DagCreated                                                                   │   │
│  │ {                                                                            │   │
│  │   "event_id": "evt_001",                                                     │   │
│  │   "event_type": "DagCreated",                                                │   │
│  │   "timestamp": "2026-02-17T10:00:00Z",                                       │   │
│  │   "actor": { "type": "agent", "id": "agent_001" },                           │   │
│  │   "scope": { "dag_id": "dag_abc123" },                                       │   │
│  │   "payload": {                                                               │   │
│  │     "prompt_id": "prompt_xyz789",                                            │   │
│  │     "node_count": 5,                                                         │   │
│  │     "root_nodes": ["node_1"],                                                │   │
│  │     "metadata": { "title": "Implement auth", "complexity": "medium" }        │   │
│  │   }                                                                          │   │
│  │ }                                                                            │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │ WIHPickedUp                                                                  │   │
│  │ {                                                                            │   │
│  │   "event_id": "evt_002",                                                     │   │
│  │   "event_type": "WIHPickedUp",                                               │   │
│  │   "timestamp": "2026-02-17T10:05:00Z",                                       │   │
│  │   "actor": { "type": "agent", "id": "agent_001", "pubkey": "ed25519:..." },   │   │
│  │   "scope": { "wih_id": "dag_abc123/node_1/wih_001" },                        │   │
│  │   "payload": {                                                               │   │
│  │     "previous_state": "open",                                                │   │
│  │     "new_state": "active",                                                   │   │
│  │     "context_pack_hash": "blake3:...",                                       │   │
│  │     "lease_grants": ["file:///workspace/auth/**"]                            │   │
│  │   },                                                                         │   │
│  │   "provenance": {                                                            │   │
│  │     "parent_events": ["evt_001"]                                             │   │
│  │   }                                                                          │   │
│  │ }                                                                            │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## CLI Interface Reference

### Command Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    Allternit RAILS CLI REFERENCE                                          │
│                    Binary: allternit rails <command>                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER A: WORK ORCHESTRATION                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Plan Management:                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails plan create <text>        # Create new plan from text             │   │
│  │  allternit rails plan refine <dag_id>      # Refine existing plan                  │   │
│  │  allternit rails plan show <dag_id>        # Show DAG details                      │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  DAG Operations:                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails dag render <dag_id>       # Render DAG as JSON/Markdown           │   │
│  │  allternit rails dag status <dag_id>       # Show DAG execution status             │   │
│  │  allternit rails dag list                  # List all DAGs                         │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  WIH (Work Identity Handle) Management:                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails wih list                  # List WIHs (optionally filtered)       │   │
│  │  allternit rails wih pickup <wih_id>       # Pick up work (claims WIH)             │   │
│  │  allternit rails wih context <wih_id>      # Get WIH context pack                  │   │
│  │  allternit rails wih sign <wih_id>         # Sign open WIH                         │   │
│  │  allternit rails wih close <wih_id>        # Close WIH with status                 │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Work Status:                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails work status               # Show DAG/WIH views and loops          │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER B: POLICY, GATE, AND LOOPS                                            │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Gate Operations:                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails gate status               # Gate status                           │   │
│  │  allternit rails gate check                # Check if action is allowed            │   │
│  │  allternit rails gate pre-tool             # Pre-check before tool calls           │   │
│  │  allternit rails gate mutate               # Stamp mutation with provenance        │   │
│  │  allternit rails gate turn-closeout        # Manual closeout (usually auto)        │   │
│  │  allternit rails gate rules                # Get GATE_RULES.md                     │   │
│  │  allternit rails gate verify               # Verify ledger chain and DAGs          │   │
│  │  allternit rails gate decision             # Record agent decision                 │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Lease Management:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails lease request <paths>     # Request lease for paths               │   │
│  │  allternit rails lease grant <lease_id>    # Grant lease (gate operation)          │   │
│  │  allternit rails lease release <lease_id>  # Release lease                         │   │
│  │  allternit rails lease list                # List active leases                    │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Policy Operations:                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails policy inject             # Inject policy bundle (internal)       │   │
│  │  allternit rails policy status             # Current policy status                 │   │
│  │  allternit rails policy bundle             # Show current policy bundle hash       │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER C: LEDGER, BUS, AND TRANSPORTS                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Ledger Operations:                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails ledger tail               # Dump recent events                    │   │
│  │  allternit rails ledger trace <query>      # Trace events by node/wih/prompt       │   │
│  │  allternit rails ledger replay <date>      # Replay events from date               │   │
│  │  allternit rails ledger verify             # Verify ledger integrity               │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Bus Operations:                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails bus send <message>        # Send message to bus                   │   │
│  │  allternit rails bus poll                  # Poll for messages                     │   │
│  │  allternit rails bus deliver <msg_id>      # Mark message as delivered             │   │
│  │  allternit rails bus list                  # List bus messages                     │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Transport Operations:                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  tmux Transport:                                                             │   │
│  │  allternit rails bus tmux-send <pane> <cmd>       # Send command to tmux pane     │   │
│  │  allternit rails bus tmux-runner <pane>           # Run tmux transport listener   │   │
│  │  allternit rails transport tmux-inspect <pane>    # Inspect tmux transport state  │   │
│  │                                                                              │   │
│  │  Socket Transport:                                                           │   │
│  │  allternit rails bus socket-send <socket> <cmd>   # Send command to socket        │   │
│  │  allternit rails bus socket-runner <socket>       # Run socket transport listener │   │
│  │  allternit rails transport socket-inspect <sock>  # Inspect socket transport state│   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Runner Operations:                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails runner start              # Start Rails loop daemon               │   │
│  │  allternit rails runner once               # Run one iteration (foreground)        │   │
│  │  allternit rails runner status             # Runner status                         │   │
│  │  allternit rails runner stop               # Stop runner daemon                    │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Index Operations:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails index rebuild             # Rebuild index from ledger             │   │
│  │  allternit rails index status              # Index status                          │   │
│  │  allternit rails index search <query>      # Search index                          │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER D: VAULT                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Vault Operations:                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails vault archive <wih_id>    # Archive WIH to vault                  │   │
│  │  allternit rails vault status              # Vault job status                      │   │
│  │  allternit rails vault list                # List vault archives                   │   │
│  │  allternit rails vault extract <archive>   # Extract from vault                    │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  Mail Operations:                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails mail thread <participants> # Ensure/create thread                 │   │
│  │  allternit rails mail send <thread> <msg>   # Send message to thread               │   │
│  │  allternit rails mail review <msg_id>       # Request review                       │   │
│  │  allternit rails mail decide <review> <dec> # Approve/reject review                │   │
│  │  allternit rails mail inbox [thread]        # List messages                        │   │
│  │  allternit rails mail ack <msg_id>          # Acknowledge message                  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  System Operations:                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  allternit rails init                      # Initialize workspace stores           │   │
│  │  allternit rails health                    # Health check                          │   │
│  │  allternit rails version                   # Version information                   │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Patterns

### MCP (Model Context Protocol) Integration

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    MCP INTEGRATION                                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  Allternit supports the Model Context Protocol (A2P) for standardizing agent-server        │
│  communication.                                                                      │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    MCP CLIENT IN Allternit                                         │   │
│  │                    Location: crates/mcp-client/                              │   │
│  │                                                                              │   │
│  │  Capabilities:                                                               │   │
│  │  • Server discovery via MCP registry                                         │   │
│  │  • Tool aggregation from multiple servers                                    │   │
│  │  • Capability negotiation                                                    │   │
│  │  • Request routing                                                           │   │
│  │                                                                              │   │
│  │  Flow:                                                                       │   │
│  │  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │   │
│  │  │ Discover │───▶│  Aggregate   │───▶│   Route      │───▶│   Execute    │  │   │
│  │  │ Servers  │    │   Tools      │    │   Request    │    │   Tool       │  │   │
│  │  └──────────┘    └──────────────┘    └──────────────┘    └──────────────┘  │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    Allternit AS MCP SERVER                                         │   │
│  │                                                                              │   │
│  │  Allternit can expose its tools via MCP protocol:                                  │   │
│  │                                                                              │   │
│  │  Tools exposed:                                                              │   │
│  │  • allternit_dag_create       → Create new DAG                                     │   │
│  │  • allternit_wih_pickup       → Pick up work item                                  │   │
│  │  • allternit_wih_close        → Complete work item                                 │   │
│  │  • allternit_lease_request    → Request resource lease                             │   │
│  │  • allternit_ledger_query     → Query event ledger                                 │   │
│  │  • allternit_mail_send        → Send agent message                                 │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Beads Integration

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    BEADS INTEGRATION PATTERN                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  Allternit Agent System Rails reimplements the best concepts from Beads:                   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    CONCEPT MAPPING                                           │   │
│  │                                                                              │   │
│  │  Beads Concept          →  Allternit Rails Equivalent                              │   │
│  │  ──────────────             ───────────────────                              │   │
│  │  Issue                  →  DAG Node                                          │   │
│  │  Issue tracking         →  DAG + WIH system                                  │   │
│  │  Status workflow        →  WIH state machine                                 │   │
│  │  Comments/updates       →  Ledger events                                     │   │
│  │  Assignee               →  WIH assignee                                      │   │
│  │  Git integration        →  Ledger commit hooks                               │   │
│  │                                                                              │   │
│  │  Differences:                                                                │   │
│  │  • Beads: Human-centric, issue-focused                                       │   │
│  │  • Allternit Rails: Agent-centric, execution-focused                               │   │
│  │  • Beads: Web UI for humans                                                  │   │
│  │  • Allternit Rails: CLI + API for agents                                           │   │
│  │  • Beads: Tracks bugs/features                                               │   │
│  │  • Allternit Rails: Tracks agent work execution                                    │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    COEXISTENCE STRATEGY                                      │   │
│  │                                                                              │   │
│  │  .beads/                    ← Human issue tracking                           │   │
│  │  └── issues.jsonl           ← Human-created issues                           │   │
│  │                                                                              │   │
│  │  .allternit/                      ← Agent work tracking                            │   │
│  │  └── ledger/events/         ← Agent work events                              │   │
│  │                                                                              │   │
│  │  Bridge:                                                                     │   │
│  │  • Human creates issue in Beads → Creates DAG in Allternit                         │   │
│  │  • Agent completes work in Allternit  → Updates Beads issue                        │   │
│  │  • Bidirectional sync via hooks                                              │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    TECHNOLOGY STACK                                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    CORE RUNTIME                                              │   │
│  │                                                                              │   │
│  │  Language:              Rust (Edition 2021)                                  │   │
│  │  Async Runtime:         Tokio (v1.0+)                                        │   │
│  │  Web Framework:         Axum (v0.7)                                          │   │
│  │  HTTP Client:           Reqwest (v0.11)                                      │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    DATA & STORAGE                                            │   │
│  │                                                                              │   │
│  │  Database:              SQLite (via SQLx v0.7)                               │   │
│  │  Migrations:            SQLx migrate                                         │   │
│  │  Serialization:         Serde (v1.0) + Serde JSON                            │   │
│  │  Content Hashing:       Blake3 (v1.5)                                        │   │
│  │  Cryptography:          Ed25519-Dalek (v2.0)                                 │   │
│  │  UUID Generation:       Uuid (v1.0)                                          │   │
│  │  Time Handling:         Chrono (v0.4)                                        │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    AI/ML SERVICES                                            │   │
│  │                                                                              │   │
│  │  Voice Service:         Python (FastAPI) + Coqui TTS / Piper                 │   │
│  │  Model Serving:         Local inference (GGUF, MLX)                          │   │
│  │  WASM Runtime:          Wasmtime (v21.0)                                     │   │
│  │  WASI:                  Wasmtime-WASI                                        │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    WEB & UI                                                  │   │
│  │                                                                              │   │
│  │  UI Framework:          TypeScript + React                                   │   │
│  │  Desktop Shell:         Electron                                             │   │
│  │  Build Tool:            Vite                                                 │   │
│  │  Web Components:        Lit (v3.3)                                           │   │
│  │  Styling:               CSS Modules + Design Tokens                          │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    TESTING & QUALITY                                         │   │
│  │                                                                              │   │
│  │  Testing Framework:     Cargo test (built-in)                                │   │
│  │  Integration Tests:     Custom test harness                                  │   │
│  │  Coverage:              Tarpaulin                                            │   │
│  │  Linting:               Clippy + Rustfmt                                     │   │
│  │  Type Safety:           Strict mode, #![deny(warnings)]                      │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    DEPLOYMENT & PACKAGING                                    │   │
│  │                                                                              │   │
│  │  Build System:          Cargo + Make                                         │   │
│  │  Debian Packages:       Cargo-deb                                            │   │
│  │  RPM Packages:          Cargo-generate-rpm                                   │   │
│  │  Docker:                Multi-stage builds                                   │   │
│  │  Universal Binary:      macOS (x86_64 + aarch64)                             │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    OBSERVABILITY                                             │   │
│  │                                                                              │   │
│  │  Logging:               Tracing (v0.1) + Tracing-subscriber                  │   │
│  │  Structured Logs:       JSON format                                          │   │
│  │  Correlation IDs:       Request-scoped tracing                               │   │
│  │  Metrics:               (Future: Prometheus/OpenTelemetry)                   │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
/Users/macbook/Desktop/allternit-workspace/
│
├── 📁 allternit/                          ← MAIN PROJECT
│   │
│   ├── 📁 infrastructure/                     ← Layer 0: Foundation
│   │   ├── 📁 allternit-agent-system-rails/      ← ⭐ CORE RAIL SYSTEM
│   │   │   ├── 📁 src/
│   │   │   │   ├── 📁 bin/
│   │   │   │   │   └── 📄 allternit-rails.rs     ← CLI entry point
│   │   │   │   ├── 📁 gate/
│   │   │   │   │   └── 📄 gate.rs          ← Policy enforcement
│   │   │   │   ├── 📁 ledger/
│   │   │   │   │   └── 📄 store.rs         ← Event storage
│   │   │   │   ├── 📁 bus/
│   │   │   │   │   └── 📄 bus.rs           ← Message queue
│   │   │   │   ├── 📁 wih/
│   │   │   │   │   └── 📄 manager.rs       ← Work identity handles
│   │   │   │   ├── 📁 dag/
│   │   │   │   │   └── 📄 planner.rs       ← DAG planning
│   │   │   │   ├── 📁 vault/
│   │   │   │   │   └── 📄 archiver.rs      ← Archive management
│   │   │   │   └── 📄 lib.rs               ← Library exports
│   │   │   ├── 📁 docs/
│   │   │   │   └── 📁 architecture/
│   │   │   │       ├── 📄 README.md        ← Architecture overview
│   │   │   │       └── 📁 layers/
│   │   │   │           ├── 📁 work/
│   │   │   │           ├── 📁 gate/
│   │   │   │           ├── 📁 runner/
│   │   │   │           ├── 📁 ledger/
│   │   │   │           ├── 📁 bus/
│   │   │   │           └── 📁 vault/
│   │   │   ├── 📁 spec/                    ← Locked invariants
│   │   │   ├── 📁 schemas/                 ← JSON schemas
│   │   │   └── 📄 Cargo.toml
│   │   │
│   │   ├── 📁 allternit-substrate/               ← Core primitives
│   │   ├── 📁 allternit-intent-graph-kernel/     ← Intent graph
│   │   ├── 📁 allternit-presentation-kernel/     ← UI presentation
│   │   ├── 📁 allternit-embodiment/              ← Agent presence
│   │   ├── 📁 protocols/                   ← Communication protocols
│   │   ├── 📁 schemas/                     ← Data schemas
│   │   ├── 📁 sdk/                         ← SDK components
│   │   └── 📁 types/                       ← TypeScript contracts
│   │
│   ├── 📁 domains/kernel/                        ← Layer 1: Execution
│   │   ├── 📁 allternit-kernel/                  ← Kernel implementation
│   │   ├── 📁 capsule-system/              ← Capsule packaging
│   │   ├── 📁 communication/               ← Messaging systems
│   │   ├── 📁 control-plane/               ← Orchestration
│   │   ├── 📁 data/                        ← Memory providers
│   │   ├── 📁 execution/                   ← Compute infrastructure
│   │   └── 📁 infrastructure/              ← Runtime support
│   │
│   ├── 📁 domains/governance/                    ← Layer 2: Policy
│   │   ├── 📁 audit-logging/               ← Audit systems
│   │   ├── 📁 evidence-management/         ← Evidence handling
│   │   ├── 📁 governance-workflows/        ← Approval flows
│   │   ├── 📁 identity-access-control/     ← Auth/AuthZ
│   │   └── 📁 security-quality-assurance/  ← Security
│   │
│   ├── 📁 services/                      ← Layer 3: Bridges
│   │   ├── 📁 bridge-systems/              ← Native/WebVM bridges
│   │   ├── 📁 mcp/                         ← MCP adapter
│   │   └── 📁 rust/                        ← Rust adapters
│   │
│   ├── 📁 services/                      ← Layer 4: Services
│   │   ├── 📁 gateway/                     ← API gateway
│   │   ├── 📁 registry/                    ← Service registry
│   │   ├── 📁 orchestration/               ← Orchestration
│   │   ├── 📁 ml-ai-services/              ← AI services
│   │   └── 📁 memory/                      ← Memory service
│   │
│   ├── 📁 5-agents/                        ← Layer 5: Agents
│   │   └── 📁 (agent implementations)
│   │
│   ├── 📁 surfaces/                            ← Layer 6: UI
│   │   ├── 📁 canvas-monitor/              ← Canvas UI
│   │   └── 📁 (other UI components)
│   │
│   ├── 📁 cmd/                          ← Layer 7: Apps
│   │   ├── 📁 api/                         ← Public API server
│   │   └── 📁 cli/                         ← CLI application
│   │
│   ├── 📁 sessions/                        ← Session storage
│   ├── 📁 docs/                            ← Documentation
│   ├── 📁 crates/                          ← Shared Rust crates
│   ├── 📄 Cargo.toml                       ← Workspace manifest
│   └── 📄 ARCHITECTURE.md                  ← Architecture docs
│
├── 📁 surfaces/allternit-platform/                   ← Web UI platform
│   ├── 📁 src/
│   │   ├── 📁 components/                  ← Shared UI components
│   │   ├── 📁 shell/                       ← Main application shell
│   │   └── 📁 views/
│   │       ├── 📁 chat/                    ← Chat interface
│   │       └── 📁 openclaw/                ← OpenClaw integration
│   └── 📄 package.json
│
├── 📁 cmd/allternit/                          ← CLI binary
│   ├── 📁 src/
│   └── 📄 Cargo.toml
│
└── 📁 packages/allternit-platform/               ← SDK packages
    └── 📁 src/

Legend:
📁 = Directory
📄 = File
⭐ = Core/Important component
← = Description/Comment
```

---

## Quick Start Guide

### Installation

```bash
# Clone the repository
git clone https://github.com/allternit/allternit.git
cd allternit-workspace/allternit

# Build the project
make build

# Or build with cargo
cargo build --release

# Install CLI
cargo install --path cmd/cli

# Or install Debian package
cargo deb
sudo dpkg -i target/debian/allternit_*.deb
```

### Starting the System

```bash
# Start all services
make dev

# Or start individual services
./target/release/allternit kernel &
./target/release/allternit rails &
./target/release/allternit api &

# Initialize Rails workspace
allternit rails init

# Start the Rails runner
allternit rails runner start
```

### Creating and Executing Work

```bash
# Create a new plan
allternit rails plan create "Implement user authentication system"
# Returns: dag_id = "dag_abc123"

# Check work status
allternit rails work status

# Pick up a work item
allternit rails wih pickup dag_abc123/node_1/wih_001

# Execute work (through tools, which call gate pre-checks)
# ... agent executes work ...

# Close the work item
allternit rails wih close dag_abc123/node_1/wih_001 \
  --status completed \
  --evidence "auth/implemented" \
  --artifacts "auth/schema.sql,auth/backend.rs"

# View ledger
allternit rails ledger tail --limit 50

# Verify system integrity
allternit rails gate verify
```

---

## Conclusion

The **Allternit Agent Rails Systems** represents a fundamental advancement in AI agent infrastructure. By combining:

- **Deterministic execution rails** through DAG/WIH abstractions
- **Immutable audit trails** via append-only ledgers
- **Policy-first security** through Gate enforcement
- **Multi-modal coordination** via Bus and Transports
- **Enterprise-grade governance** through provenance tracking

Allternit provides a production-ready platform for deploying autonomous agents at scale.

### Key Takeaways

1. **Rails, Not Scripts**: Allternit provides structured execution paths (rails) rather than loose scripts
2. **Identity for Everything**: Every unit of work has a persistent, trackable identity (WIH)
3. **Trust Through Verification**: Every action is logged, signed, and verifiable
4. **Policy as Code**: Security policies are enforced automatically at every boundary
5. **Agents as First-Class Citizens**: The system is designed for autonomous agents, not human users

### Next Steps

- Review the architecture documentation in `allternit/ARCHITECTURE.md`
- Explore the API documentation at `docs/api/`
- Run the test suite: `cargo test`
- Join the community: [Discord/Forum links]

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| **Allternit** | allternit Runtime - The agentic operating system |
| **DAG** | Directed Acyclic Graph - A graph of tasks with dependencies |
| **WIH** | Work Identity Handle - A trackable identity for a unit of work |
| **Gate** | Policy enforcement checkpoint for actions |
| **Ledger** | Append-only log of events |
| **Rails** | Structured execution paths for agents |
| **Vault** | Archive storage for completed work |
| **Bus** | Durable message queue for agent coordination |
| **Lease** | Atomic reservation for a resource |
| **Substrate** | Foundation layer of the architecture |
| **Kernel** | Execution engine layer |
| **Capsule** | Sandboxed execution package |
| **MCP** | Model Context Protocol |
| **A2P** | Allternit Protocol (MCP variant) |

---

*Document generated: 2026-02-17*  
*System version: 0.1.0*  
*Architecture version: 2026-02-06*

---
