# Cookbook: Write a Professional Report

## Prerequisites
- You have a topic, data, and key findings ready
- A blank Word document is open

---

## Report Structure (Standard)

| Section | Purpose | Typical Length |
|---|---|---|
| Cover Page | Title, author, date, organization | 1 page |
| Executive Summary | Key findings and recommendations | 0.5–1 page |
| Table of Contents | Navigation | Auto-generated |
| Introduction | Background, scope, methodology | 1–2 pages |
| Findings / Analysis | Main content by section | 3–10 pages |
| Conclusions | What the findings mean | 0.5–1 page |
| Recommendations | Action items | 0.5–1 page |
| Appendix | Supporting data, references | As needed |

---

## Step 1: Generate the Report Skeleton

**Command**: `word:structure` → "create a skeleton for a [type] report on [topic]"

```
word:structure → "create a skeleton for a market analysis report on the AI assistant market"
```

The plugin inserts headings with placeholder text:
```
H1: Executive Summary
[Content to be added]

H1: Introduction
H2: Background
[Content to be added]
H2: Scope and Methodology
[Content to be added]
...
```

---

## Step 2: Write Section by Section

For each section, provide your raw notes:

**Command**: `word:rewrite` → "expand these bullet points into a professional paragraph for the Introduction"

```
word:rewrite → "professional — Findings section: 
- Market size $45B in 2025
- Growing 28% YoY
- Top players: OpenAI, Anthropic, Google
- Key trend: enterprise adoption up 3x"
```

The AI expands bullet notes into flowing prose, with tracked changes so you can compare.

---

## Step 3: Create Data Tables

**Command**: `word:table` → "create a comparison table of the top 5 AI assistants with columns: Vendor, Product, Pricing, Key Strength"

```javascript
// Creates a 6-row × 4-column table with header row
// Applies Light List Accent 1 style
// Bold header row with sand-100 background
```

---

## Step 4: Improve the Draft

After writing all sections:

**Command**: `word:improve` → "improve this document — focus on clarity, remove passive voice, tighten wordiness"

Runs paragraph by paragraph, creates tracked changes for each improvement.

---

## Step 5: Generate Executive Summary

After completing the body:

**Command**: `word:summarize` → "write a 3-paragraph executive summary of this report"

The summary goes at the top and covers:
- Purpose and scope
- Key findings
- Top recommendations

```
word:rewrite → "insert this summary at the start of the document under the Executive Summary heading"
```

---

## Step 6: Formatting Pass

**Command**: (applied via formatting skill)

```javascript
// Apply Allternit Word theme:
// - Body: Calibri 11pt, 1.15 line spacing, 8pt after paragraph
// - Headings: H1=20pt, H2=16pt, H3=13pt — all sand-900 (#2A1F16)
// - Tables: Light List Accent 1
```

---

## Step 7: Final Review

**Command**: `word:structure` → "show me the final structure"

Checklist:
- [ ] All headings present and properly leveled
- [ ] Executive Summary is complete
- [ ] Tables are formatted consistently
- [ ] No placeholder text remaining (`[Content to be added]`, `[PLACEHOLDER]`)
- [ ] Page numbers added (Insert → Page Number in Word UI)
- [ ] Tracked changes reviewed and accepted/rejected

---

## Report Writing Tips
- Write executive summary LAST (after all sections are complete)
- Keep conclusions short — they restate findings, they don't add new information
- Each recommendation should have: action + responsible party + timeline
- Tables improve scanability — convert lists of 5+ items to tables
