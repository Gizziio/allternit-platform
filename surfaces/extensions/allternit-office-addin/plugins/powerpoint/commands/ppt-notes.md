# Command: ppt:notes

## Trigger
"add speaker notes", "generate notes for slide 2", "write notes for all slides", "summarize all notes", "clear the notes"

## Steps

### Generate Notes for a Single Slide
1. Read slide text using presentation-context skill
2. AI generates notes with this prompt:
```
Write speaker notes for this presentation slide.
Include:
- A 1-sentence hook or transition from the previous slide
- 3-4 key talking points expanding on the slide content
- One concrete example or data point if relevant
- Estimated speaking time: [1-2 min / 2-3 min]

Slide content:
[slideText]
```
3. Write generated notes using speaker-notes skill

```javascript
// Read
const { text: slideText } = await readSlideText(targetIndex);
// Generate (via agent)
const notes = await agent.generate(notesPrompt(slideText));
// Write back
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(targetIndex);
  slide.notes = notes;
  await context.sync();
});
```

### Generate Notes for All Slides
1. Read all slide texts in one PowerPoint.run call
2. Batch-generate notes (one AI call per slide, parallelized if possible)
3. Write all notes back in one PowerPoint.run call

```javascript
// Read all slide texts
const slideTexts = await readAllSlideTexts();

// Generate notes for each slide
const allNotes = await Promise.all(
  slideTexts.map(({ index, text }) =>
    agent.generate(notesPrompt(text)).then(notes => ({ index, notes }))
  )
);

// Write all notes in one batch
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();

  for (const { index, notes } of allNotes) {
    slides.items[index].notes = notes;
  }
  await context.sync();
  return { success: true, slidesUpdated: allNotes.length };
});
```

### Read/Summarize All Notes
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
    notes: slides.items.map((s, i) => ({
      slide: i + 1,
      hasNotes: !!s.notes?.trim(),
      preview: s.notes?.substring(0, 100) ?? "",
    })),
  };
});
```

### Clear All Notes
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();
  slides.items.forEach(s => { s.notes = ""; });
  await context.sync();
});
```

## Output Format
- When generating: "Generated notes for slide [N]: [first 80 chars]..."
- When summarizing: table of slide number, has notes (✓/✗), first line preview
- When clearing: "Cleared notes from [N] slides"
