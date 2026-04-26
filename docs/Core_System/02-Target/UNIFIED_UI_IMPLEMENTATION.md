# Unified UI Implementation Specification

> **Status:** Tier-0 UI Law
> **Version:** v0.1
> **Last Updated:** January 2025
> **Purpose:** Complete implementation guide for building a Disco GenTabs-like system with A2UI

This document supersedes all previous ad-hoc shell UI decisions, canvas logic, and DOM switching experiments.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Reference Technologies](#2-reference-technologies)
3. [Architecture Overview](#3-architecture-overview)
4. [CapsuleSpec Schema](#4-capsulespec-schema-v01)
5. [CapsuleSpec Examples](#5-capsulespec-examples)
6. [Component Catalog](#6-component-catalog-v01)
7. [Compiler Pipeline](#7-compiler-pipeline)
8. [Physics & Interaction Contracts](#8-physics--interaction-contracts)
9. [Implementation Plan](#9-implementation-plan)
10. [Build Order](#10-build-order-pr-friendly)

---

## 1. Executive Summary

### The Problem (Why Previous UI Broke)

Previous attempts failed because they used **agent-authored imperative UI**:
- Agents don't manage lifecycle well
- JS errors = blank screens
- Event listeners die
- State forks unpredictably
- Canvas = imperative, Tabs = UI state not system state

### The Solution

**A2UI-aligned architecture:**

```
Agent → Declarative UI Spec → Deterministic Renderer
```

Key shift:
- **Capsule == A2UI Surface instance**
- **Canvas == declarative surface tree**
- **Tabs are just one possible renderer affordance**
- **Agent outputs JSON, never UI code**

### Core Principle

> Agents generate UI specs, clients render them declaratively.

This resolves all previous blockers by construction.

---

## 2. Reference Technologies

### Google Disco & GenTabs

**What it is:** Experimental Chromium-based browser from Google Labs (December 2025) with GenTabs - AI-generated interactive applications from open browser tabs.

**Sources:**
- https://blog.google/technology/google-labs/gentabs-gemini-3/
- https://techcrunch.com/2025/12/11/google-debuts-disco-a-gemini-powered-tool-for-making-web-apps-from-browser-tabs/
- https://9to5google.com/2025/12/11/google-disco-gentab-browser/

**Core Capabilities:**
- Analyzes all open browser tabs simultaneously
- Uses chat history to understand user context and intent
- Generates temporary single-page applications on-the-fly
- Creates structured interfaces: timelines, planners, maps, comparisons, simulations
- All generated elements link back to original sources (attribution)
- No code required - natural language interface
- Powered by Gemini 3

**Technical Characteristics:**
- Built on Chromium
- Split interface: chat/omnibox on one side, web content on the other
- GenTabs are NOT hosted web pages - they are temporary SPAs generated dynamically
- Implements "assembly and transformation" model vs passive page consumption

### A2UI (Agent-to-User Interface)

**What it is:** Google's open-source (Apache 2.0) declarative UI protocol for agent-driven interfaces.

**Sources:**
- https://a2ui.org/
- https://github.com/google/A2UI
- https://a2ui.org/introduction/what-is-a2ui/

**Status:** v0.8 (Public Preview), 9.6k+ GitHub stars

**Core Architecture (Three Layers):**
1. **UI Structure** - Components and layout
2. **Application State** - Data model with bindings
3. **Client Rendering** - Platform-specific native widgets

**Four-Stage Process:**
1. **Generation**: LLM creates A2UI Response (JSON payload)
2. **Transport**: Payload travels via A2A Protocol, AG UI, SSE, or WebSockets
3. **Resolution**: Client's A2UI Renderer parses JSON structure
4. **Rendering**: Abstract components map to native implementations

**Design Principles:**
- **Security-First**: Declarative data, NOT executable code
- **LLM-Optimized**: Flat component lists with ID references for streaming
- **Framework-Agnostic**: Same JSON renders on React, Angular, Lit, Flutter, SwiftUI

---

## 3. Architecture Overview

### Mental Model Mapping

**Old Model (where friction came from):**
```
Intent → Kernel → Capsule → Canvas → DOM/JS
```
This breaks because Canvas = imperative, Tabs = UI state.

**New Model (A2UI-aligned):**
```
Intent → Kernel → Framework (intent → UI pattern) → A2UI Surface(s) → A2UI Renderer → Platform-native UI
```

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED UI SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                                                   │
│  │  CONTEXT LAYER   │                                                   │
│  ├──────────────────┤                                                   │
│  │ - URL Scraper    │  Collects content from multiple sources           │
│  │ - File Parser    │  Normalizes into structured format                │
│  │ - API Connector  │  Tracks source attribution                        │
│  │ - Chat History   │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │ ORCHESTRATION    │                                                   │
│  ├──────────────────┤                                                   │
│  │ - Intent Detect  │  Analyzes context + user request                  │
│  │ - Task Classify  │  Determines UI pattern needed                     │
│  │ - LLM Interface  │  Generates A2UI JSON payloads                     │
│  │ - Prompt Engine  │  (Claude API or Gemini API)                       │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │ A2UI PROTOCOL    │                                                   │
│  ├──────────────────┤                                                   │
│  │ - JSON Payloads  │  Declarative component descriptions               │
│  │ - Data Bindings  │  State management                                 │
│  │ - Streaming      │  Progressive/incremental updates                  │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │ RENDERING LAYER  │                                                   │
│  ├──────────────────┤                                                   │
│  │ - A2UI Renderer  │  Maps abstract components to native widgets       │
│  │ - Component Cat. │  Trusted catalog of available components          │
│  │ - Action Handler │  Processes user interactions                      │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input (natural language)
        │
        ▼
┌───────────────────┐
│ Context Collector │ ◄── URLs, Files, APIs, Chat History
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Content Normalizer│ ──► Structured data with source attribution
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Intent Classifier │ ──► Task type: comparison, planning, research, viz
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   LLM Processor   │ ──► Prompt + Context ──► CapsuleSpec JSON
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  A2UI Renderer    │ ──► Interactive UI with source links
└───────────────────┘
          │
          ▼
User interacts ──► Actions sent back to Kernel for refinement
```

### Where Serverless Browsers Fit

Serverless browser = `ToolKind: browser` (tool runtime, NOT UI)

```
Serverless Browser → Output: evidence artifacts
                  → Artifacts → Journal
                  → Journal → DataModel
                  → DataModel → A2UI Surface
```

The browser never touches UI directly. It feeds facts into the system.

---

## 4. CapsuleSpec Schema (v0.1)

The "mini-app" contract: agent produces this, client renders it.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://allternit.dev/schema/capsuleSpec.v0.1.json",
  "title": "CapsuleSpec v0.1",
  "type": "object",
  "required": ["id", "goal", "evidence", "ui", "actions", "update_rules", "provenance"],
  "properties": {
    "id": { "type": "string", "description": "Stable capsule instance id (uuid/ulid)" },
    "capsule_type": { "type": "string", "description": "Framework/template id (e.g., fwk.search, fwk.diff_review)" },
    "goal": {
      "type": "object",
      "required": ["text"],
      "properties": {
        "text": { "type": "string" },
        "tokens": {
          "type": "array",
          "items": { "$ref": "#/$defs/intentToken" },
          "description": "Optional tokenization output for interactive goal editing"
        }
      }
    },
    "evidence": {
      "type": "array",
      "minItems": 0,
      "items": { "$ref": "#/$defs/evidenceObject" }
    },
    "ui": {
      "type": "object",
      "required": ["a2ui_payload"],
      "properties": {
        "a2ui_payload": {
          "type": "object",
          "description": "A2UI JSON (surfaces + dataModel). Client whitelists components.",
          "additionalProperties": true
        },
        "surface_policy": { "$ref": "#/$defs/surfacePolicy" }
      }
    },
    "actions": {
      "type": "array",
      "items": { "$ref": "#/$defs/actionSpec" },
      "description": "Declarative actions. Execution routes through Tool Gateway policies."
    },
    "bindings": {
      "type": "array",
      "items": { "$ref": "#/$defs/bindingSpec" },
      "description": "Data bindings: evidence → data model, journal → UI, user inputs → action inputs."
    },
    "update_rules": {
      "type": "array",
      "items": { "$ref": "#/$defs/updateRule" },
      "description": "How the capsule changes when evidence/goal/journal changes."
    },
    "interaction": { "$ref": "#/$defs/interactionSpec" },
    "provenance": {
      "type": "object",
      "required": ["run_id", "created_at_ms", "source_links"],
      "properties": {
        "run_id": { "type": "string", "description": "Journal run_id anchoring the capsule" },
        "created_at_ms": { "type": "integer" },
        "source_links": {
          "type": "array",
          "items": { "$ref": "#/$defs/sourceLink" },
          "description": "Explicit links back to evidence sources (attribution requirement)."
        }
      }
    }
  },
  "$defs": {
    "evidenceObject": {
      "type": "object",
      "required": ["evidence_id", "kind", "title"],
      "properties": {
        "evidence_id": { "type": "string" },
        "kind": {
          "type": "string",
          "enum": ["url", "doc", "pdf", "note", "repo", "diff", "test_run", "log", "artifact", "dataset"]
        },
        "title": { "type": "string" },
        "uri": { "type": "string", "description": "Original location (url://, file://, repo://, etc.)" },
        "snapshot_ref": { "type": "string", "description": "Immutable snapshot pointer (hash, content-addressed id)" },
        "extracted_schema": { "type": "object", "additionalProperties": true },
        "metadata": { "type": "object", "additionalProperties": true }
      }
    },
    "actionSpec": {
      "type": "object",
      "required": ["action_id", "label", "safety_tier", "tool_ref", "input_schema"],
      "properties": {
        "action_id": { "type": "string" },
        "label": { "type": "string" },
        "safety_tier": { "type": "string", "enum": ["read", "write", "exec", "danger"] },
        "tool_ref": { "type": "string", "description": "Tool registry id; executed via policy-gated Tool Gateway" },
        "input_schema": { "type": "object", "additionalProperties": true },
        "ui_affordance": { "type": "string", "enum": ["button", "menu", "form_submit", "drag_drop"] }
      }
    },
    "bindingSpec": {
      "type": "object",
      "required": ["from", "to"],
      "properties": {
        "from": { "type": "string", "description": "e.g., evidence[evidence_id].extracted_schema.field" },
        "to": { "type": "string", "description": "e.g., dataModel.path" },
        "transform": { "type": "string", "description": "Optional transform id implemented client-side" }
      }
    },
    "updateRule": {
      "type": "object",
      "required": ["when", "then"],
      "properties": {
        "when": {
          "type": "object",
          "required": ["event"],
          "properties": {
            "event": {
              "type": "string",
              "enum": ["evidence_added", "evidence_removed", "goal_changed", "journal_event", "user_action"]
            },
            "filter": { "type": "object", "additionalProperties": true }
          }
        },
        "then": {
          "type": "object",
          "required": ["strategy"],
          "properties": {
            "strategy": { "type": "string", "enum": ["recompile_full", "recompile_partial", "patch_ui", "patch_dataModel"] },
            "diff_mode": { "type": "string", "enum": ["stable_ids", "position_aware", "content_hash"] }
          }
        }
      }
    },
    "interactionSpec": {
      "type": "object",
      "properties": {
        "physics_profile": { "type": "string", "enum": ["structured_light", "structured_strong", "freeform_light"] },
        "token_semantics": { "$ref": "#/$defs/tokenSemantics" },
        "motion_semantics": { "$ref": "#/$defs/motionSemantics" }
      }
    },
    "intentToken": {
      "type": "object",
      "required": ["kind", "value"],
      "properties": {
        "kind": { "type": "string", "enum": ["intent", "entity", "constraint", "risk", "confidence"] },
        "value": { "type": "string" },
        "weight": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "tokenSemantics": {
      "type": "object",
      "properties": {
        "drag_to_refine": { "type": "boolean" },
        "snap_zones": { "type": "array", "items": { "type": "string" } }
      }
    },
    "motionSemantics": {
      "type": "object",
      "properties": {
        "risk_heat": { "type": "boolean" },
        "confidence_fog": { "type": "boolean" },
        "constraint_gravity": { "type": "boolean" }
      }
    },
    "surfacePolicy": {
      "type": "object",
      "properties": {
        "component_whitelist": { "type": "array", "items": { "type": "string" } },
        "no_code_execution": { "type": "boolean", "const": true }
      }
    },
    "sourceLink": {
      "type": "object",
      "required": ["evidence_id", "uri"],
      "properties": {
        "evidence_id": { "type": "string" },
        "uri": { "type": "string" },
        "anchor": { "type": "string", "description": "Optional fragment pointer (line range, selector, page)" }
      }
    }
  }
}
```

---

## 5. CapsuleSpec Examples

### Example A: Trip Planner (GenTabs-like)

```json
{
  "id": "cap_01JH0TRIPPLANNER",
  "capsule_type": "fwk.trip_plan",
  "goal": {
    "text": "Plan a weekend trip to Chicago focused on vegan food and museums",
    "tokens": [
      { "kind": "intent", "value": "plan", "weight": 0.9 },
      { "kind": "entity", "value": "Chicago", "weight": 0.9 },
      { "kind": "constraint", "value": "vegan food", "weight": 0.8 },
      { "kind": "constraint", "value": "museums", "weight": 0.7 }
    ]
  },
  "evidence": [
    {
      "evidence_id": "ev_vegan_list_1",
      "kind": "url",
      "title": "Vegan restaurants list",
      "uri": "url://example.com/vegan-chicago",
      "snapshot_ref": "snap_sha256:aaa111",
      "extracted_schema": {
        "restaurants": [
          { "name": "Place A", "neighborhood": "Loop", "price": "$", "notes": "popular" },
          { "name": "Place B", "neighborhood": "Wicker Park", "price": "$", "notes": "casual" }
        ]
      },
      "metadata": { "captured_at_ms": 1768000000000 }
    },
    {
      "evidence_id": "ev_museum_hours_1",
      "kind": "url",
      "title": "Museum hours and tickets",
      "uri": "url://example.com/museums-chicago",
      "snapshot_ref": "snap_sha256:bbb222",
      "extracted_schema": {
        "museums": [
          { "name": "Art Institute", "open": "10:30", "close": "17:00", "ticket": 32 },
          { "name": "Field Museum", "open": "09:00", "close": "17:00", "ticket": 30 }
        ]
      }
    }
  ],
  "ui": {
    "surface_policy": {
      "component_whitelist": ["Container", "Card", "Text", "DataTable", "List", "Button", "TextField", "Tabs", "Badge"],
      "no_code_execution": true
    },
    "a2ui_payload": {
      "schemaVersion": "a2ui.v0.1",
      "dataModel": {
        "capsule": { "title": "Weekend Trip Plan", "subtitle": "Chicago - Vegan + Museums" },
        "itinerary": {
          "days": [
            { "day": "Saturday", "items": [] },
            { "day": "Sunday", "items": [] }
          ]
        },
        "restaurants": {
          "items": [
            { "name": "Place A", "neighborhood": "Loop", "price": "$", "evidence_id": "ev_vegan_list_1" }
          ]
        },
        "museums": {
          "items": [
            { "name": "Art Institute", "open": "10:30", "close": "17:00", "ticket": 32, "evidence_id": "ev_museum_hours_1" }
          ]
        }
      },
      "surfaces": [
        {
          "surfaceId": "surface:trip:root",
          "title": "Trip Planner",
          "root": {
            "type": "Container",
            "id": "ui:trip:container",
            "props": { "layout": "column", "gap": "md" },
            "children": [
              {
                "type": "Card",
                "id": "ui:trip:header",
                "props": { "variant": "hero" },
                "children": [
                  { "type": "Text", "id": "ui:trip:title", "props": { "textPath": "capsule.title", "style": "h1" } },
                  { "type": "Text", "id": "ui:trip:subtitle", "props": { "textPath": "capsule.subtitle", "style": "subtle" } }
                ]
              },
              {
                "type": "Tabs",
                "id": "ui:trip:tabs",
                "props": {
                  "tabs": [
                    { "id": "tab:itinerary", "label": "Itinerary" },
                    { "id": "tab:restaurants", "label": "Vegan Food" },
                    { "id": "tab:museums", "label": "Museums" }
                  ],
                  "activeTabPath": "uiState.activeTab"
                }
              },
              {
                "type": "Container",
                "id": "ui:trip:tabBody",
                "props": { "layout": "stack" },
                "children": [
                  {
                    "type": "Card",
                    "id": "ui:trip:itineraryCard",
                    "props": {
                      "visibleWhen": { "path": "uiState.activeTab", "eq": "tab:itinerary" },
                      "title": "Draft Itinerary"
                    },
                    "children": [
                      { "type": "List", "id": "ui:trip:itineraryList", "props": { "itemsPath": "itinerary.days", "itemTitlePath": "day" } },
                      { "type": "Button", "id": "ui:trip:genItin", "props": { "label": "Generate itinerary from evidence", "actionId": "act_trip_generate" } }
                    ]
                  },
                  {
                    "type": "Card",
                    "id": "ui:trip:restaurantsCard",
                    "props": {
                      "visibleWhen": { "path": "uiState.activeTab", "eq": "tab:restaurants" },
                      "title": "Vegan Places"
                    },
                    "children": [
                      {
                        "type": "DataTable",
                        "id": "ui:trip:restaurantsTable",
                        "props": {
                          "rowsPath": "restaurants.items",
                          "columns": [
                            { "key": "name", "label": "Name" },
                            { "key": "neighborhood", "label": "Area" },
                            { "key": "price", "label": "Price" }
                          ]
                        }
                      }
                    ]
                  },
                  {
                    "type": "Card",
                    "id": "ui:trip:museumsCard",
                    "props": {
                      "visibleWhen": { "path": "uiState.activeTab", "eq": "tab:museums" },
                      "title": "Museums"
                    },
                    "children": [
                      {
                        "type": "DataTable",
                        "id": "ui:trip:museumsTable",
                        "props": {
                          "rowsPath": "museums.items",
                          "columns": [
                            { "key": "name", "label": "Museum" },
                            { "key": "open", "label": "Open" },
                            { "key": "close", "label": "Close" },
                            { "key": "ticket", "label": "Ticket" }
                          ]
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      ],
      "uiState": { "activeTab": "tab:itinerary" }
    }
  },
  "actions": [
    {
      "action_id": "act_trip_generate",
      "label": "Generate itinerary",
      "safety_tier": "read",
      "tool_ref": "tool.compiler.trip_itinerary_from_evidence",
      "input_schema": {
        "type": "object",
        "required": ["goal", "evidence_ids"],
        "properties": {
          "goal": { "type": "string" },
          "evidence_ids": { "type": "array", "items": { "type": "string" } }
        }
      },
      "ui_affordance": "button"
    }
  ],
  "bindings": [
    { "from": "goal.text", "to": "compiler.goal" },
    { "from": "evidence[].evidence_id", "to": "compiler.evidence_ids" }
  ],
  "update_rules": [
    { "when": { "event": "evidence_added" }, "then": { "strategy": "recompile_partial", "diff_mode": "stable_ids" } },
    { "when": { "event": "goal_changed" }, "then": { "strategy": "recompile_partial", "diff_mode": "stable_ids" } }
  ],
  "interaction": {
    "physics_profile": "structured_light",
    "token_semantics": { "drag_to_refine": true, "snap_zones": ["zone:intent", "zone:entities", "zone:constraints"] },
    "motion_semantics": { "risk_heat": true, "confidence_fog": true, "constraint_gravity": true }
  },
  "provenance": {
    "run_id": "run_trip_01JH0T",
    "created_at_ms": 1768000000123,
    "source_links": [
      { "evidence_id": "ev_vegan_list_1", "uri": "url://example.com/vegan-chicago" },
      { "evidence_id": "ev_museum_hours_1", "uri": "url://example.com/museums-chicago" }
    ]
  }
}
```

### Example B: Repo Diff Review Capsule

```json
{
  "id": "cap_01JH0TDIFFREVIEW",
  "capsule_type": "fwk.diff_review",
  "goal": { "text": "Review the diff and identify breaking changes, missing tests, and risky areas" },
  "evidence": [
    {
      "evidence_id": "ev_pr_diff_1",
      "kind": "diff",
      "title": "PR diff",
      "uri": "repo://allternit/pull/123",
      "snapshot_ref": "snap_sha256:ddd444",
      "extracted_schema": {
        "files_changed": 7,
        "summary": [
          { "path": "apps/shell/src/app.ts", "change": "modified", "loc": 120 },
          { "path": "services/kernel/src/main.rs", "change": "modified", "loc": 55 }
        ],
        "risk_signals": ["contracts touched", "ui entrypoint touched"]
      }
    },
    {
      "evidence_id": "ev_test_run_1",
      "kind": "test_run",
      "title": "CI test run",
      "uri": "artifact://ci/run/456",
      "snapshot_ref": "snap_sha256:eee555",
      "extracted_schema": {
        "status": "failed",
        "failed_tests": ["ui_smoke.spec.ts"],
        "logs_ref": "artifact://ci/logs/456"
      }
    }
  ],
  "ui": {
    "surface_policy": {
      "component_whitelist": ["Container", "Card", "Text", "DataTable", "List", "Button", "Badge", "Accordion"],
      "no_code_execution": true
    },
    "a2ui_payload": {
      "schemaVersion": "a2ui.v0.1",
      "dataModel": {
        "capsule": { "title": "Diff Review", "subtitle": "PR #123" },
        "diff": {
          "files": [
            { "path": "apps/shell/src/app.ts", "loc": 120, "evidence_id": "ev_pr_diff_1" }
          ]
        },
        "risks": {
          "items": [
            { "risk": "UI entrypoint touched", "tier": "high", "evidence_id": "ev_pr_diff_1" },
            { "risk": "CI failed: ui_smoke", "tier": "high", "evidence_id": "ev_test_run_1" }
          ]
        },
        "recommendations": { "items": [] }
      },
      "surfaces": [
        {
          "surfaceId": "surface:diff:root",
          "title": "Diff Review",
          "root": {
            "type": "Container",
            "id": "ui:diff:container",
            "props": { "layout": "column", "gap": "md" },
            "children": [
              {
                "type": "Card",
                "id": "ui:diff:header",
                "props": { "variant": "hero" },
                "children": [
                  { "type": "Text", "id": "ui:diff:title", "props": { "textPath": "capsule.title", "style": "h1" } },
                  { "type": "Text", "id": "ui:diff:subtitle", "props": { "textPath": "capsule.subtitle", "style": "subtle" } }
                ]
              },
              {
                "type": "Card",
                "id": "ui:diff:files",
                "props": { "title": "Files Changed" },
                "children": [
                  {
                    "type": "DataTable",
                    "id": "ui:diff:filesTable",
                    "props": {
                      "rowsPath": "diff.files",
                      "columns": [
                        { "key": "path", "label": "File" },
                        { "key": "loc", "label": "LOC" }
                      ]
                    }
                  }
                ]
              },
              {
                "type": "Card",
                "id": "ui:diff:risks",
                "props": { "title": "Risk Signals" },
                "children": [
                  {
                    "type": "List",
                    "id": "ui:diff:riskList",
                    "props": { "itemsPath": "risks.items", "itemTitlePath": "risk", "itemMetaPath": "tier" }
                  },
                  {
                    "type": "Button",
                    "id": "ui:diff:proposeFixes",
                    "props": { "label": "Generate fix checklist", "actionId": "act_diff_fixcheck" }
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  },
  "actions": [
    {
      "action_id": "act_diff_fixcheck",
      "label": "Generate fix checklist",
      "safety_tier": "read",
      "tool_ref": "tool.compiler.diff_fixcheck",
      "input_schema": {
        "type": "object",
        "required": ["diff_evidence_id", "test_evidence_id"],
        "properties": {
          "diff_evidence_id": { "type": "string" },
          "test_evidence_id": { "type": "string" }
        }
      },
      "ui_affordance": "button"
    }
  ],
  "bindings": [
    { "from": "evidence[ev_pr_diff_1].extracted_schema", "to": "compiler.diff" },
    { "from": "evidence[ev_test_run_1].extracted_schema", "to": "compiler.tests" }
  ],
  "update_rules": [
    { "when": { "event": "evidence_added", "filter": { "kind": "diff" } }, "then": { "strategy": "recompile_partial", "diff_mode": "stable_ids" } },
    { "when": { "event": "journal_event" }, "then": { "strategy": "patch_dataModel", "diff_mode": "stable_ids" } }
  ],
  "interaction": { "physics_profile": "structured_light" },
  "provenance": {
    "run_id": "run_diff_01JH0T",
    "created_at_ms": 1768000000456,
    "source_links": [
      { "evidence_id": "ev_pr_diff_1", "uri": "repo://allternit/pull/123" },
      { "evidence_id": "ev_test_run_1", "uri": "artifact://ci/run/456" }
    ]
  }
}
```

### Example C: Research Synthesis Capsule

```json
{
  "id": "cap_01JH0TRESEARCH",
  "capsule_type": "fwk.research_synthesis",
  "goal": { "text": "Synthesize the evidence into a short brief + action plan with citations" },
  "evidence": [
    {
      "evidence_id": "ev_paper_1",
      "kind": "pdf",
      "title": "Paper A",
      "uri": "file://paper-a.pdf",
      "snapshot_ref": "snap_sha256:111aaa",
      "extracted_schema": { "key_points": ["KP1", "KP2"] }
    },
    {
      "evidence_id": "ev_blog_1",
      "kind": "url",
      "title": "Blog B",
      "uri": "url://example.com/blog-b",
      "snapshot_ref": "snap_sha256:222bbb",
      "extracted_schema": { "claims": ["C1", "C2"] }
    }
  ],
  "ui": {
    "surface_policy": {
      "component_whitelist": ["Container", "Card", "Text", "List", "DataTable", "Button", "TextField", "Badge"],
      "no_code_execution": true
    },
    "a2ui_payload": {
      "schemaVersion": "a2ui.v0.1",
      "dataModel": {
        "capsule": { "title": "Research Synthesis" },
        "brief": { "sections": [{ "heading": "Summary", "text": "", "citations": [] }] },
        "actions": { "items": [] },
        "citations": {
          "items": [
            { "label": "Paper A", "evidence_id": "ev_paper_1" },
            { "label": "Blog B", "evidence_id": "ev_blog_1" }
          ]
        }
      },
      "surfaces": [
        {
          "surfaceId": "surface:research:root",
          "title": "Synthesis",
          "root": {
            "type": "Container",
            "id": "ui:research:container",
            "props": { "layout": "column", "gap": "md" },
            "children": [
              {
                "type": "Card",
                "id": "ui:research:header",
                "props": { "variant": "hero" },
                "children": [
                  { "type": "Text", "id": "ui:research:title", "props": { "textPath": "capsule.title", "style": "h1" } }
                ]
              },
              {
                "type": "Card",
                "id": "ui:research:brief",
                "props": { "title": "Brief" },
                "children": [
                  { "type": "List", "id": "ui:research:briefSections", "props": { "itemsPath": "brief.sections", "itemTitlePath": "heading" } },
                  { "type": "Button", "id": "ui:research:generate", "props": { "label": "Generate brief from evidence", "actionId": "act_research_generate" } }
                ]
              },
              {
                "type": "Card",
                "id": "ui:research:cites",
                "props": { "title": "Citations" },
                "children": [
                  { "type": "List", "id": "ui:research:citeList", "props": { "itemsPath": "citations.items", "itemTitlePath": "label" } }
                ]
              }
            ]
          }
        }
      ]
    }
  },
  "actions": [
    {
      "action_id": "act_research_generate",
      "label": "Generate brief",
      "safety_tier": "read",
      "tool_ref": "tool.compiler.research_brief",
      "input_schema": {
        "type": "object",
        "required": ["goal", "evidence_ids"],
        "properties": {
          "goal": { "type": "string" },
          "evidence_ids": { "type": "array", "items": { "type": "string" } }
        }
      },
      "ui_affordance": "button"
    }
  ],
  "bindings": [
    { "from": "goal.text", "to": "compiler.goal" },
    { "from": "evidence[].evidence_id", "to": "compiler.evidence_ids" }
  ],
  "update_rules": [
    { "when": { "event": "evidence_added" }, "then": { "strategy": "recompile_partial", "diff_mode": "stable_ids" } },
    { "when": { "event": "user_action" }, "then": { "strategy": "patch_dataModel", "diff_mode": "stable_ids" } }
  ],
  "interaction": { "physics_profile": "structured_light" },
  "provenance": {
    "run_id": "run_research_01JH0T",
    "created_at_ms": 1768000000789,
    "source_links": [
      { "evidence_id": "ev_paper_1", "uri": "file://paper-a.pdf" },
      { "evidence_id": "ev_blog_1", "uri": "url://example.com/blog-b" }
    ]
  }
}
```

---

## 6. Component Catalog (v0.1)

This is the client-side allowlist. The agent can **only** emit these components. Anything else is rejected.

### Base Rules

- Every node has: `type`, `id`, `props`, optional `children`
- `id` must be stable (no churn across updates)
- `props` are validated; unknown props are ignored or cause error

### Component Definitions

#### Container

| Prop | Type | Values | Required |
|------|------|--------|----------|
| `layout` | string | `"column"` \| `"row"` \| `"stack"` \| `"grid"` | Yes |
| `gap` | string | `"xs"` \| `"sm"` \| `"md"` \| `"lg"` | No |
| `padding` | string | `"none"` \| `"sm"` \| `"md"` \| `"lg"` | No |
| `visibleWhen` | object | `{ path: string, eq?: any, ne?: any }` | No |

#### Card

| Prop | Type | Values | Required |
|------|------|--------|----------|
| `title` | string | any | No |
| `variant` | string | `"default"` \| `"hero"` \| `"muted"` | No |
| `visibleWhen` | object | same shape as Container | No |

#### Text

| Prop | Type | Values | Required |
|------|------|--------|----------|
| `text` | string | literal text | No* |
| `textPath` | string | dataModel path | No* |
| `style` | string | `"h1"` \| `"h2"` \| `"body"` \| `"subtle"` \| `"mono"` | No |
| `truncate` | boolean | true/false | No |

*One of `text` or `textPath` required

#### Badge

| Prop | Type | Values | Required |
|------|------|--------|----------|
| `text` | string | literal text | No* |
| `textPath` | string | dataModel path | No* |
| `tone` | string | `"neutral"` \| `"info"` \| `"warn"` \| `"danger"` \| `"success"` | No |

#### Button

| Prop | Type | Values | Required |
|------|------|--------|----------|
| `label` | string | any | Yes |
| `actionId` | string | must match `actions[].action_id` | Yes |
| `variant` | string | `"primary"` \| `"secondary"` \| `"ghost"` | No |
| `requiresConfirm` | boolean | renderer enforces confirm UX | No |

#### TextField

| Prop | Type | Values | Required |
|------|------|--------|----------|
| `label` | string | any | No |
| `placeholder` | string | any | No |
| `valuePath` | string | binds to dataModel path | Yes |
| `onChangeBinding` | object | `{ to: string }` | No |
| `submitActionId` | string | action to trigger on submit | No |

#### List

| Prop | Type | Values | Required |
|------|------|--------|----------|
| `itemsPath` | string | dataModel path to array | Yes |
| `itemTitlePath` | string | relative path within item | Yes |
| `itemMetaPath` | string | relative path within item | No |
| `emptyText` | string | shown when list empty | No |

#### DataTable

| Prop | Type | Values | Required |
|------|------|--------|----------|
| `rowsPath` | string | dataModel path to array | Yes |
| `columns` | array | `{ key: string, label: string }[]` | Yes |
| `rowActionId` | string | optional click behavior | No |

#### Tabs

| Prop | Type | Values | Required |
|------|------|--------|----------|
| `tabs` | array | `{ id: string, label: string, icon?: string }[]` | Yes |
| `activeTabPath` | string | dataModel path | Yes |
| `onTabSelectBinding` | object | `{ to: string }` | No |

#### Accordion

| Prop | Type | Values | Required |
|------|------|--------|----------|
| `itemsPath` | string | dataModel path to array | Yes |
| `itemTitlePath` | string | relative path within item | Yes |
| `itemBodyTextPath` | string | relative path within item | No |

### Minimum Renderer Behaviors

1. `visibleWhen` gating - conditionally show/hide components
2. `textPath`/`rowsPath` resolution - safe path resolver for dataModel
3. Action dispatch: `actionId` → `kernel.execute(action_id, inputs)`
4. State updates: kernel returns `patch_dataModel` or full replacement

---

## 7. Compiler Pipeline

### Overview

The Capsule Compiler transforms `goal + evidence` into `CapsuleSpec`.

```
goal + evidence[] → CapsuleSpec → A2UI Surface → Rendered UI
```

### Pipeline Phases

#### Phase 0: Normalize Inputs

**Input:** goal text + raw evidence inputs (urls, docs, diffs, logs)

**Output:** `NormalizedEvidence[]`

**Enforce:**
- `evidence_id` stable
- `snapshot_ref` immutable

```typescript
interface NormalizedEvidence {
  evidence_id: string;
  kind: 'url' | 'doc' | 'pdf' | 'note' | 'repo' | 'diff' | 'test_run' | 'log' | 'artifact' | 'dataset';
  title: string;
  uri: string;
  snapshot_ref: string;
  extracted_schema: Record<string, any>;
  metadata?: Record<string, any>;
}
```

#### Phase 1: Route to Framework

Deterministic router:
- if goal contains `plan|itinerary|trip` → `fwk.trip_plan`
- if evidence includes `diff|test_run` → `fwk.diff_review`
- else if goal contains `summarize|synthesize` → `fwk.research_synthesis`
- else → `fwk.generic`

**Return:**
- `capsule_type`
- Initial UI template skeleton (stable IDs)

#### Phase 2: Compile CapsuleSpec

**Build:**
- `ui.a2ui_payload.dataModel` from `extracted_schema`
- `ui.a2ui_payload.surfaces` from template + derived sections
- `actions[]` from template (tool refs only)
- `bindings[]` connecting evidence → dataModel
- `update_rules[]` for evidence deltas

**Hard Constraints:**
- Stable IDs for nodes
- Any section with derived content must include citation mapping to `evidence_id`

#### Phase 3: Incremental Updates

When evidence changes, compute delta classification:
- **minor**: add rows to existing table → `patch_dataModel`
- **medium**: add a new section card → `patch_ui`
- **major**: change capsule_type → `recompile_full`

Return patches with stable IDs.

#### Phase 4: Journal Everything

Every compile and patch emits journal events:
- `capsule_compiled`
- `capsule_patched`
- `evidence_added` / `evidence_removed`

#### Phase 5: Renderer Enforcement

Renderer:
- Validates A2UI payload against allowlist
- Refuses unknown components
- Resolves paths safely
- Dispatches actions through kernel

### Compiler Prompt Template

```markdown
You are the Capsule Compiler.

Inputs:
- Goal: {{goal_text}}
- Evidence objects (normalized): {{evidence_json}}
- Allowed A2UI components: {{component_catalog}}
- Constraints:
  - No code execution. Output declarative UI only.
  - Every claim/section must reference evidence_id(s).
  - Use stable component ids (do not churn ids across updates).
  - Prefer patch_ui / patch_dataModel for incremental updates.

Task:
1) Choose capsule_type (framework template id).
2) Produce CapsuleSpec v0.1 JSON.
3) Ensure:
   - ui.a2ui_payload contains surfaces + dataModel updates
   - actions only reference tool_ref ids (no inline tool logic)
   - update_rules include evidence_added/evidence_removed/goal_changed

Output:
Return ONLY valid JSON for CapsuleSpec.
```

---

## 8. Physics & Interaction Contracts

Motion/color encode meaning (risk, confidence, constraints, provenance trails).

### InteractionSpec Contract

Agent may suggest semantics, but renderer decides physical realization.

```json
{
  "physics_profile": "structured_light",
  "objects": [
    {
      "object_id": "token:constraint:must",
      "type": "token",
      "semantics": {
        "kind": "constraint",
        "weight": 0.9,
        "risk_tier": "read"
      },
      "physics": {
        "mass": "heavy",
        "drag": "high",
        "snap": ["zone:constraints"]
      }
    },
    {
      "object_id": "action:exec:run_tool",
      "type": "action",
      "semantics": {
        "kind": "risk",
        "risk_tier": "exec",
        "requires_preview": true
      },
      "physics": {
        "heat": "hot",
        "hover_warning": true,
        "snap": ["zone:confirm"]
      }
    }
  ],
  "rules": [
    { "if": { "risk_tier": "exec" }, "then": { "visual_hotness": "high", "confirm_gate": true } },
    { "if": { "confidence_lt": 0.5 }, "then": { "fog": "on", "needs_disambiguation": true } }
  ]
}
```

### Renderer Implementation Rules

1. **Tokens are draggable objects**
2. **Snap-zones exist for:** intent, entities, constraints, output_shape
3. **"Synthesis moment"** is a discrete transition: collection → UI spawn (not gradual morphing)
4. **UI updates are diff-based** (stable IDs) to preserve user mental model

---

## 9. Implementation Plan

### Repo Structure

```
crates/
├── a2ui_types/           # A2UI types (shared TS/Rust)
│   └── JSON schema validators for nodes and props
├── capsule_spec/         # CapsuleSpec types
│   ├── JSON schema validation
│   └── stable ID + diff utilities
├── evidence_store/       # Evidence management
│   ├── evidence object types
│   ├── snapshot refs
│   ├── add/remove/list APIs
│   └── "evidence delta" events
├── capsule_compiler/     # Core compiler
│   ├── routing (goal → capsule_type)
│   ├── compilation (emit CapsuleSpec with stable IDs)
│   ├── incremental update (patch generator)
│   └── attribution enforcement
└── journal/              # Event store
    ├── append-only event store
    ├── run_id tracking
    └── event types

services/
├── kernel/               # Main service
│   ├── /v1/intent/dispatch → resolves framework + returns CapsuleSpec
│   ├── /v1/capsules/{id} → get capsule spec
│   ├── /v1/capsules/{id}/patch → apply compiler patch
│   └── /v1/journal/stream → events
└── framework/            # Framework templates (optional separate service)

apps/
├── shell/                # Host app + command bar
│   ├── renders "capsule tabs" (optional UI affordance)
│   └── mounts A2UI renderer
└── ui/                   # A2UI implementation
    ├── A2UIRenderer implementation
    ├── component catalog + validation
    └── action dispatch adapter
```

### Kernel → A2UI Contract

```typescript
type UISpec = A2UIJson;

// Kernel returns:
interface KernelResponse {
  ui: UISpec;        // A2UI payload
  journal: Event[];  // evidence trail
}
```

---

## 10. Build Order (PR-Friendly)

### What NOT to Do Yet

Do NOT:
- Add streaming
- Add animations
- Add multiple surfaces
- Add tabs (beyond basic)
- Add persistence
- Add browser automation

Right now: **proof of correctness, not polish.**

### PR-A: Foundation

**Scope:**
- `crates/a2ui_types`
- `crates/capsule_spec`
- Minimal JSON schema validation

**Deliverable:** Types and validation compile

### PR-B: Renderer MVP

**Scope:**
- `apps/ui` A2UIRenderer with catalog above
- Hardcoded CapsuleSpec sample renders

**Deliverable:** Static JSON → rendered UI

### PR-C: Compiler MVP

**Scope:**
- `crates/evidence_store`
- `crates/capsule_compiler` (compile_full only)
- Emits one of the example capsule specs

**Deliverable:** `goal + evidence → CapsuleSpec`

### PR-D: Kernel Wiring

**Scope:**
- Kernel endpoint returns CapsuleSpec / A2UI payload
- Shell calls dispatch and renders returned spec
- Journal stream works

**Deliverable:** End-to-end flow works

### PR-E: Incremental Patches

**Scope:**
- `patch_dataModel` + `patch_ui`
- Evidence delta triggers partial recompile

**Deliverable:** Live updates without full recompile

---

## Technical Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React 18+ | Best A2UI support |
| A2UI Renderer | Lit or React | Official implementations |
| State | Zustand | Lightweight, streaming-friendly |
| Transport | WebSocket | Streaming LLM responses |
| Content Extraction | Cheerio + Puppeteer | Static + dynamic scraping |
| LLM | Claude API / Gemini API | Official SDKs |
| Styling | Tailwind CSS | Utility-first |
| Build | Vite | Fast dev server |

---

## Key Success Metrics

1. **Generation Time:** Request to rendered UI < 5 seconds
2. **Source Accuracy:** All claims traceable to sources (100%)
3. **Interaction Latency:** User action response < 1 second
4. **Cross-Platform:** Same payload renders on web + mobile

---

## Security Considerations

1. **No Code Execution** - A2UI is declarative only
2. **Component Whitelist** - Only allow pre-approved components
3. **Content Sanitization** - Sanitize all scraped content
4. **Source Validation** - Verify URLs before fetching
5. **Rate Limiting** - Limit LLM calls per session
6. **Authentication** - Secure access to generation endpoints

---

## Additional Resources

- A2UI Specification: https://a2ui.org/specification/
- A2UI GitHub: https://github.com/google/A2UI
- Google Disco Blog: https://blog.google/technology/google-labs/gentabs-gemini-3/

---

*This document is Tier-0 UI Law. It replaces ad-hoc shell UI decisions and supersedes earlier canvas logic.*
