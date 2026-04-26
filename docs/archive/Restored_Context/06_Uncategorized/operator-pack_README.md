# Operator Pack v001 — Complete

This pack establishes the **Operator Control Surface** for the Allternit Sovereign OS. It defines how the system is monitored, debugged, and controlled by a human or agent operator.

## Core Hierarchy
1. **Brain Daemon (a2d)**: The source of truth. Manages Kernel services, Tool registry, and the Journal Ledger.
2. **CLI (a2)**: Non-interactive deterministic control. Used for automation, scripting, and targeted OS commands.
3. **TUI (Cockpit)**: Interactive operator interface. High-density observability and real-time intervention.
4. **Unified UI**: The primary user experience.

## Zero Drift Principle
All interfaces (CLI, TUI, Web UI) MUST use the same **Brain Daemon API** and render from the same **CapsuleSpec**. No interface may maintain local state that contradicts the Journal.

## Contents
- `docs/`: In-depth specifications for CLI, TUI, and A2UI mapping.
- `api/`: Canonical OpenAPI definition.
- `schemas/`: JSON Schemas for CapsuleSpec and A2UI.
- `acceptance/`: Non-negotiable test suite for system correctness.
