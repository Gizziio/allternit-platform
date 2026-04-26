# A://Labs Remix Course Status

**Last updated:** 2026-04-14

## Executive Summary

- **7 Canvas courses** are live, published, and fully populated with content.
- **23 Udemy courses** downloaded (metadata + partial HTML files).
- **All 7 remix courses** have complete production-ready bridge and source modules.
- **All modules are published** and prerequisite chains are verified working.
- **3 paid keeper courses** were pivoted away from; their content gaps filled with original material + free docs.

---

## The Paid-Course Pivot

Three critical keeper courses cost money and **will not be purchased**:

1. `computer-vision-with-opencv-official-opencv-free-course` → **ALABS-OPS-VISION**
2. `github-copilot-for-beginners-ai-coding-crash-course` → covered by `master-github-copilot` for **ALABS-CORE-COPILOT**
3. `the-complete-course-for-ai-agent-with-no-code-tool-2025` → **ALABS-AGENTS-AGENTS**

**Resolution:**
- **ALABS-CORE-COPILOT** uses the comprehensive `Master GitHub Copilot` course (29 mapped lectures) + original bridge content.
- **ALABS-AGENTS-AGENTS** builds from existing `Build Custom GPT` and `How I Made My Own ChatGPT Coder` metadata + original content.
- **ALABS-OPS-VISION** is built entirely from OpenCV official docs, Anthropic computer-use SDK docs, and original bridge modules.
- **ALABS-OPS-RAG** supplements the LLMWare course metadata with LLMWare docs + original content.

---

## Lecture Mapping Reality Check

The Udemy downloader captured **metadata and chapter titles** for most courses, but actual video files are largely missing (skipped with "No video stream available"). This is consistent across the catalog.

**Strategic implication:** The remix courses are built from:
1. **Metadata lecture titles** → used to build module outlines and topic coverage
2. **Original bridge modules** → provide the proprietary→universal framing
3. **Free external resources** → docs, tutorials, and official guides
4. **Downloaded HTML summaries** → cherry-picked where available

This does not block delivery. A://Labs differentiation comes from the framing and bridge content, not from repackaging raw videos.

---

## Course-by-Course Canvas Status

| Course Code | Sources | Mapped Lectures | Modules | Pages | Assignments | Status |
|-------------|---------|-----------------|---------|-------|-------------|--------|
| ALABS-OPS-N8N | 7 | 45 | 8 | 9 | 1 capstone | ✅ Complete |
| ALABS-CORE-COPILOT | 1 | 29 | 7 | 8 | 1 capstone | ✅ Complete |
| ALABS-CORE-PROMPTS | 3 | 15 | 7 | 8 | 1 capstone | ✅ Complete |
| ALABS-AGENTS-ML | 2 | 11 | 6 | 7 | 1 capstone | ✅ Complete |
| ALABS-OPS-RAG | 1 | 0 | 7 | 8 | 1 capstone | ✅ Complete (docs-based) |
| ALABS-OPS-VISION | 0 | 0 | 6 | 7 | 1 capstone | ✅ Complete (docs-based) |
| ALABS-AGENTS-AGENTS | 2 | 0 | 7 | 8 | 1 capstone | ✅ Complete (docs-based) |

### Verified Checks

- ✅ All courses published and available to students
- ✅ All modules published (visible to enrolled learners)
- ✅ All module items published (pages, assignments, external URLs, subheaders)
- ✅ All modules have unique sequential positions (1, 2, 3...)
- ✅ All prerequisite chains verified and functional
- ✅ All bridge modules uploaded as formatted Canvas pages
- ✅ All source modules uploaded as formatted Canvas pages
- ✅ Capstone context pages added before capstone assignments
- ✅ External resource links added to all relevant modules
- ✅ Homepages created and set as front pages
- ✅ Curriculum map page created in every course
- ✅ Homepages updated with links to curriculum map

---

## Content Inventory

### Bridge Modules (Original A://Labs Content)

- **ALABS-OPS-N8N** (5 modules)
  - The Problem: Why n8n Over SaaS Automation
  - n8n as Connector Layer
  - Self-Hosting & Scaling
  - Bridge: How Allternit Uses n8n
  - Capstone: Build a Self-Hosted n8n MCP Workflow

- **ALABS-CORE-COPILOT** (3 modules)
  - The Problem: Manual Coding is the Bottleneck
  - Bridge: Allternit's Cursor + Copilot Stack
  - Capstone: Build an MCP Server with Cursor

- **ALABS-OPS-RAG** (4 modules)
  - The Problem: Cloud RAG Leaks Data
  - Agentic RAG
  - Bridge: Allternit's mcp-apps-adapter RAG
  - Capstone: Offline Document-QA Agent

- **ALABS-CORE-PROMPTS** (3 modules)
  - The Problem: Guesswork vs. Systematic Prompt Engineering
  - Bridge: Allternit's agui-gateway Prompt Tiers
  - Capstone: Design a 3-Prompt Suite + Red-Team Report

- **ALABS-OPS-VISION** (3 modules)
  - The Problem: LLMs Are Blind
  - Bridge: Connecting OpenCV to Agent Systems
  - Capstone: Build a Screen-State Analyzer for LLM Agents

- **ALABS-AGENTS-ML** (3 modules)
  - The Problem: Agents Are Bad at Structured Data Math
  - Bridge: Wrapping ML Models as MCP Tools
  - Capstone: Wrap a Scikit-Learn Model as an MCP Tool

- **ALABS-AGENTS-AGENTS** (3 modules)
  - The Problem: One LLM Can't Do Everything
  - Bridge: Allternit's Agent Swarm Communication
  - Capstone: Design a 3-Agent Collaborative Blog-Writing System

### Source Modules (Lecture Guides + Original Content)

- **ALABS-OPS-N8N**: n8n Architecture, Business Workflow Patterns, OpenAI Agent Nodes
- **ALABS-CORE-COPILOT**: Copilot as Infrastructure, Cursor Workflows, Prompting for Clean Code, Extending Assistants with Tools
- **ALABS-CORE-PROMPTS**: The Prompt Engineering Stack, Python + OpenAI API Patterns, System Prompt Design, Developer Prompt Patterns
- **ALABS-AGENTS-ML**: When to Use ML vs. LLMs vs. Rules, Scikit-Learn Patterns, Feature Engineering for Structured Data
- **ALABS-OPS-RAG**: RAG Architecture, Local LLM Inference, Semantic Search Implementation
- **ALABS-OPS-VISION**: OpenCV + Python Foundations, Feature Detection & Tracking, Face & Object Detection with Deep Learning
- **ALABS-AGENTS-AGENTS**: Agent Architecture Patterns, Tool-Using Agents, Code-Generation Agents, Multi-Agent Orchestration

---

## Known Technical Notes

1. **Module Position Collision Bug**: Canvas Free For Teacher plan has a quirk where modules sharing the same position number cause prerequisite updates to be dropped. This was resolved using a **two-phase repositioning strategy**: move all modules to temporary high positions (1000+), then move them back to sequential positions (1, 2, 3...), then set prerequisites.

2. **Default View Limitation**: The `wiki_page` default view is not accepted by the Free For Teacher plan API. Courses default to `modules` view, which is functionally fine since the homepage/front page is still accessible.

3. **Unpublished Modules**: The original module creation API accepted `published: true` but modules were created unpublished. A fix script published all modules retroactively.

4. **Video Download Gap**: Most Udemy video lectures could not be downloaded ("No video stream available"). The curriculum maps use metadata titles as the source of truth, and content gaps are filled with original writing and free documentation.

5. **Rubric API Blocked**: The Canvas rubric creation API returns 500 errors on the Free For Teacher plan. Capstone assignments exist but do not have attached rubrics.

---

## Next Steps (Optional Polish)

1. **Rubric Workaround**: Create rubrics manually in the Canvas UI, or skip them and use the grading criteria documented in capstone pages.
2. **Challenge Assignments**: Convert the 5-minute module challenges into lightweight ungraded Canvas assignments for interactivity.
3. **Course Cards**: Add branded cover images to the 7 courses for visual consistency.
4. **Manual QA Walkthrough**: Open each course in Canvas as a student to verify navigation, prerequisites, and page rendering.
5. **Enrollment & Launch**: Set up student enrollment links and announce the courses.

---

## Key Assets

- `remix-plans/ALABS-*.json` — Lecture-to-module mappings for all 7 courses
- `remix-content/ALABS-*/` — Production-ready markdown files (bridge + source modules)
- `scripts/remix-infrastructure.ts` — Regenerates plans and maps lectures
- `scripts/canvas-hybrid-setup.ts` — Original course creation script
- `scripts/populate-canvas-content.ts` — Content upload pipeline
- `scripts/fix-positions-two-phase.ts` — Prerequisite/position repair script
- `scripts/setup-course-homepages.ts` — Homepage creation script
- `scripts/add-curriculum-map.ts` — Curriculum map page creation script
