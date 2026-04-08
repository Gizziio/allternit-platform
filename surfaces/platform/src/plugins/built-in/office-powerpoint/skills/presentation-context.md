# Skill: Presentation Context

## Trigger
Use this skill when reading presentation metadata, building a document summary, or gathering context before generating content.

## Get Slide Count
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();
  return { count: slides.items.length };
});
```

## Read All Slide Titles
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();

  // Load shapes for all slides first
  for (const slide of slides.items) {
    slide.shapes.load("items/name");
  }
  await context.sync();

  // Load textFrame for all shapes
  for (const slide of slides.items) {
    for (const shape of slide.shapes.items) {
      shape.textFrame.load("text,hasText");
    }
  }
  await context.sync();

  const titles = slides.items.map((slide, i) => {
    const titleShape = slide.shapes.items.find(s =>
      s.name.toLowerCase().includes("title")
    );
    return {
      index: i,
      title: titleShape?.textFrame?.hasText
        ? titleShape.textFrame.text
        : "(no title)",
    };
  });

  return { titles };
});
```

## Read Full Presentation Text (for summarization)
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
      shape.textFrame.load("text,hasText");
    }
  }
  await context.sync();

  const slideData = slides.items.map((slide, i) => {
    const texts = slide.shapes.items
      .filter(s => s.textFrame?.hasText)
      .map(s => ({ shapeName: s.name, text: s.textFrame.text }));
    return { index: i, shapes: texts };
  });

  return { slides: slideData };
});
```

## Get Active Slide Index
```javascript
// Uses the callback-based Office API (not promise-based)
function getActiveSlideIndex(): Promise<number> {
  return new Promise((resolve, reject) => {
    Office.context.document.getSelectedDataAsync(
      Office.CoercionType.SlideRange,
      (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve(result.value.slides[0].index - 1); // convert to 0-based
        } else {
          reject(new Error(result.error.message));
        }
      }
    );
  });
}
```

## Get Document URL / File Path
```javascript
const url = Office.context.document.url;
// Returns full file path or URL of the current presentation
```

## Build Context Summary for AI
```javascript
// Standard context object to pass into the AI system prompt
const context = {
  slideCount: slides.items.length,
  activeSlidIndex: await getActiveSlideIndex(),
  allTitles: titles,       // from Read All Slide Titles above
  documentUrl: Office.context.document.url,
};
```

## Safety Rules
- Multi-level load: load slides → shapes → textFrame requires at least 3 context.syncs
- `result.value.slides[0].index` from getSelectedDataAsync is 1-based; subtract 1 for API usage
- PowerPoint JS does not expose a `.title` property on the presentation object — derive it from the first slide or use the document URL filename
- For large decks (>30 slides), reading all text at once may be slow; consider reading only the active slide for interactive commands
