# Command: ppt:slide

## Trigger
"add a slide", "add a title slide", "add a content slide about X", "insert a new slide", "create a slide with title Y and content Z"

## Steps

1. **Get current slide count for context**
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();
  return { count: slides.items.length };
});
```

2. **Add a new slide**
```javascript
await PowerPoint.run(async (context) => {
  context.presentation.slides.add();
  await context.sync();

  // Get the new slide (last one)
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();
  const newSlide = slides.items[slides.items.length - 1];
  const newIndex = slides.items.length - 1;

  return { newIndex, slideId: newSlide.id };
});
```

3. **Populate title and content** using shape-text skill:
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();

  const slide = slides.items[newIndex];
  slide.shapes.load("items/name");
  await context.sync();

  // Set title
  const titleShape = slide.shapes.items.find(s =>
    s.name.toLowerCase().includes("title")
  );
  if (titleShape) {
    titleShape.textFrame.text = titleText;
  } else {
    // No title placeholder — add text box in title position
    slide.shapes.addTextBox(titleText, { left: 60, top: 40, width: 840, height: 70 });
  }

  // Set content
  const contentShape = slide.shapes.items.find(s =>
    s.name.toLowerCase().includes("content") ||
    s.name.toLowerCase().includes("placeholder 2")
  );
  if (contentShape) {
    contentShape.textFrame.text = bodyText;
  } else {
    slide.shapes.addTextBox(bodyText, { left: 60, top: 130, width: 840, height: 370 });
  }

  await context.sync();
  return { success: true, slideIndex: newIndex };
});
```

## Output Format
- Confirm: "Added slide [N+1]: '[title]'"
- Report total slide count after addition
- If the user didn't specify content, offer: "What content should go on this slide?"

## Notes
- New slides always append to the end — there is no insert-at-position API
- If user says "insert slide 3", add at end and note: "I've added it as slide [N+1] — PowerPoint JS doesn't support mid-deck insertion; you can drag it into position in the slide panel"
