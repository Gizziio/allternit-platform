# UI Vision Document

## Overview
The A2R Cockpit is a comprehensive operational interface for managing, monitoring, and auditing A2R systems. It provides real-time visibility into all system components and enables operators to manage runs, inspect DAGs, review receipts, and perform forensics operations.

## Layout
The interface follows a modern workspace paradigm with:
- Left navigation panel (collapsible)
- Main content area with tabbed views
- Right inspector panel (context-sensitive)
- Bottom status bar with system indicators

## Core Flows
1. **Run Management Flow**: Create/select runs → Monitor execution → Inspect node details → View receipts
2. **DAG Visualization Flow**: Select graph → Visualize execution flow → Drill-down into nodes → Trace dependencies
3. **Forensics Flow**: Select run → Export forensics → Replay execution → Analyze provenance timeline
4. **Receipt Inspection Flow**: Filter receipts → Examine details → Trace causality → Verify integrity

## Constraints
- All UI actions must go through gateway routes defined in ui/ui_registry.json
- UI cannot directly access tools or write outside run-scoped paths
- All UI actions must emit UIReceipts under /.a2r/receipts/<run_id>/
- UI must honor memory promotion gates and state