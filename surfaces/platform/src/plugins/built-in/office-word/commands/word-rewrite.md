# Command: word:rewrite

## Trigger
"rewrite this paragraph", "improve this section", "make this more professional", "rewrite the selected text", "clean up this draft"

## Steps

1. **Read the selection or target paragraph**
```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.load("text,style");
  await context.sync();

  // If selection is empty, get the containing paragraph
  if (!selection.text.trim()) {
    const para = selection.paragraphs.getFirst();
    para.load("text,style");
    await context.sync();
    return { text: para.text, scope: "paragraph", style: para.style };
  }

  return { text: selection.text, scope: "selection", style: selection.style };
});
```

2. **AI rewrites with specified mode**

Rewrite prompt:
```
Rewrite the following text to be [mode].
Return ONLY the rewritten text — no explanation, no quotes, no prefix.
Preserve paragraph breaks where they exist.
Do not add new information or change the meaning.

Mode: [professional / concise / simpler / formal / casual]
Original:
[selectedText]
```

3. **Write back with tracked changes**
```javascript
await Word.run(async (context) => {
  // Enable tracking for all AI rewrites (redlinePreferred pattern)
  context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;
  await context.sync();

  const selection = context.document.getSelection();
  selection.insertText(rewrittenText, Word.InsertLocation.replace);
  await context.sync();
  return { success: true, originalLength: original.length, newLength: rewrittenText.length };
});
```

## Rewrite Modes
- **professional**: formal register, active voice, no contractions
- **concise**: remove filler words, shorten sentences, eliminate redundancy
- **simple**: plain language, grade 8 reading level, short sentences
- **formal**: legal/corporate register, passive where appropriate, full titles
- **casual**: conversational, contractions OK, friendly tone
- **executive**: bottom-line-first, quantified, action-oriented

## Output Format
- Show first 100 chars of rewritten text as preview
- Confirm tracked change was made
- Offer: "Say 'accept' to accept the change, or 'undo' to revert"

## Rules
- NEVER rewrite without tracked changes — every AI edit must be visible and reversible
- Do not expand scope: if a sentence was selected, only rewrite that sentence
- If word count changes dramatically (>50% shorter or longer), warn the user
