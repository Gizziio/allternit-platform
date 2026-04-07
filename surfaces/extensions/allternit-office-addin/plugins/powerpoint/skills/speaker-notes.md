# Skill: Speaker Notes

## Trigger
Use this skill when reading, writing, or generating speaker notes for one or all slides.

## Read Notes from All Slides
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();

  for (const slide of slides.items) {
    slide.load("notes");
  }
  await context.sync();

  return {
    notes: slides.items.map((slide, i) => ({
      index: i,
      notes: slide.notes ?? "",
    })),
  };
});
```

## Read Notes from a Single Slide
```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(slideIndex);
  slide.load("notes");
  await context.sync();
  return { index: slideIndex, notes: slide.notes ?? "" };
});
```

## Write Notes to a Slide
```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(slideIndex);
  slide.notes = notesText;
  await context.sync();
  return { success: true };
});
```

## Generate Notes from Slide Content (AI Pattern)
```javascript
// Step 1: Read slide shapes and text
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(slideIndex);
  slide.shapes.load("items/name");
  await context.sync();

  for (const shape of slide.shapes.items) {
    shape.textFrame.load("text,hasText");
  }
  await context.sync();

  const slideText = slide.shapes.items
    .filter(s => s.textFrame?.hasText)
    .map(s => s.textFrame.text)
    .join("\n\n");

  // Step 2: Pass slideText to AI with prompt:
  // "Write concise speaker notes for a slide with the following content: [slideText]"
  // Notes should cover: key talking points, transitions, timing cues (2-3 min per slide)

  // Step 3: Write generated notes back
  slide.notes = generatedNotesText;
  await context.sync();
  return { success: true, slideText };
});
```

## Bulk Generate Notes for All Slides
```javascript
// Pattern: read all slides → batch AI calls → write all notes back
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

  // Collect all slide texts for batch AI processing
  const slideTexts = slides.items.map((slide, i) => ({
    index: i,
    text: slide.shapes.items
      .filter(s => s.textFrame?.hasText)
      .map(s => s.textFrame.text)
      .join("\n"),
  }));

  return { slideTexts }; // Return to caller for AI processing
  // Then write notes back in a second PowerPoint.run call
});
```

## Clear Notes from All Slides
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();

  for (const slide of slides.items) {
    slide.notes = "";
  }
  await context.sync();
});
```

## Safety Rules
- `slide.notes` is a plain string — must load with `slide.load("notes")` before reading
- Notes do not support rich formatting via the API
- Always load slides before iterating — two separate syncs required (load items, then load notes)
- Generated notes should be plain text; avoid markdown formatting (renders as literal characters in PowerPoint)
