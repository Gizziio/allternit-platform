# Command: word:summarize

## Trigger
"summarize this document", "give me the key points", "what is this document about", "executive summary", "TL;DR"

## Steps

1. **Read document content and structure**
```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const paragraphs = context.document.body.paragraphs;
  const props = context.document.properties;

  body.load("text");
  paragraphs.load("items/text,items/style,items/outlineLevel");
  props.load("title,author,wordCount");
  await context.sync();

  const headings = paragraphs.items
    .filter(p => p.outlineLevel <= 3)
    .map(p => ({ level: p.outlineLevel, text: p.text.trim() }));

  return {
    title: props.title,
    author: props.author,
    wordCount: props.wordCount,
    headings,
    // For large docs, pass headings + first 2000 chars as context
    textContext: props.wordCount > 5000
      ? body.text.substring(0, 2000) + "\n...[truncated]"
      : body.text,
  };
});
```

2. **AI generates structured summary**

Summary prompt:
```
Summarize this document.
Return:
1. A 3-sentence executive summary
2. Top 5 key points (bullet form, 1 sentence each)
3. Action items or decisions mentioned (if any)
4. Document type (memo, report, proposal, contract, etc.)

Document title: [title]
Word count: [count]
Structure: [headings]
Content: [textContext]
```

## Summary Types
- **brief**: 2-3 sentences
- **executive**: structured with key points and actions
- **detailed**: section-by-section with main points per heading
- **bullets**: top 7 bullet points only
- **one-line**: single sentence

## Output Format
```
## Summary — [Document Title]
[Executive summary paragraph]

### Key Points
- [Point 1]
- [Point 2]
...

### Action Items / Decisions
- [Item 1]
...

**Document type**: [type] | **Word count**: [N] | **Author**: [name]
```

## Notes
- For documents over 5,000 words, summarize based on headings + first/last 1,000 words
- If no headings exist, use paragraph-start sentences as structural anchors
- Do not insert the summary into the document unless user explicitly asks
