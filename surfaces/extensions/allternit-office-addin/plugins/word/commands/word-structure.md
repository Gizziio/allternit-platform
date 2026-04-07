# Command: word:structure

## Trigger
"show me the document structure", "what headings does this doc have", "add a table of contents", "restructure this document", "reorganize sections", "what sections are missing"

## Steps

1. **Read document outline**
```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items/text,items/style,items/outlineLevel");
  await context.sync();

  const outline = paragraphs.items
    .filter(p => p.outlineLevel <= 4)
    .map((p, i) => ({
      index: i,
      level: p.outlineLevel,
      text: p.text.trim(),
      style: p.style,
    }));

  return { outline, totalParagraphs: paragraphs.items.length };
});
```

2. **Display outline to user**

Format:
```
## Document Structure
H1: Introduction (para 0)
  H2: Background (para 3)
  H2: Scope (para 7)
H1: Analysis (para 12)
  H2: Findings (para 14)
    H3: Key Finding 1 (para 16)
  H2: Recommendations (para 22)
H1: Conclusion (para 28)
```

3. **Identify structural issues** (AI analysis):

Prompt:
```
Review this document outline and identify:
1. Missing sections for a [document type] document
2. Sections that seem misleveled (e.g. H3 content that should be H2)
3. Logical flow issues (topics out of order)
4. Any standard sections typically present in this type of document that are absent

Outline:
[outlineJSON]
```

4. **Add missing section headings** (if user confirms):
```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  const para = body.insertParagraph(headingText, Word.InsertLocation.end);
  para.style = `Heading ${level}`;
  // Insert placeholder body paragraph below
  body.insertParagraph("[Content to be added]", Word.InsertLocation.end);
  await context.sync();
});
```

5. **Insert table of contents** (at cursor position):
```javascript
// Word JS does not support inserting a built-in TOC via the API.
// Insert an OOXML TOC field instead.
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  // Insert TOC instruction (user must update field with F9 or right-click)
  selection.insertText(
    "[TABLE OF CONTENTS — Press F9 to update after generation]",
    Word.InsertLocation.replace
  );
  await context.sync();
  return {
    message: "TOC placeholder inserted. In Word, insert a real TOC via: References → Table of Contents → Automatic Table 1. Then press F9 to update.",
  };
});
```

## Output Format
- Show the full outline in hierarchical tree format
- List structural issues found with severity (missing/misordered/mislabeled)
- Offer suggestions: "Say 'add a Recommendations section' to insert one, or 'fix heading levels' to apply corrections"

## Notes
- Table of Contents cannot be created programmatically via Office.js — guide user to the References tab
- Heading level fixes require replacing paragraph styles — always use tracked changes
- For documents with no headings, suggest adding H1 headings to major sections first
