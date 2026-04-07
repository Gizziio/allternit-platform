# Command: ppt:rewrite

## Trigger
"rewrite slide 3", "make slide 2 more concise", "improve the wording on this slide", "simplify this slide", "make this more professional"

## Steps

1. **Identify target slide** — from user message (index) or active slide
```javascript
// If user says "slide 3" → index 2 (0-based)
// If user says "this slide" or "current slide" → use getActiveSlideIndex()
const targetIndex = userSpecifiedIndex ?? await getActiveSlideIndex();
```

2. **Read all text from the slide**
```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(targetIndex);
  slide.shapes.load("items/name,items/type");
  await context.sync();

  for (const shape of slide.shapes.items) {
    shape.textFrame.load("text,hasText");
  }
  await context.sync();

  return {
    shapes: slide.shapes.items
      .filter(s => s.textFrame?.hasText)
      .map(s => ({ name: s.name, text: s.textFrame.text })),
  };
});
```

3. **AI rewrites each shape text independently**

Rewrite prompt for AI:
```
Rewrite the following slide text to be [more concise / more professional / simpler / etc.].
Preserve the structure — keep the same number of bullet points if present.
Do not add new information. Return ONLY the rewritten text, no explanation.

Shape: [shapeName]
Current text: [text]
```

Process each shape individually — do NOT merge shapes or change structure.

4. **Write back the rewritten text**
```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(targetIndex);
  slide.shapes.load("items/name");
  await context.sync();

  for (const { shapeName, newText } of rewrittenShapes) {
    const shape = slide.shapes.items.find(s => s.name === shapeName);
    if (shape) {
      shape.textFrame.text = newText;
    }
  }

  await context.sync();
  return { success: true, shapesRewritten: rewrittenShapes.length };
});
```

## Rewrite Modes
- **concise** — remove filler words, reduce bullet count to 3-5, cut to key points
- **professional** — formal register, active voice, quantified claims where possible
- **simple** — plain language, shorter sentences, no jargon
- **expand** — add detail and supporting points to sparse slides
- **executive** — one key insight per slide, remove supporting detail, lead with conclusion

## Output Format
- Show before/after for the title shape
- Confirm how many shapes were updated
- Offer: "Say 'undo' if you'd like the original text back" (note: only works if browser supports it — recommend Ctrl+Z in PowerPoint)

## Rules
- NEVER clear all shapes and re-add them — this destroys formatting and position
- Only update `textFrame.text` — never delete or create shapes
- If a shape has no text, skip it silently
