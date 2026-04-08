# Command: word:improve

## Trigger
"improve this document", "fix grammar and style", "make the writing better", "polish this draft", "check tone and clarity"

## Steps

1. **Read document context**
```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const paragraphs = context.document.body.paragraphs;
  body.load("text");
  paragraphs.load("items/text,items/style,items/outlineLevel");
  await context.sync();

  return {
    fullText: body.text,
    paragraphs: paragraphs.items.map((p, i) => ({
      index: i,
      text: p.text,
      style: p.style,
      isHeading: p.outlineLevel <= 3,
    })),
  };
});
```

2. **AI diagnoses issues** before rewriting:

Diagnosis prompt:
```
Review this document and identify issues with:
1. Grammar and spelling errors (list specific instances)
2. Passive voice (flag sentences)
3. Wordiness (flag phrases that can be tightened)
4. Tone inconsistency (flag shifts between formal/casual)
5. Structural issues (unclear transitions, missing topic sentences)

Return as JSON:
{
  "grammarIssues": [{ "text": "...", "suggestion": "..." }],
  "passiveVoice": [{ "text": "...", "suggestion": "..." }],
  "wordiness": [{ "text": "...", "tighter": "..." }],
  "toneIssues": [{ "text": "...", "note": "..." }],
  "structural": ["..."]
}
```

3. **Present diagnosis to user** before making changes
4. **Apply fixes paragraph-by-paragraph** with tracked changes

```javascript
await Word.run(async (context) => {
  context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;
  await context.sync();

  for (const fix of fixes) {
    const results = context.document.body.search(fix.original, {
      matchCase: true, matchWholeWord: false
    });
    results.load("items");
    await context.sync();

    if (results.items.length > 0) {
      results.items[0].insertText(fix.improved, Word.InsertLocation.replace);
      await context.sync();
    }
  }
});
```

## Improvement Scope Options
- **grammar**: fix errors only, no style changes
- **style**: improve clarity and flow, keep meaning intact
- **full**: grammar + style + structure recommendations
- **tone**: align tone across the document (specify target: professional/casual/technical)

## Output Format
- List issues found (categorized: grammar, style, structure)
- Show fix count by category
- Confirm tracked changes made
- Report: "Found 12 issues: 3 grammar, 5 style, 4 passive voice. All fixed with tracked changes."
