# Command: ppt:summarize

## Trigger
"summarize this presentation", "what is this deck about", "give me the key points", "overview of this deck", "what does each slide cover"

## Steps

1. **Read all slide titles and text** using presentation-context skill:
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();

  for (const slide of slides.items) {
    slide.shapes.load("items/name");
  }
  await context.sync();

  for (const slide of slides.items) {
    for (const shape of slide.shapes.items) {
      shape.textFrame.load("text,hasText");
    }
  }
  await context.sync();

  return {
    slideCount: slides.items.length,
    slides: slides.items.map((slide, i) => ({
      index: i,
      shapes: slide.shapes.items
        .filter(s => s.textFrame?.hasText)
        .map(s => ({ name: s.name, text: s.textFrame.text })),
    })),
  };
});
```

2. **AI generates structured summary**

Summary prompt:
```
Summarize this presentation. Return:
1. A 2-3 sentence executive summary of the whole deck
2. For each slide: a 1-line description of what it covers

Slides:
[JSON array of { index, title, bulletText }]
```

## Output Format

```
## Presentation Summary

[2-3 sentence executive summary]

### Slide-by-Slide
1. **[Title]** — [one-line description]
2. **[Title]** — [one-line description]
...

### Key Themes
- [Theme 1]
- [Theme 2]
- [Theme 3]
```

## Context Building (used by other commands)
The summarize output can be used as context for subsequent commands:
- `ppt:rewrite` can use the summary to maintain consistency across rewrites
- `ppt:notes` can reference the full deck narrative when generating per-slide notes
- `ppt:outline` can use the summary to suggest additional slides

## Output Notes
- For decks >20 slides, summarize in two passes: first 10, second 10
- If slides have no text (image-only slides), note them as "[Slide N: no text — visual content]"
- Include slide count and estimated speaking time (assume 2 min/slide average)
