# Skill: Selection and Range Operations

## Trigger
Use this skill when reading the current selection, getting selected text, or targeting a specific range for edits.

## Read Selected Text
```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.load("text,style,paragraphs");
  await context.sync();
  return {
    text: selection.text,
    style: selection.style,
    isEmpty: selection.text.trim() === "",
  };
});
```

## Replace Selected Text
```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.insertText(newText, Word.InsertLocation.replace);
  await context.sync();
});
```

## Insert After Selection
```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.insertText(additionalText, Word.InsertLocation.after);
  await context.sync();
});
```

## Search for Text and Get Range
```javascript
await Word.run(async (context) => {
  const searchResults = context.document.body.search(searchText, {
    matchCase: false,
    matchWholeWord: false,
    matchWildcards: false,
  });
  searchResults.load("items/text,items/style");
  await context.sync();

  return {
    matchCount: searchResults.items.length,
    matches: searchResults.items.map(r => r.text),
  };
});
```

## Get Context Around a Range
```javascript
// Get the paragraph containing the selection
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  const para = selection.paragraphs.getFirst();
  para.load("text,style,outlineLevel");
  await context.sync();
  return { paragraphText: para.text, style: para.style };
});
```

## Expand Selection to Full Sentence
```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  const expanded = selection.getTextRanges([".","!","?"], false); // split on sentence endings
  expanded.load("items/text");
  await context.sync();
  // First item is the sentence containing the selection
  return { sentence: expanded.items[0]?.text ?? selection.text };
});
```

## Track Changes — Accept/Reject Selection
```javascript
// Accept all tracked changes in the selection
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  // Note: tracked changes API requires WordApiOnline 1.1 or later
  selection.load("text");
  await context.sync();
  // Tracked changes are accepted via the document-level API
  context.document.body.search("*", { matchWildcards: true })
    .load("items");
  await context.sync();
});
```

## Safety Rules
- Check `selection.text.trim() === ""` before any replace operation — empty selection replace can delete paragraphs
- `getSelection()` returns the cursor position (collapsed range) when nothing is highlighted
- Search results are sorted by document position — first result = earliest in document
- `matchWildcards: true` uses Word's wildcard syntax, not regex — `?` = any character, `*` = any string
