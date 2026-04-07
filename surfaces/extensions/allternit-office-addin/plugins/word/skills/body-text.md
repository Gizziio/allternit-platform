# Skill: Body Text Operations

## Trigger
Use this skill when reading the full document body, inserting text, or replacing document content.

## Read Full Document Body Text
```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  body.load("text");
  await context.sync();
  return { text: body.text, charCount: body.text.length };
});
```

## Insert Text at End of Document
```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  body.insertText(textToAdd, Word.InsertLocation.end);
  await context.sync();
});
```

## Insert Text at Beginning of Document
```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  body.insertText(textToAdd, Word.InsertLocation.start);
  await context.sync();
});
```

## Insert a Paragraph Break
```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  body.insertParagraph("", Word.InsertLocation.end);
  await context.sync();
});
```

## InsertLocation Reference
```javascript
// Word.InsertLocation values:
Word.InsertLocation.start       // beginning of range/body
Word.InsertLocation.end         // end of range/body
Word.InsertLocation.before      // before a range (paragraph context only)
Word.InsertLocation.after       // after a range (paragraph context only)
Word.InsertLocation.replace     // replaces existing content of range
```

## Replace All Instances of a String
```javascript
await Word.run(async (context) => {
  const results = context.document.body.search(searchText, {
    matchCase: false,
    matchWholeWord: true,
  });
  results.load("items");
  await context.sync();

  for (const range of results.items) {
    range.insertText(replacementText, Word.InsertLocation.replace);
  }
  await context.sync();
  return { replacedCount: results.items.length };
});
```

## Get Word Count Approximation
```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  body.load("text");
  await context.sync();
  const wordCount = body.text.split(/\s+/).filter(Boolean).length;
  return { wordCount };
});
```

## Safety Rules
- NEVER use `body.clear()` — this is irreversible and destroys all content including tracked changes
- Use `insertText` with `InsertLocation.end` to append; never replace the body unless explicitly requested
- For large documents (>50,000 chars), read in paragraph chunks rather than loading `body.text` all at once
- Always load `text` property before reading it — it is not populated by default
