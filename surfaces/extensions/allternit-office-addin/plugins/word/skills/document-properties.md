# Skill: Document Properties and Metadata

## Trigger
Use this skill when reading document metadata, word counts, document structure summaries, or building context for AI operations.

## Get Document Properties
```javascript
await Word.run(async (context) => {
  const props = context.document.properties;
  props.load("title,author,subject,keywords,description,creationDate,lastSaveTime,revisionNumber,wordCount,characterCount");
  await context.sync();

  return {
    title: props.title,
    author: props.author,
    subject: props.subject,
    keywords: props.keywords,
    wordCount: props.wordCount,
    characterCount: props.characterCount,
    creationDate: props.creationDate,
    lastSaved: props.lastSaveTime,
    revisionNumber: props.revisionNumber,
  };
});
```

## Set Document Properties
```javascript
await Word.run(async (context) => {
  const props = context.document.properties;
  props.title = "Project Proposal — Q2 2026";
  props.author = "Eoj";
  props.subject = "Strategy";
  props.keywords = "proposal, strategy, Q2";
  await context.sync();
});
```

## Get Document URL (File Path)
```javascript
const url = Office.context.document.url;
const filename = url.split(/[/\\]/).pop() ?? "document.docx";
return { url, filename };
```

## Build Full Document Context for AI
```javascript
// Standard context object to pass to the AI system prompt
async function buildWordDocumentContext(): Promise<WordDocumentContext> {
  return await Word.run(async (context) => {
    const body = context.document.body;
    const props = context.document.properties;
    const paragraphs = context.document.body.paragraphs;

    body.load("text");
    props.load("title,author,wordCount");
    paragraphs.load("items/text,items/style,items/outlineLevel");
    await context.sync();

    // Extract outline (headings only)
    const outline = paragraphs.items
      .filter(p => p.outlineLevel <= 3)
      .map(p => ({
        level: p.outlineLevel,
        text: p.text.trim(),
      }));

    return {
      title: props.title || filename,
      author: props.author,
      wordCount: props.wordCount,
      url: Office.context.document.url,
      outline,
      // Full text for smaller docs; summary for large docs
      fullText: props.wordCount < 5000 ? body.text : null,
      isLargeDocument: props.wordCount >= 5000,
    };
  });
}
```

## Check Track Changes Mode
```javascript
await Word.run(async (context) => {
  context.document.load("changeTrackingMode");
  await context.sync();
  return {
    trackingEnabled: context.document.changeTrackingMode !== Word.ChangeTrackingMode.off,
    mode: context.document.changeTrackingMode,
  };
});
```

## Safety Rules
- `wordCount` from `document.properties` is updated on save — may be stale for unsaved edits; compute from `body.text.split(/\s+/)` for real-time count
- `title` may be empty for new/unsaved documents — fall back to the filename from `Office.context.document.url`
- Do not expose the full document URL in AI summaries — it may contain sensitive path information
- For documents over 5,000 words, use the outline + first 1,000 words as AI context rather than full text
