# Command: ppt:design

## Trigger
"apply Allternit branding", "make this look professional", "change the color scheme", "apply consistent formatting", "style this presentation"

## Steps

1. **Read all slides and shapes**
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();
  return { count: slides.items.length };
});
```

2. **Apply background to each slide** using slide-design skill pattern:
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();

  for (let i = 0; i < slides.items.length; i++) {
    const slide = slides.items[i];

    // Choose background based on slide type
    const bgColor = i === 0
      ? "#2A1F16"   // cover slide: dark sand
      : "#FDF8F3";  // content slides: light sand

    slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle, {
      left: 0, top: 0, width: 960, height: 540,
    });
  }
  await context.sync();

  // Get all the newly added background shapes and style them
  for (let i = 0; i < slides.items.length; i++) {
    const slide = slides.items[i];
    slide.shapes.load("items");
  }
  await context.sync();

  for (let i = 0; i < slides.items.length; i++) {
    const slide = slides.items[i];
    const bg = slide.shapes.items[slide.shapes.items.length - 1];
    const bgColor = i === 0 ? "#2A1F16" : "#FDF8F3";
    bg.fill.setSolidColor(bgColor);
    bg.lineFormat.visible = false;
    bg.name = "Background";
    bg.zorderPosition = PowerPoint.ShapeZOrder.sendToBack;
  }
  await context.sync();
});
```

3. **Apply typography to all text shapes**
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();

  for (const slide of slides.items) {
    slide.shapes.load("items/name,items/type");
  }
  await context.sync();

  for (const slide of slides.items) {
    for (const shape of slide.shapes.items) {
      shape.textFrame.load("paragraphs,hasText");
    }
  }
  await context.sync();

  for (const slide of slides.items) {
    for (const shape of slide.shapes.items) {
      if (!shape.textFrame.hasText) continue;

      const isTitle = shape.name.toLowerCase().includes("title");
      shape.textFrame.paragraphs.load("items");
      await context.sync();

      for (const para of shape.textFrame.paragraphs.items) {
        para.font.name = "Calibri";
        para.font.color = isTitle ? "#2A1F16" : "#2A1F16";
        para.font.size = isTitle ? 32 : 18;
        para.font.bold = isTitle;
      }
    }
  }
  await context.sync();
});
```

## Design Modes
- **allternit** (default): sand palette, Calibri font, widescreen layout
- **minimal**: white backgrounds, dark text, no decorative elements
- **dark**: dark sand backgrounds (`#1A1209`), light text (`#FDF8F3`)
- **corporate**: white backgrounds, navy accents

## Output Format
- "Applied Allternit branding to [N] slides"
- "Cover slide: dark background with light text"
- "Content slides: sand-50 background with sand-900 text"
- Offer: "Say 'ppt:notes' to generate speaker notes, or 'ppt:summarize' to review the deck"
