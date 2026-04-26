---
name: docx
description: "Generate Word documents (.docx) from outlines, prompts, or structured data. Supports business proposals, technical specs, reports, and SOPs. Uses the Summit Copilot Skills FastAPI service for production-grade output."
tags: ["documents", "docx", "word", "office", "reporting"]
tools: ["llm", "filesystem"]
entrypoint: "SKILL.md"
---

# Docx

Generate production-ready Microsoft Word documents (.docx) from structured outlines, user prompts, or raw data. This skill wraps the `docx` npm library with opinionated styling and document patterns so agents can produce consistent, professional output without wrestling with low-level formatting.

> **STATUS:** Production  
> **Backend Tool:** `domains/agent-swarm/tools/document-generator/mod.ts` (action: `generateStudyGuide`)

---

## When to Use

- **Business Proposal** — pitching a product, service, or partnership to a client or stakeholder
- **Technical Specification** — documenting architecture, APIs, data models, or deployment plans
- **Meeting Notes / Minutes** — formal record of decisions, action items, and attendees
- **Standard Operating Procedure (SOP)** — repeatable step-by-step instructions for a team or process
- **Contract Draft** — preliminary legal agreement or statement of work (non-final)
- **Research Report** — findings, methodology, and recommendations from an investigation
- **Project Status Report** — timeline, blockers, risks, and next steps for leadership
- **User / API Documentation** — internal or external reference material exported to Word

---

## Output Format

Every invocation of this skill produces:

1. **A `.docx` file path** — the absolute path to the generated document on the local filesystem
2. **A document structure summary** — JSON or bulleted overview of sections, headings, and key metadata
3. **Optional: markdown preview of content** — a plain-text or markdown representation of the document body for quick review before download

The agent should always surface the file path first so the user can open or share it immediately.

---

## Document Structure Patterns

Use these patterns as the default skeleton when the user does not provide an explicit outline. Ask clarifying questions only if the document type is ambiguous.

### Business Proposal

| Section | Purpose |
|---------|---------|
| **Title** | Document name + date + recipient |
| **Executive Summary** | 2-3 paragraph elevator pitch of the entire proposal |
| **Problem** | The pain point or opportunity being addressed |
| **Solution** | What you are offering and how it solves the problem |
| **Pricing** | Costs, tiers, or budget estimate |
| **Call to Action (CTA)** | Specific next step and timeline |

### Technical Spec

| Section | Purpose |
|---------|---------|
| **Title** | Feature or system name + version + author |
| **Overview** | 1-paragraph summary of what is being built and why |
| **Architecture** | High-level diagram description + component list |
| **API Surface** | Endpoints, methods, request/response schemas |
| **Data Model** | Entities, relationships, storage strategy |
| **Security** | Auth, authorization, threat mitigation |
| **Deployment** | Infrastructure, CI/CD, rollback strategy |

### SOP (Standard Operating Procedure)

| Section | Purpose |
|---------|---------|
| **Title** | Procedure name + effective date |
| **Purpose** | Why this procedure exists |
| **Scope** | Who and what this applies to |
| **Responsibilities** | Roles accountable for each part |
| **Procedure** | Numbered steps with owners and checkpoints |
| **References** | Related docs, policies, or tools |

---

## Agent Instructions

Follow this 4-step workflow when generating a document:

### Step 1: Clarify

Confirm with the user:
- **Document type** (proposal, spec, SOP, etc.)
- **Audience** (executive, engineer, legal, external client, etc.)
- **Tone** (formal, casual, technical, persuasive)
- **Length target** (1 page, 3-5 pages, 10+ pages)
- **Must-include sections or data** (pricing tables, diagrams, compliance requirements)

If the user provides a raw prompt like *"Write me a doc about our new API"*, map it to the closest pattern above before proceeding.

### Step 2: Outline

Generate a structured outline in JSON. Example:

```json
{
  "title": "Q3 Infrastructure Migration Spec",
  "author": "Platform Team",
  "type": "technical-spec",
  "sections": [
    { "heading": "Overview", "body": "..." },
    { "heading": "Architecture", "body": "...", "type": "text" },
    { "heading": "Deployment Steps", "type": "bullet-list", "bullets": ["...", "..."] }
  ]
}
```

Show the outline to the user for approval before rendering.

### Step 3: Render

Call the Summit Copilot backend tool:

```typescript
import { execute } from '../domains/agent-swarm/tools/document-generator/mod.ts';

const result = await execute({
  action: "generateStudyGuide",
  topic: outline.title,
  format: "docx",
  length: "medium",
  learning_objectives: outline.sections.map(s => s.heading),
  key_terms: outline.key_terms || [],
  include_self_check: true,
  citations: outline.citations || []
});
```

### Step 4: Deliver

Return to the user:
- **File path:** `result.path`
- **Size:** `result.byteLength` bytes
- **Summary:** bullet list of sections and estimated page count
- **Revision suggestions:** 1-2 optional improvements (e.g., "Add an appendix for error codes" or "Consider a glossary for non-technical readers")

---

## Styling Guidelines

All documents rendered by this skill use the following defaults. Do not override unless the user explicitly requests a different style.

| Element | Style |
|---------|-------|
| **Body font** | Calibri, 11 pt |
| **Heading font** | Calibri, 14 pt, bold |
| **Line spacing** | 1.15 |
| **Margins** | 1 inch (top, bottom, left, right) |
| **Page numbers** | Centered in footer |
| **Table of Contents** | Auto-generated for documents with > 5 sections |
| **Title page** | Document title centered, author centered below, 400 pt spacing after |
| **Section spacing** | 400 pt before H1, 200 pt after H1, 200 pt after body paragraphs |
| **Bullet lists** | Level-0 bullets with 120 pt spacing after each item |

If the user requests custom branding (colors, logos, custom fonts), note that the current backend supports text-only styling. Direct them to a design tool or export to PDF for advanced branding.

---

## Backend Tool Reference

| Export | Path |
|--------|------|
| `execute` | `domains/agent-swarm/tools/document-generator/mod.ts` |
| `inputSchema` | `domains/agent-swarm/tools/document-generator/mod.ts` |

Dependencies: `document-generator-skills` FastAPI service (Python) running at `SUMMIT_COPILOT_URL`.

---

## Quick Reference

**Generate a proposal:**
1. Confirm type = `business-proposal`, audience = `external client`
2. Build JSON outline with Title, Executive Summary, Problem, Solution, Pricing, CTA
3. Call `createDocx({ title, sections, includeTOC: false })`
4. Return path + summary

**Generate a spec:**
1. Confirm type = `technical-spec`, audience = `engineering team`
2. Build JSON outline with Title, Overview, Architecture, API Surface, Data Model, Security, Deployment
3. Call `createDocx({ title, sections, includeTOC: true })`
4. Return path + summary + suggestion to add sequence diagrams

**Generate an SOP:**
1. Confirm type = `sop`, audience = `operations team`
2. Build JSON outline with Title, Purpose, Scope, Responsibilities, Procedure, References
3. Call `createDocx({ title, sections, includeTOC: false })`
4. Return path + summary
