# Learning: Building an Agentic OS Foundation
**Date**: Jan 10, 2026
**Provenance**: Session 001 (Unified UI Implementation)

## 1. Architecture as Code
We learned that the **Architecture Corpus (69 items)** is the "Source of Truth" for the agent. When the agent ignores the corpus, the system drifts into generic "chat" behavior. When the agent treats the corpus as a specification to be compiled, the code becomes robust.

## 2. Declarative UI Primitives
We successfully implemented the **Ragic-class UI**. By treating screens as **ViewSpecs** (JSON) rather than hardcoded components, the OS can scale to any domain without new frontend code. The **ViewRegistry** is the bottleneck through which all system state must be projected.

## 3. The Dispatch-Reason-Act Loop
The dispatch loop must be **Governed**.
- **Reason**: Directive Compiler & Context Manager (DCD).
- **Act**: Tool Executors with Sandbox Policies.
- **Verify**: Journaling with Causal Linking.

## 4. Compounding Memory (The Vault)
Memory must be **File-Persistent**. Moving the Intent Graph to disk ensures that every session builds on the last. The "Capture" mechanism allows for human-in-the-loop promotion of transient data into permanent knowledge.

## 🛠 Key Constraint: Absolute Paths
On macOS (Darwin), use absolute paths for all service cross-talk and file-system operations to avoid working directory drift between sub-agents.
