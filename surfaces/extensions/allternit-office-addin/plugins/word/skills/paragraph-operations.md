# Skill: Paragraph Operations

## Trigger
Use this skill when iterating paragraphs, reading structure, applying heading styles, or working with individual paragraphs.

## Read All Paragraphs
```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items/text,items/style,items/alignment,items/outlineLevel");
  await context.sync();

  return {
    count: paragraphs.items.length,
    paragraphs: paragraphs.items.map((p, i) => ({
      index: i,
      text: p.text,
      style: p.style,
      outlineLevel: p.outlineLevel,
    })),
  };
});
```

## Get Outline Structure (Headings Only)
```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items/text,items/style,items/outlineLevel");
  await context.sync();

  const headings = paragraphs.items
    .filter(p => p.outlineLevel <= 3) // H1, H2, H3
    .map((p, i) => ({
      text: p.text.trim(),
      level: p.outlineLevel,
      style: p.style,
    }));

  return { headings };
});
```

## Apply a Style to a Paragraph
```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items");
  await context.sync();

  const para = paragraphs.items[targetIndex];
  para.style = "Heading 1"; // or "Heading 2", "Normal", "Quote", etc.
  await context.sync();
});
```

## Word Built-in Styles Reference
```javascript
// Common built-in style names (locale-sensitive — use English names in code):
"Normal"
"Heading 1"  "Heading 2"  "Heading 3"
"Title"      "Subtitle"
"Quote"      "Intense Quote"
"List Paragraph"
"Body Text"
"Caption"
"No Spacing"
```

## Insert a Paragraph with Style
```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const para = body.insertParagraph(text, Word.InsertLocation.end);
  para.style = "Heading 2";
  para.alignment = Word.Alignment.left;
  await context.sync();
});
```

## Delete a Paragraph
```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items/text");
  await context.sync();

  // Clear the paragraph text (delete its content but keep structure)
  // Word JS does not expose a direct .delete() on paragraphs in all versions
  // Preferred approach: clear and set to empty, then check if cleanup is needed
  const para = paragraphs.items[targetIndex];
  para.insertText("", Word.InsertLocation.replace);
  await context.sync();
});
```

## Set Paragraph Alignment
```javascript
para.alignment = Word.Alignment.left;    // default
para.alignment = Word.Alignment.centered;
para.alignment = Word.Alignment.right;
para.alignment = Word.Alignment.justified;
await context.sync();
```

## Safety Rules
- Style names are locale-sensitive in the UI but use English names in the API (`"Heading 1"` not `"Überschrift 1"`)
- Load `text,style,outlineLevel` together in one load call to minimize syncs
- `outlineLevel` is 1–9 for headings; plain body text has `outlineLevel = 10` (or undefined)
- Paragraph index is unstable if paragraphs are added/removed — always re-load after mutations
