# Skill: Slide Operations

## Trigger
Use this skill when adding, deleting, duplicating, or navigating slides.

## Add a New Slide
```javascript
await PowerPoint.run(async (context) => {
  context.presentation.slides.add();
  await context.sync();
});
```

## Get All Slides
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id,items/index");
  await context.sync();
  return { count: slides.items.length, slides: slides.items.map(s => ({ id: s.id, index: s.index })) };
});
```

## Delete a Slide by Index
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();
  // slides.items[0] is the first slide (0-indexed)
  slides.items[slideIndex].delete();
  await context.sync();
});
```

## Duplicate a Slide
```javascript
// PowerPoint JS does not have a direct duplicate API.
// Pattern: add a new slide, then copy shapes from the source slide.
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();
  const source = slides.items[sourceIndex];
  source.shapes.load("items");
  await context.sync();
  context.presentation.slides.add();
  await context.sync();
  // Copy shapes individually (title, content, images)
});
```

## Get Slide Count
```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items");
  await context.sync();
  return { count: slides.items.length };
});
```

## Safety Rules
- Always load slide items before accessing by index
- Index is 0-based in the items array
- Adding a slide appends to end; there is no insert-at-position API in PowerPoint JS
