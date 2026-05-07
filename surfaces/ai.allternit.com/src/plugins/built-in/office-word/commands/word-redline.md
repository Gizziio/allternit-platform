# Command: word:redline

## Trigger
"redline this", "make tracked changes", "mark up this section", "show changes as redline", "review and edit with tracked changes", "suggest edits"

## Steps

1. **Confirm track changes will be used**
   - This command ALWAYS uses tracked changes — all edits are visible and reversible
   - Inform user: "I'll make suggestions as tracked changes. Review them in the Review tab."

2. **Determine scope** — selection or full document
```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.load("text");
  await context.sync();

  const scope = selection.text.trim()
    ? { type: "selection", text: selection.text }
    : { type: "document", text: null };  // will read full doc

  return scope;
});
```

3. **Read the target text**
```javascript
// If selection
const targetText = selectionText;

// If full document
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items/text,items/style,items/outlineLevel");
  await context.sync();
  // Process paragraph by paragraph for full doc
  return paragraphs.items.map((p, i) => ({ index: i, text: p.text, style: p.style }));
});
```

4. **AI generates redline suggestions**

Redline prompt:
```
You are a professional editor. Review the following text and suggest improvements.
For each suggestion, provide:
- originalText: exact text to be replaced (short phrase or sentence, max 200 chars)
- suggestedText: the improved replacement
- reason: one-line explanation

Focus on: clarity, conciseness, grammar, active voice.
Do NOT change facts, add new information, or reorder paragraphs.
Return as JSON array: [{ originalText, suggestedText, reason }]

Text to review:
[targetText]
```

5. **Apply suggestions as tracked changes**
```javascript
await Word.run(async (context) => {
  context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;
  await context.sync();

  for (const suggestion of suggestions) {
    const results = context.document.body.search(suggestion.originalText, {
      matchCase: true,
      matchWholeWord: false,
    });
    results.load("items");
    await context.sync();

    if (results.items.length > 0) {
      // Replace only the FIRST match to avoid over-applying
      results.items[0].insertText(suggestion.suggestedText, Word.InsertLocation.replace);
      await context.sync();
    }
  }

  return { appliedCount: suggestions.length };
});
```

## Output Format
- List suggestions with original → suggested and reason
- Confirm: "[N] tracked changes applied. Review in Review tab → Track Changes"
- Offer: "Say 'accept all' as a reminder to accept in PowerPoint Review tab, or 'word:rewrite' to redo specific paragraphs"

## Rules
- Maximum 20 suggestions per redline session to keep the document reviewable
- Short, targeted replacements only (< 200 chars) — no paragraph-level rewrites via search/replace
- For paragraph-level rewrites, use `word:rewrite` which directly targets the paragraph range
- Never apply the same suggestion to more than the first match — prevents accidental mass replacements
