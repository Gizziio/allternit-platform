# Command: word:template

## Trigger
"fill in this template", "populate the template fields", "fill out this form", "complete the template with these details", "use this as a template for [X]"

## Steps

1. **Detect template fields** — content controls and/or placeholder text patterns
```javascript
await Word.run(async (context) => {
  // Check for content controls (structured templates)
  const controls = context.document.contentControls;
  controls.load("items/tag,items/title,items/text,items/type");
  await context.sync();

  const hasControls = controls.items.length > 0;

  // Also check for {{placeholder}} or [PLACEHOLDER] patterns in body text
  const body = context.document.body;
  body.load("text");
  await context.sync();

  const placeholderPattern = /\{\{[^}]+\}\}|\[[A-Z_\s]+\]/g;
  const textPlaceholders = [...(body.text.matchAll(placeholderPattern) || [])]
    .map(m => m[0]);

  return {
    contentControls: controls.items.map(c => ({ tag: c.tag, title: c.title, currentText: c.text })),
    textPlaceholders: [...new Set(textPlaceholders)],
    hasControls,
  };
});
```

2. **Ask AI or user to provide field values**

If user provided values inline:
```
"Fill the template with: ClientName = Acme Corp, Date = April 7 2026, ProjectTitle = Q1 Review"
```

If not provided, prompt: "I found [N] template fields. What values should I use for: [field list]?"

3. **Fill content controls** using content-controls skill:
```javascript
await Word.run(async (context) => {
  const controls = context.document.contentControls;
  controls.load("items/tag,items/title");
  await context.sync();

  for (const control of controls.items) {
    const key = control.tag || control.title;
    const value = fieldValues[key];
    if (value) {
      control.insertText(value, Word.InsertLocation.replace);
    }
  }
  await context.sync();
  return { filled: Object.keys(fieldValues).length };
});
```

4. **Replace text placeholders** using search/replace:
```javascript
await Word.run(async (context) => {
  for (const [placeholder, value] of Object.entries(fieldValues)) {
    // Match both {{CompanyName}} and [COMPANY NAME] patterns
    const variants = [
      `{{${placeholder}}}`,
      `[${placeholder.toUpperCase()}]`,
      `[${placeholder}]`,
    ];

    for (const variant of variants) {
      const results = context.document.body.search(variant, { matchCase: false });
      results.load("items");
      await context.sync();

      for (const result of results.items) {
        result.insertText(value, Word.InsertLocation.replace);
        await context.sync();
      }
    }
  }
});
```

## Output Format
- List fields found: content controls + text placeholders
- Confirm fills: "[N] fields populated"
- Flag unfilled fields: "2 fields not filled: [ClientSignature], [ContractNumber]"

## Common Template Field Patterns Detected
| Pattern | Example |
|---|---|
| `{{FieldName}}` | `{{ClientName}}` |
| `[FIELD NAME]` | `[COMPANY NAME]` |
| Content control (tagged) | Tag: `ClientName` |
| Content control (titled) | Title: "Client Name" |
