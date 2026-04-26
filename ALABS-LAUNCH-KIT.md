# A://Labs Launch Kit

> Public enrollment links, course metadata, and go-to-market assets for the A://Labs curriculum.

---

## What is A://Labs?

A://Labs is the practical training arm of Allternit—a modular, hands-on curriculum designed to turn working professionals into agent-native operators. Every course is built around real tools, real workflows, and a capstone project you can ship.

The curriculum is organized into three tiers:

- **CORE** — Foundational skills every agent-native builder needs.
- **OPS** — Infrastructure, automation, and systems integration.
- **AGENTS** — Advanced multi-agent design and ML tool integration.

All courses are hosted on Canvas (Free For Teacher) and are **publicly enrollable**.

---

## Quick Links

| Tier | Course | Canvas URL |
|------|--------|------------|
| CORE | Build AI-Assisted Software with Copilot & Cursor | [Enroll →](https://canvas.instructure.com/courses/14593493) |
| CORE | Prompt Engineering & Systematic LLM Reasoning | [Enroll →](https://canvas.instructure.com/courses/14593495) |
| OPS | Orchestrate Agents & Automations with n8n | [Enroll →](https://canvas.instructure.com/courses/14593499) |
| OPS | Computer Vision for Agent Systems | [Enroll →](https://canvas.instructure.com/courses/14593501) |
| OPS | Local RAG & Document Intelligence | [Enroll →](https://canvas.instructure.com/courses/14593503) |
| AGENTS | ML Models as Agent Tools | [Enroll →](https://canvas.instructure.com/courses/14593505) |
| AGENTS | Multi-Agent Systems & Orchestration | [Enroll →](https://canvas.instructure.com/courses/14593507) |
| ADV | Build Plugins for Allternit | [Enroll →](https://canvas.instructure.com/courses/14612851) |
| ADV | The Allternit Workflow Engine | [Enroll →](https://canvas.instructure.com/courses/14612861) |
| ADV | Provider Adapters & Unified APIs | [Enroll →](https://canvas.instructure.com/courses/14612869) |

---

## Course Catalog

### CORE Tier

#### ALABS-CORE-COPILOT
- **Title:** Build AI-Assisted Software with Copilot & Cursor
- **URL:** https://canvas.instructure.com/courses/14593493
- **Modules:** 7
- **Description:** Learn to use GitHub Copilot and Cursor as infrastructure layers for code generation, refactoring, and MCP tool building.
- **Capstone:** Build a TypeScript MCP Server with Cursor
- **Cover:** [`/images/alabs-covers/ALABS-CORE-COPILOT.png`](./surfaces/allternit-platform/public/images/alabs-covers/ALABS-CORE-COPILOT.png)

#### ALABS-CORE-PROMPTS
- **Title:** Prompt Engineering & Systematic LLM Reasoning
- **URL:** https://canvas.instructure.com/courses/14593495
- **Modules:** 7
- **Description:** Master prompt engineering from first principles: systematic prompting, Python API patterns, and red-teaming.
- **Capstone:** Design a 3-Prompt Suite + Red-Team Report
- **Cover:** [`/images/alabs-covers/ALABS-CORE-PROMPTS.png`](./surfaces/allternit-platform/public/images/alabs-covers/ALABS-CORE-PROMPTS.png)

### OPS Tier

#### ALABS-OPS-N8N
- **Title:** Orchestrate Agents & Automations with n8n
- **URL:** https://canvas.instructure.com/courses/14593499
- **Modules:** 8
- **Description:** Build production business workflows with n8n: architecture, patterns, OpenAI agent nodes, and self-hosted scaling.
- **Capstone:** Build a Self-Hosted n8n MCP Workflow
- **Cover:** [`/images/alabs-covers/ALABS-OPS-N8N.png`](./surfaces/allternit-platform/public/images/alabs-covers/ALABS-OPS-N8N.png)

#### ALABS-OPS-VISION
- **Title:** Computer Vision for Agent Systems
- **URL:** https://canvas.instructure.com/courses/14593501
- **Modules:** 6
- **Description:** Connect OpenCV and vision models to agent systems. Feature detection, object tracking, and screen-state analysis.
- **Capstone:** Build a Screen-State Analyzer for LLM Agents
- **Cover:** [`/images/alabs-covers/ALABS-OPS-VISION.png`](./surfaces/allternit-platform/public/images/alabs-covers/ALABS-OPS-VISION.png)

#### ALABS-OPS-RAG
- **Title:** Local RAG & Document Intelligence
- **URL:** https://canvas.instructure.com/courses/14593503
- **Modules:** 7
- **Description:** Build privacy-preserving RAG pipelines with local LLMs, semantic search, and offline document Q&A agents.
- **Capstone:** Offline Document-QA Agent
- **Cover:** [`/images/alabs-covers/ALABS-OPS-RAG.png`](./surfaces/allternit-platform/public/images/alabs-covers/ALABS-OPS-RAG.png)

### AGENTS Tier

#### ALABS-AGENTS-ML
- **Title:** ML Models as Agent Tools
- **URL:** https://canvas.instructure.com/courses/14593505
- **Modules:** 6
- **Description:** When to use ML vs. LLMs vs. rules. Wrap scikit-learn models as MCP tools and integrate them into agent workflows.
- **Capstone:** Wrap a Scikit-Learn Model as an MCP Tool
- **Cover:** [`/images/alabs-covers/ALABS-AGENTS-ML.png`](./surfaces/allternit-platform/public/images/alabs-covers/ALABS-AGENTS-ML.png)

#### ALABS-AGENTS-AGENTS
- **Title:** Multi-Agent Systems & Orchestration
- **URL:** https://canvas.instructure.com/courses/14593507
- **Modules:** 7
- **Description:** Design collaborative agent swarms: tool-using agents, code-generation agents, and multi-agent orchestration patterns.
- **Capstone:** Design a 3-Agent Collaborative Blog-Writing System
- **Cover:** [`/images/alabs-covers/ALABS-AGENTS-AGENTS.png`](./surfaces/allternit-platform/public/images/alabs-covers/ALABS-AGENTS-AGENTS.png)

---

## Curriculum Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         CORE                                │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │  COPILOT        │    │  PROMPTS        │                 │
│  │  (7 modules)    │    │  (7 modules)    │                 │
│  └────────┬────────┘    └────────┬────────┘                 │
│           │                      │                          │
│           └──────────┬───────────┘                          │
│                      ▼                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Unlocks: OPS Tier                                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         OPS                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │  N8N     │  │  VISION  │  │  RAG     │                   │
│  │(8 mods)  │  │(6 mods)  │  │(7 mods)  │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
│       │             │             │                         │
│       └─────────────┴─────────────┘                         │
│                     │                                       │
│                     ▼                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Unlocks: AGENTS Tier                               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       AGENTS                                │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │  ML             │    │  AGENTS         │                 │
│  │  (6 modules)    │    │  (7 modules)    │                 │
│  └─────────────────┘    └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

> **Note:** Within each tier, modules are sequentially locked via prerequisites. Students must complete modules in order.

---

## What Students Get

- **~6–8 modules per course** with bridge pages, source content, and external resources
- **Module Challenges** (10 pts each) for hands-on practice
- **Capstone Projects** with detailed grading criteria
- **Curriculum Map** and **Welcome Announcement** in every course
- **Syllabus page** with full course overview
- **Self-paced, public enrollment** via Canvas Free For Teacher

---

## Platform Integration

The Allternit platform surfaces all A://Labs tracks natively:

- **Labs Portal** (`LabsView.tsx`) — Default view showing all 7 live tracks grouped by tier
- **Product Discovery** (`ProductsDiscoveryView.tsx`) — A://Labs product card
- **Allternit OS** (`AllternitOSView.tsx`) — A://Labs as a launchable program
- **Shell Navigation** — Direct `allternit:open-labs` event routing

Cover images are also available in the platform's public assets:
- `surfaces/allternit-platform/public/images/alabs-covers/`

---

## Launch Status

| Check | Status |
|-------|--------|
| All courses published | ✅ |
| All modules/items published | ✅ |
| Sequential prerequisite chains | ✅ |
| Assignment groups organized | ✅ |
| Capstones with rubric criteria | ✅ |
| Module challenges added | ✅ |
| Welcome announcements posted | ✅ |
| Curriculum maps live | ✅ |
| Syllabus pages added | ✅ |
| Branded cover images uploaded | ✅ |
| Platform UI integrated | ✅ |
| ADV courses created | ✅ |
| ADV cover images uploaded | ✅ |
| First ADV module published | ✅ |

**Audit Result:** 0 issues across 7 courses. 3 ADV courses created with live modules.

---

## How to Enroll

1. Click any course link above.
2. Click **"Join this Course"** on the Canvas page.
3. Start with **Module 1**—all content is self-paced.

---

*Last updated: April 2026*


---

## Advanced Tier (ADV)

The advanced tier teaches Allternit-native architecture by turning our own packages into interactive course modules.

### Live Advanced Courses

| Code | Title | Source Package | Canvas URL | Status |
|------|-------|----------------|------------|--------|
| ALABS-ADV-PLUGINSDK | Build Plugins for Allternit | `packages/@allternit/plugin-sdk` | [Enroll →](https://canvas.instructure.com/courses/14612851) | Module 1 live |
| ALABS-ADV-WORKFLOW | The Allternit Workflow Engine | `packages/@allternit/workflow-engine` | [Enroll →](https://canvas.instructure.com/courses/14612861) | Ready for content |
| ALABS-ADV-ADAPTERS | Provider Adapters & Unified APIs | `packages/@allternit/provider-adapters` | [Enroll →](https://canvas.instructure.com/courses/14612869) | Ready for content |

### First Generated Module

- **Course:** ALABS-ADV-PLUGINSDK (Course ID: 14612851)
- **Module:** Module 1: Plugin SDK Architecture
- **Live URL:** https://canvas.instructure.com/courses/14612851/pages/module-1-plugin-sdk-architecture
- **Generated from:** `packages/@allternit/plugin-sdk`
- **Features:** Scroll-based navigation, animated architecture diagram, adapter group-chat simulation, 3 interactive quizzes, code ↔ plain-English toggles, capstone project
- **File:** [`alabs-generated-courses/ALABS-ADV-PLUGINSDK-module1.html`](./alabs-generated-courses/ALABS-ADV-PLUGINSDK-module1.html)

---

## Curriculum-as-Code Pipeline

We treat the Allternit codebase as a content factory. The pipeline keeps A://Labs aligned with platform evolution.

### How it works

```
1. CODE CHANGE (e.g., workflow-engine gets a new Node type)
         │
         ▼
2. DETECT ──> Diff packages/ weekly or on release
         │
         ▼
3. GENERATE ──> allternit-codebase-to-course skill produces HTML
         │
         ▼
4. REVIEW ──> Human spot-check
         │
         ▼
5. PUBLISH ──> sync-course-from-package.ts pushes to Canvas
         │
         ▼
6. AUDIT ──> launch-audit.ts verifies state
```

### Commands

Generate a module from a package:
```bash
npx tsx scripts/sync-course-from-package.ts \
  --package packages/@allternit/plugin-sdk \
  --course-id 14593499 \
  --module-title "ADV Module: Plugin SDK Deep Dive"
```

Upload a prebuilt HTML file:
```bash
npx tsx scripts/sync-course-from-package.ts \
  --course-id 14593499 \
  --module-title "ADV Module: Plugin SDK Deep Dive" \
  --html-file alabs-generated-courses/ALABS-ADV-PLUGINSDK-module1.html
```

Run launch audit:
```bash
npx tsx scripts/launch-audit.ts
```

---

## Certification System

The Allternit platform now tracks A://Labs completions natively.

### Database Schema

**Prisma (PostgreSQL - desktop server):**
```prisma
model Certification {
  id          String
  userId      String
  courseCode  String
  courseTitle String
  tier        String
  completedAt DateTime
  capstoneUrl String?
  score       Int?
  verified    Boolean @default(false)
}
```

**Drizzle (SQLite - platform dev):**
Added `Certification` table to `src/lib/db/schema-sqlite.ts` with the same fields.

### Platform UI

- **LabsView** has a new **"Certifications"** tab showing earned badges grouped by tier
- Badges display: course title, completion date, score, verification status, and capstone link
- API endpoint: `GET /api/v1/certifications` and `POST /api/v1/certifications`

### Recording a completion

```bash
curl -X POST /api/v1/certifications \
  -H "Content-Type: application/json" \
  -d '{
    "courseCode": "ALABS-CORE-COPILOT",
    "courseTitle": "Build AI-Assisted Software with Copilot & Cursor",
    "tier": "CORE",
    "score": 95,
    "verified": true,
    "capstoneUrl": "https://github.com/user/mcp-server"
  }'
```

---

## New Assets & Artifacts

| Asset | Location |
|-------|----------|
| Course cover images | `surfaces/allternit-platform/public/images/alabs-covers/` |
| Generated HTML modules | `alabs-generated-courses/` |
| Sync script | `scripts/sync-course-from-package.ts` |
| Launch audit | `scripts/launch-audit.ts` |
| Course creation (browser) | `scripts/create-advanced-courses-browser.ts` |
| Agent skill | `.agents/skills/allternit-codebase-to-course/` |
| Launch kit | `ALABS-LAUNCH-KIT.md` |

---

*Last updated: April 2026*
