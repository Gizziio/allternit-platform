# Skill: Tracked Changes and Redline

## Trigger
Use this skill when making tracked-change edits, reviewing revisions, or producing redline documents.

## Enable Track Changes
```javascript
await Word.run(async (context) => {
  context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;
  await context.sync();
});
```

## Disable Track Changes
```javascript
await Word.run(async (context) => {
  context.document.changeTrackingMode = Word.ChangeTrackingMode.off;
  await context.sync();
});
```

## ChangeTrackingMode Values
```javascript
Word.ChangeTrackingMode.off              // no tracking
Word.ChangeTrackingMode.trackAll         // track all changes by all authors
Word.ChangeTrackingMode.trackMineOnly    // track only changes by current user
```

## Make Tracked Edits (Insert with Tracking)
```javascript
// Pattern: enable tracking → make changes → optionally disable
await Word.run(async (context) => {
  // Enable tracking
  context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;
  await context.sync();

  // Make edits — these will appear as tracked insertions/deletions
  const selection = context.document.getSelection();
  selection.insertText(newText, Word.InsertLocation.replace);
  await context.sync();

  // Optionally disable tracking after the edit
  // context.document.changeTrackingMode = Word.ChangeTrackingMode.off;
});
```

## Read Tracked Changes (Revisions)
```javascript
await Word.run(async (context) => {
  // Note: Full tracked change iteration requires WordApiOnline 1.1+
  // For standard Word JS API, read body text with tracked changes shown vs. hidden

  const body = context.document.body;
  body.load("text");
  await context.sync();

  // Load the document's change tracking state
  context.document.load("changeTrackingMode");
  await context.sync();

  return {
    changeTrackingMode: context.document.changeTrackingMode,
    bodyText: body.text,
  };
});
```

## Accept All Changes
```javascript
// Word JS API (standard): no programmatic accept-all — must use OOXML or user action
// Recommended pattern: inform user
return {
  message: "To accept all tracked changes: Review tab → Accept → Accept All Changes",
  canDoViaSuggestion: true,
};
```

## Redline Pattern (AI-assisted)
The preferred AI redline workflow:
1. Read the original text
2. AI generates improved text
3. Enable `trackAll` tracking
4. Replace original with improved text (recorded as a deletion + insertion pair)
5. User reviews in Track Changes view

```javascript
async function redlineReplace(original: string, improved: string) {
  await Word.run(async (context) => {
    // Enable tracking
    context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;
    await context.sync();

    // Find and replace the original text
    const results = context.document.body.search(original, {
      matchCase: true,
      matchWholeWord: false,
    });
    results.load("items");
    await context.sync();

    if (results.items.length === 0) {
      context.document.changeTrackingMode = Word.ChangeTrackingMode.off;
      await context.sync();
      return { error: "Original text not found" };
    }

    results.items[0].insertText(improved, Word.InsertLocation.replace);
    await context.sync();
    return { success: true, replacements: 1 };
  });
}
```

## Safety Rules
- Always disable tracking after AI edits unless explicitly staying in review mode
- Tracked changes accumulate — large redlines can make documents unwieldy; prefer paragraph-level replacements
- Prefer `redlinePreferred: true` mode — always use tracked changes for AI-generated text edits
- Never call `body.clear()` when tracking is enabled — it creates a single massive tracked deletion
- The full Revisions collection API (`body.getTrackedChanges()`) requires `WordApiOnline 1.1` — check for availability
