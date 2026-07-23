# OpenMAIC Integration Service

## Overview

This directory contains the Allternit integration layer for [OpenMAIC](https://openmaic.io) — Tsinghua University's open-source Multi-Agent Interactive Classroom.

## What is OpenMAIC?

OpenMAIC transforms any topic or document into an immersive, AI-powered learning experience using:
- **Multi-agent orchestration** (LangGraph) with AI teachers and classmates
- **Rich scene types**: slides, quizzes, simulations, PBL
- **Voice interaction** with TTS narration and ASR student input
- **Collaborative whiteboard** for real-time drawing
- **Export** to PPTX and interactive HTML

## Integration Architecture

```
Allternit Platform                    OpenMAIC Service
┌─────────────────┐                   ┌─────────────────┐
│  A://Labs UI    │ ◄── REST/API ───► │  Lesson Gen     │
│  (Next.js)      │                   │  (LangGraph)    │
│                 │ ◄── Scene JSON ──► │                 │
└─────────────────┘                   └─────────────────┘
         │                                     │
         │         Unified Content DB          │
         └──────────────┬──────────────────────┘
                        │
              ┌─────────┴─────────┐
              │  SQLite/Postgres  │
              │  lessons table    │
              └───────────────────┘
```

## Integration Phases

### Phase 1: Content Pipeline (Immediate)
- Bridge: Allternit topic → OpenMAIC generation API → scene JSON
- Store generated lessons in `alabsLesson` DB table
- Render scenes using native React components

### Phase 2: Native Renderer (Short-term)
- `SlideDeck` component — slide lecture player
- `QuizPlayer` component — interactive quiz with instant feedback
- `SimSandbox` component — HTML simulation iframe
- `Whiteboard` component — drawing surface (tldraw integration)

### Phase 3: Multi-Agent Classroom (Medium-term)
- AI Teacher persona with configurable voice/style
- AI Classmates for discussions and debates
- TTS/ASR integration for voice interaction

## Files

- `README.md` — this file
- `integration-plan.md` — detailed technical plan
- `scripts/` — setup and generation scripts

## License Note

OpenMAIC is AGPL-3.0. This integration uses it as an external service (API calls), not as a linked binary, to maintain license separation.
