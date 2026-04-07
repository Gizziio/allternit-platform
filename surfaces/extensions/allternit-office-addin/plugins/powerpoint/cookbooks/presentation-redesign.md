# Cookbook: Redesign an Existing Presentation

## Prerequisites
- An existing presentation is open (any number of slides)
- The presentation has text content (image-only slides will be flagged)

---

## Step 1: Audit the Current State

**Command**: `ppt:summarize` → "summarize this presentation"

This gives you:
- Total slide count and estimated reading time
- Executive summary of what the deck covers
- Per-slide one-line descriptions
- Flags image-only slides (no text to read or rewrite)

Review the output and identify:
- Slides with too much text (need simplification)
- Slides that are redundant (consider deleting)
- Missing slides the narrative needs

---

## Step 2: Restructure Outline if Needed

If slides are out of order or missing sections:
```
ppt:outline → "suggest a better structure for this [type] presentation"
```

The AI proposes a reordering. Since the API cannot reorder slides, note which slides to drag manually:
```
"Suggested order: 1, 3, 2, 5, 4, 6–10. Drag slides 2↔3 and 4↔5 in the panel."
```

---

## Step 3: Rewrite Slide Content

For slides with too much text:
```
ppt:rewrite → "make slide 3 more concise — max 4 bullets"
```

For slides with weak language:
```
ppt:rewrite → "make slide 5 more professional and direct"
```

Batch rewrite all slides:
```
ppt:rewrite → "rewrite all slides to be more concise — 3-4 bullets max per slide"
```
*(The plugin processes slides sequentially to avoid overwhelming PowerPoint's API)*

---

## Step 4: Apply Brand Design

**Command**: `ppt:design` → "apply Allternit branding"

What this does:
1. Sets background colors (dark cover, light sand content slides)
2. Applies consistent typography (Calibri, hierarchical sizes)
3. Sets text colors using the sand palette
4. Sends backgrounds to back to preserve existing shapes

**Manual follow-up** (API limitation — drag manually):
- Align shapes consistently using PowerPoint's Align tool
- Standardize image sizes and positions
- Remove legacy design elements (old logos, non-brand colors)

---

## Step 5: Generate New Speaker Notes

```
ppt:notes → "generate notes for all slides"
```

If the presentation already has notes:
```
ppt:notes → "summarize all existing notes into key talking points"
```

Or clear and regenerate:
```
ppt:notes → "clear all notes and regenerate from slide content"
```

---

## Step 6: Final Quality Check

**Command**: `ppt:summarize` → "re-summarize the updated deck"

Checklist:
- [ ] Narrative arc is clear (problem → solution → outcome)
- [ ] Each slide has a clear single message
- [ ] No slide has more than 7 bullet points
- [ ] Title and body fonts are consistent
- [ ] Branding applied to all slides (no outlier slides with old formatting)
- [ ] Speaker notes present on all slides

---

## Common Redesign Patterns

**Too many bullets → Use hierarchy**:
```
ppt:rewrite → "restructure slide 4 — make the first line a header and indent supporting points"
```

**Wall of text → Key quote**:
```
ppt:rewrite → "reduce slide 6 to a single powerful quote or statistic"
```

**Missing visual cue → Placeholder text**:
```
ppt:slide → "add a placeholder text '[IMAGE: product screenshot]' to slide 3"
```
