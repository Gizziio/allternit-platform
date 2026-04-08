# Cookbook: Build a 10-Slide Pitch Deck

## Prerequisites
- A blank PowerPoint presentation is open
- You have your company/product details ready

---

## Command Sequence

**Command**: `ppt:outline` → "Create a 10-slide investor pitch deck for [company name]"

The AI generates this structure and builds it automatically:

| Slide | Type | Title | Content |
|---|---|---|---|
| 1 | Cover | [Company Name] | Tagline + founder name + date |
| 2 | Problem | The Problem | 3 pain points your target market faces |
| 3 | Solution | Our Solution | What you do and how it solves the problem |
| 4 | Market | Market Opportunity | TAM / SAM / SOM with data |
| 5 | Product | Product Demo | Key features, screenshot or diagram placeholder |
| 6 | Business Model | How We Make Money | Revenue streams, pricing model |
| 7 | Traction | Traction & Validation | Key metrics: ARR, customers, growth rate |
| 8 | Team | The Team | Founders + key hires with brief bios |
| 9 | Ask | The Ask | Funding amount, use of funds breakdown |
| 10 | Next Steps | Next Steps | Timeline, key milestones, CTA |

---

## Step 1: Generate Outline and Build Slides

```
ppt:outline → "10-slide investor pitch deck for [company]: [brief description]"
```

The plugin creates 10 slides with placeholder text. Review the outline before confirming.

---

## Step 2: Refine Content Per Slide

For each slide, use:
```
ppt:rewrite → "make slide 4 (Market) more compelling — emphasize the $50B TAM"
```

For data-heavy slides (Traction, Ask):
```
ppt:rewrite → "make slide 7 more concise — lead with the ARR number"
```

---

## Step 3: Apply Allternit Branding

```
ppt:design → "apply Allternit branding"
```

This sets:
- **Slide 1 (Cover)**: dark sand background (`#2A1F16`), white title text
- **Slides 2–10**: light sand background (`#FDF8F3`), sand-900 text
- **Typography**: Calibri 32pt titles, 18pt body throughout
- **Accent color**: `#B08D6E` used for key callout shapes

---

## Step 4: Add Speaker Notes

```
ppt:notes → "generate notes for all slides"
```

For the investor context, notes will include:
- Common investor objections to address per slide
- Transition phrases between sections
- Emphasis cues ("pause here", "show the demo now")

---

## Step 5: Final Review

```
ppt:summarize → "summarize this deck"
```

Check that the narrative arc is coherent:
- Problem → Solution → Market → Why us → Why now → Ask

---

## Pitch Deck Tips
- **Slide 1 (Cover)**: Less is more — just name, tagline, contact
- **Slide 3 (Solution)**: One sentence max before the first bullet
- **Slide 7 (Traction)**: Lead with the biggest number first
- **Slide 9 (Ask)**: Use of funds as a % pie breakdown is most persuasive
- **Target**: 10-12 min presentation = ~1 min per slide + buffer
