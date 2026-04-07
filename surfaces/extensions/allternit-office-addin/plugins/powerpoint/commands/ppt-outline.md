# Command: ppt:outline

## Trigger
"create a 10-slide presentation about X", "generate an outline for Y", "build a deck on Z", "make a presentation covering A, B, and C"

## Steps

1. **AI generates a JSON outline**

Outline generation prompt:
```
Create a presentation outline for: [topic]
Format as JSON:
{
  "title": "Presentation Title",
  "slideCount": N,
  "slides": [
    {
      "index": 0,
      "type": "cover",
      "title": "...",
      "subtitle": "...",
      "bullets": []
    },
    {
      "index": 1,
      "type": "content",
      "title": "...",
      "subtitle": null,
      "bullets": ["Point 1", "Point 2", "Point 3"]
    }
  ]
}
Slide types: cover, agenda, content, data, quote, section, closing
Keep bullet points to 3-5 per slide. Concise — 10 words max per bullet.
```

2. **Validate outline JSON** before touching PowerPoint
```javascript
function validateOutline(outline: PresentationOutline): string[] {
  const errors: string[] = [];
  if (!outline.slides?.length) errors.push("No slides in outline");
  outline.slides.forEach((s, i) => {
    if (!s.title) errors.push(`Slide ${i}: missing title`);
    if (s.bullets?.length > 7) errors.push(`Slide ${i}: too many bullets (max 7)`);
  });
  return errors;
}
```

3. **Create slides and populate**
```javascript
await PowerPoint.run(async (context) => {
  // Add required number of slides
  for (let i = 0; i < outline.slides.length; i++) {
    context.presentation.slides.add();
  }
  await context.sync();

  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();

  for (let i = 0; i < outline.slides.length; i++) {
    const slideSpec = outline.slides[i];
    const slide = slides.items[i];
    slide.shapes.load("items/name");
  }
  await context.sync();

  for (let i = 0; i < outline.slides.length; i++) {
    const spec = outline.slides[i];
    const slide = slides.items[i];

    // Title
    const titleShape = slide.shapes.items.find(s =>
      s.name.toLowerCase().includes("title")
    );
    if (titleShape) {
      titleShape.textFrame.text = spec.title;
    } else {
      slide.shapes.addTextBox(spec.title, { left: 60, top: 40, width: 840, height: 70 });
    }

    // Body / bullets
    const bodyText = spec.bullets?.join("\n") ?? spec.subtitle ?? "";
    if (bodyText) {
      const contentShape = slide.shapes.items.find(s =>
        s.name.toLowerCase().includes("content") ||
        s.name.toLowerCase().includes("placeholder 2")
      );
      if (contentShape) {
        contentShape.textFrame.text = bodyText;
      } else {
        slide.shapes.addTextBox(bodyText, { left: 60, top: 130, width: 840, height: 370 });
      }
    }
  }

  await context.sync();
  return { success: true, slidesCreated: outline.slides.length };
});
```

## Output Format
- Show the outline as a numbered list before building (give user a chance to adjust)
- After building: "Created [N] slides. Use `ppt:design` to apply Allternit branding."
- Offer: "Say 'add a slide about X' to add more, or 'rewrite slide 2' to refine content"

## Outline Type Templates
- **Business case**: Problem → Solution → Market → Product → Team → Ask
- **Strategy**: Situation → Complication → Resolution (SCR framework)
- **Project update**: Executive summary → Progress → Blockers → Next steps
- **Training**: Objectives → Concepts (×N) → Practice → Summary → Resources
