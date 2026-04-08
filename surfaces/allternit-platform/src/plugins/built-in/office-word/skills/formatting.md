# Skill: Text and Paragraph Formatting

## Trigger
Use this skill when applying font formatting, paragraph spacing, indentation, or section formatting.

## Font Formatting on a Range
```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.font.bold = true;
  selection.font.italic = false;
  selection.font.size = 12;
  selection.font.name = "Calibri";
  selection.font.color = "#2A1F16"; // Allternit sand-900
  selection.font.underline = Word.UnderlineType.single; // or .none, .double
  await context.sync();
});
```

## UnderlineType Reference
```javascript
Word.UnderlineType.none
Word.UnderlineType.single
Word.UnderlineType.word        // underline words only, not spaces
Word.UnderlineType.double
Word.UnderlineType.dotted
Word.UnderlineType.hidden
Word.UnderlineType.thick
Word.UnderlineType.dashLine
Word.UnderlineType.dotDashLine
Word.UnderlineType.dotDotDashLine
Word.UnderlineType.waved
```

## Paragraph Spacing
```javascript
await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items");
  await context.sync();

  for (const para of paragraphs.items) {
    para.lineSpacing = 1.5;       // line spacing multiplier
    para.spaceAfter = 8;          // points after paragraph
    para.spaceBefore = 0;         // points before paragraph
  }
  await context.sync();
});
```

## Indentation
```javascript
para.firstLineIndent = 0;    // no first-line indent (modern style)
para.leftIndent = 36;        // 0.5 inch left indent (36pt)
para.rightIndent = 0;
```

## Apply Heading Style with Font Override
```javascript
await Word.run(async (context) => {
  const para = context.document.body.paragraphs.getFirst();
  para.style = "Heading 1";
  para.font.color = "#2A1F16"; // override style color
  para.font.name = "Calibri";
  await context.sync();
});
```

## Apply Allternit Document Theme
```javascript
// Standard formatting for Allternit-branded Word documents
const ALLTERNIT_WORD = {
  bodyFont:       "Calibri",
  bodySize:       11,
  bodyColor:      "#2A1F16",
  heading1Size:   20,
  heading2Size:   16,
  heading3Size:   13,
  headingColor:   "#2A1F16",
  accentColor:    "#B08D6E",
  lineSpacing:    1.15,
  spaceAfterPara: 8,
};

await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items/style");
  await context.sync();

  for (const para of paragraphs.items) {
    if (para.style === "Normal" || para.style === "Body Text") {
      para.font.name = ALLTERNIT_WORD.bodyFont;
      para.font.size = ALLTERNIT_WORD.bodySize;
      para.font.color = ALLTERNIT_WORD.bodyColor;
      para.lineSpacing = ALLTERNIT_WORD.lineSpacing;
      para.spaceAfter = ALLTERNIT_WORD.spaceAfterPara;
    }
  }
  await context.sync();
});
```

## Clear All Direct Formatting
```javascript
// Remove manual formatting and revert to style defaults
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.font.bold = false;
  selection.font.italic = false;
  selection.font.underline = Word.UnderlineType.none;
  selection.font.color = "#000000"; // or set to style default
  await context.sync();
});
```

## Safety Rules
- Font size is in points (pt): 11pt = standard body, 12pt = readable, 14pt = large
- `lineSpacing` is a multiplier (1.0 = single, 1.5 = one-and-half, 2.0 = double)
- Applying formatting to the whole body at once is slow for large documents — prefer applying to paragraphs by style
- Setting `para.style` resets all direct formatting — apply manual overrides AFTER setting the style
