# Cookbook: Clean Up a Messy Document

## Prerequisites
- A document with inconsistent formatting, style issues, or poor structure
- Common sources: pasted from web, converted from PDF, written by multiple authors

---

## Step 1: Diagnose the Document

**Command**: `word:structure` → "show me the heading structure"

**Command**: `word:summarize` → "summarize and tell me the document type"

Look for:
- No headings (flat, unstructured document)
- Inconsistent heading levels (H1 then H3 skipping H2)
- Mix of styles (Normal + Body Text + Default Paragraph Font)
- Pasted content with different fonts/sizes

---

## Step 2: Fix Heading Structure

**Command**: `word:structure` → "fix heading levels — ensure proper H1/H2/H3 hierarchy"

The plugin:
1. Reads all paragraphs and their current styles
2. AI proposes correct heading levels based on content
3. Applies heading styles with tracked changes

If no headings exist:
**Command**: `word:structure` → "add H1 headings to the main sections of this document"

---

## Step 3: Normalize Formatting

**Command** (via formatting skill):
```javascript
// Scan for common "dirty" formatting patterns:
// 1. Multiple consecutive blank paragraphs → collapse to one
// 2. Font inconsistencies → apply Calibri 11pt body standard
// 3. Mixed paragraph spacing → normalize to 1.15 + 8pt after
// 4. Tab characters used for indentation → replace with proper indent

await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items/text,items/style,items/lineSpacing,items/spaceAfter");
  await context.sync();

  let prevWasBlank = false;
  for (const para of paragraphs.items) {
    const isBlank = !para.text.trim();

    // Collapse double blank paragraphs
    if (isBlank && prevWasBlank) {
      para.insertText("", Word.InsertLocation.replace);
    }

    // Normalize body text formatting
    if (!isBlank && (para.style === "Normal" || para.style === "Body Text")) {
      para.font.name = "Calibri";
      para.font.size = 11;
      para.lineSpacing = 1.15;
      para.spaceAfter = 8;
    }

    prevWasBlank = isBlank;
  }
  await context.sync();
});
```

---

## Step 4: Fix Grammar and Style

**Command**: `word:improve` → "fix grammar — focus on passive voice and sentence fragments"

```
word:improve → grammar — correct spelling and grammar errors only, no style changes
```

This produces targeted tracked changes for grammar issues without restructuring the prose.

---

## Step 5: Remove Redundant Sections

**Command**: `word:summarize` → "identify any redundant or duplicate sections"

If duplicates found:
**Command**: `word:structure` → "identify duplicate content between Section 2 and Section 5"

The AI flags the duplication and suggests which version to keep. Deletion must be done manually in Word.

---

## Step 6: Apply Consistent Table Formatting

If document contains multiple tables:
```javascript
await Word.run(async (context) => {
  const tables = context.document.body.tables;
  tables.load("items");
  await context.sync();

  // Apply consistent style to all tables
  for (const table of tables.items) {
    table.style = "Light List Accent 1";
    const headerRow = table.rows.getFirst();
    headerRow.font.bold = true;
    headerRow.shadingColor = "#F5EDE3";
  }
  await context.sync();
  return { tablesFormatted: tables.items.length };
});
```

---

## Step 7: Final Quality Check

**Command**: `word:structure` → "re-check document structure"

**Command**: `word:summarize` → "does this document read coherently now?"

Checklist:
- [ ] Consistent heading hierarchy (H1 → H2 → H3)
- [ ] No double blank lines
- [ ] Body text: Calibri 11pt throughout
- [ ] All tables same style
- [ ] No mixed fonts from paste operations
- [ ] Tracked changes reviewed and accepted

---

## Common Paste Cleanup
When content is pasted from a website or PDF:
1. Select all → Home → Styles → Normal (reset to clean baseline)
2. **Command**: `word:improve` → "fix formatting — this was pasted from a web page"
3. Manually reapply heading styles to section titles
