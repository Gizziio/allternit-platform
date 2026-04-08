# Skill: Shape Text Editing

## Trigger
Use this skill when reading or writing text in slide shapes (titles, content boxes, bullet lists).

## Read All Text from a Slide
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();

  const slide = slides.items[targetIndex];
  slide.shapes.load("items/name,items/type");
  await context.sync();

  // Load textFrame for all shapes
  for (const shape of slide.shapes.items) {
    shape.textFrame.load("text,hasText");
  }
  await context.sync();

  const texts = slide.shapes.items
    .filter(s => s.textFrame.hasText)
    .map(s => ({ name: s.name, text: s.textFrame.text }));

  return { slideIndex: targetIndex, shapes: texts };
});
```

## Write Text to a Named Shape
```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(targetIndex);
  slide.shapes.load("items/name");
  await context.sync();

  const shape = slide.shapes.items.find(s => s.name === shapeName);
  if (!shape) return { error: `Shape "${shapeName}" not found on slide ${targetIndex}` };

  shape.textFrame.text = newText;
  await context.sync();
  return { success: true };
});
```

## Write Title and Body to a Slide
```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(targetIndex);
  slide.shapes.load("items/name,items/type");
  await context.sync();

  for (const shape of slide.shapes.items) {
    shape.textFrame.load("text");
  }
  await context.sync();

  // Heuristic: title shape has "title" in its name (case-insensitive)
  const titleShape = slide.shapes.items.find(s =>
    s.name.toLowerCase().includes("title")
  );
  const contentShape = slide.shapes.items.find(s =>
    s.name.toLowerCase().includes("content") ||
    s.name.toLowerCase().includes("body") ||
    s.name.toLowerCase().includes("placeholder 2")
  );

  if (titleShape) titleShape.textFrame.text = titleText;
  if (contentShape) contentShape.textFrame.text = bodyText;

  await context.sync();
});
```

## Format Text in a Paragraph
```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(slideIndex);
  slide.shapes.load("items/name");
  await context.sync();

  const shape = slide.shapes.items[shapeIndex];
  shape.textFrame.paragraphs.load("items");
  await context.sync();

  const para = shape.textFrame.paragraphs.getItemAt(0);
  para.font.bold = true;
  para.font.size = 28;
  para.font.color = "#2A1F16";
  await context.sync();
});
```

## Add a Text Box at a Position
```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(targetIndex);
  // Slide widescreen: 960×540pt
  slide.shapes.addTextBox(textContent, {
    left: 60,
    top: 140,
    width: 840,
    height: 300,
  });
  await context.sync();
});
```

## Safety Rules
- Load `textFrame` before reading `.text` or `.hasText` — they are not populated by default
- Shape names are template-dependent — always search by name pattern, not index
- Two context.syncs are needed: first to load shape names, second to load textFrame
- Slide dimensions: Widescreen = 960×540pt | Standard = 720×540pt
- `textFrame.text` is the full concatenated text of all paragraphs — it cannot be set per-paragraph via this property; use paragraph.font for formatting
