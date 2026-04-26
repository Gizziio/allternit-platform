# Allternit Reality Spec: Memory & Context (Ars Contexta)

**Location:** `services/memory/`  
**Status:** ACTIVE / OPERATIONAL  
**Date:** April 14, 2026

## 1. Role
The Memory system, known as **Ars Contexta**, is the cognitive state engine of Allternit. It manages how agents remember past interactions, consolidate knowledge, and decay irrelevant information to maintain a clean reasoning context.

## 2. The Ars Contexta Pipeline
Implementation: `services/memory/data/ars-contexta/`
- **Ingestion:** Captures raw events and tool receipts.
- **NLP Layer:** Extracts entities, sentiments, and claims using a Rust-based bridge for performance.
- **Knowledge Graph:** Maps relationships between entities using a Claims Graph.
- **Vector Store:** Provides semantic search capabilities for long-horizon retrieval.

## 3. Memory Agent & Daemon
A dedicated **Memory Agent** (`services/memory/agent/`) runs as a background daemon. It performs:
- **Daily Consolidation:** Summarizes daily sessions into long-term memories.
- **Memory Decay:** Periodically reduces the "strength" of old memories to prevent context pollution.
- **Work-In-Hand (WIH) Indexing:** Links memories directly to the active tasks they were generated from.

## 4. Truth Engine (V2)
The `services/memory/state/memory/` implementation includes a **Truth Engine** that uses a Context Tree and Conflict Resolution logic to manage competing "facts" discovered by different agents.

## 5. Current Gaps vs Target
- **Precision Hydration:** While context is hydrated, the "Meta-Evolution" mentioned in the target spec (where memory structures evolve over time based on agent performance) is in its early stages as the Truth Engine V2.
- **Unified Fabric:** The system is composed of several specialized services (Ars Contexta, History Ledger, Memory Agent) that are coordinated through the SDK but could be more tightly integrated at the kernel level.
