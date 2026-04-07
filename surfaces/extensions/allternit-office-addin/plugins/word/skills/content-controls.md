# Skill: Content Controls and Bookmarks

## Trigger
Use this skill when working with structured document templates, form fields, bookmarks, or named regions.

## Read All Content Controls
```javascript
await Word.run(async (context) => {
  const controls = context.document.contentControls;
  controls.load("items/tag,items/title,items/text,items/type");
  await context.sync();

  return {
    count: controls.items.length,
    controls: controls.items.map(c => ({
      tag: c.tag,
      title: c.title,
      text: c.text,
      type: c.type,
    })),
  };
});
```

## Get a Content Control by Tag
```javascript
await Word.run(async (context) => {
  const controls = context.document.contentControls.getByTag("CompanyName");
  controls.load("items/text,items/tag");
  await context.sync();

  if (controls.items.length === 0) {
    return { error: "Content control with tag 'CompanyName' not found" };
  }

  return { text: controls.items[0].text };
});
```

## Set Text in a Content Control
```javascript
await Word.run(async (context) => {
  const control = context.document.contentControls.getByTag(tagName).getFirst();
  control.insertText(newText, Word.InsertLocation.replace);
  await context.sync();
  return { success: true };
});
```

## Fill All Template Fields
```javascript
// Pattern for template documents with tagged content controls
const fieldValues: Record<string, string> = {
  ClientName:    "Acme Corp",
  ProjectTitle:  "Q1 Strategy Review",
  Date:          "April 7, 2026",
  AuthorName:    "Jane Smith",
  Department:    "Strategy",
};

await Word.run(async (context) => {
  const controls = context.document.contentControls;
  controls.load("items/tag,items/title");
  await context.sync();

  for (const control of controls.items) {
    const value = fieldValues[control.tag] ?? fieldValues[control.title];
    if (value) {
      control.insertText(value, Word.InsertLocation.replace);
    }
  }
  await context.sync();
  return { fieldsPopulated: Object.keys(fieldValues).length };
});
```

## Work with Bookmarks
```javascript
// Read a bookmark range
await Word.run(async (context) => {
  const bookmark = context.document.getBookmarkRange("ExecutiveSummary");
  bookmark.load("text");
  await context.sync();
  return { text: bookmark.text };
});

// Insert text at a bookmark
await Word.run(async (context) => {
  const bookmark = context.document.getBookmarkRange("ExecutiveSummary");
  bookmark.insertText(newContent, Word.InsertLocation.replace);
  await context.sync();
});
```

## Content Control Types Reference
```javascript
Word.ContentControlType.richText     // rich text field (most common)
Word.ContentControlType.plainText    // plain text field (no formatting)
Word.ContentControlType.checkBox     // checkbox
Word.ContentControlType.comboBox     // dropdown combo
Word.ContentControlType.dropdownList // dropdown list
Word.ContentControlType.datePicker   // date field
Word.ContentControlType.picture      // image placeholder
```

## Safety Rules
- Tags are developer-set identifiers; titles are user-visible names — prefer tags for programmatic access
- `getByTag` returns a collection (there may be multiple controls with the same tag)
- `getFirst()` after `getByTag` will throw if no match — use `getByTag(...).load("items")` and check length first
- Plain text content controls strip all formatting when set — use rich text controls for formatted content
- Bookmarks may not exist in all documents — wrap `getBookmarkRange` calls in try/catch
