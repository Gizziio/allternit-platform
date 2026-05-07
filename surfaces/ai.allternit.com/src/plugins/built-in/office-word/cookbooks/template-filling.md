# Cookbook: Fill a Document Template

## Prerequisites
- A template document is open (contract, proposal, brief, NDA, etc.)
- Templates may use content controls, `{{placeholder}}` syntax, or `[PLACEHOLDER]` text

---

## Step 1: Detect All Template Fields

**Command**: `word:template` → "show me all the fields in this template"

The plugin scans for:
1. **Tagged content controls** — structured fields with developer tags
2. **`{{FieldName}}`** — double-brace placeholder syntax
3. **`[FIELD NAME]`** — bracket placeholder syntax
4. **Bold placeholder text** — common in legal templates (e.g. `[___________]`)

Output:
```
Found 12 template fields:
Content controls: ClientName, ProjectTitle, EffectiveDate, ContractValue
Text placeholders: {{Jurisdiction}}, {{NoticeEmail}}, [COMPANY ADDRESS], [SIGNATORY NAME]
```

---

## Step 2: Provide Field Values

**Option A: Inline in message**
```
word:template → "fill with: 
ClientName = Acme Corporation
ProjectTitle = Q2 Strategy Advisory
EffectiveDate = April 7, 2026
ContractValue = $75,000
Jurisdiction = Delaware
NoticeEmail = legal@acme.com"
```

**Option B: From structured data** (if you have a JSON/CSV of field values):
```
word:template → "fill template using these values: [paste JSON here]"
```

The plugin maps provided values to detected fields (fuzzy match for minor name differences).

---

## Step 3: Fill the Template

```javascript
// Content controls filled first (most reliable)
await Word.run(async (context) => {
  const controls = context.document.contentControls;
  controls.load("items/tag,items/title,items/text");
  await context.sync();

  for (const control of controls.items) {
    const key = control.tag || control.title;
    const value = fieldValues[key] ?? fieldValues[normalizeKey(key)];
    if (value !== undefined) {
      control.insertText(value, Word.InsertLocation.replace);
    }
  }
  await context.sync();
});

// Text placeholders filled via search/replace
await Word.run(async (context) => {
  for (const [key, value] of Object.entries(fieldValues)) {
    for (const pattern of [`{{${key}}}`, `[${key}]`, `[${key.toUpperCase()}]`]) {
      const results = context.document.body.search(pattern, { matchCase: false });
      results.load("items");
      await context.sync();
      for (const r of results.items) {
        r.insertText(value, Word.InsertLocation.replace);
        await context.sync();
      }
    }
  }
});
```

---

## Step 4: Review Unfilled Fields

The plugin reports any fields it couldn't fill:

```
⚠ Unfilled fields:
- [COMPANY ADDRESS] — no value provided for 'COMPANY ADDRESS'
- {{SignatoryTitle}} — no value for 'SignatoryTitle'

To fill: "word:template → fill COMPANY ADDRESS = 100 Main St, New York, NY 10001"
```

---

## Step 5: Verify and Finalize

**Command**: `word:summarize` → "summarize the key details of this now-filled document"

Check summary for accuracy against your intended values.

**Command**: `word:structure` → "confirm no placeholder text remains"

Scan for remaining `{{`, `}}`, `[`, `]` bracket patterns.

---

## Common Template Types

### NDA Template Fields
```
Party1Name, Party2Name, EffectiveDate, Purpose, Term, Jurisdiction
```

### Service Agreement Fields  
```
ClientName, ServiceProviderName, EffectiveDate, ServicesDescription,
FeeAmount, PaymentTerms, TerminationNotice, GoverningLaw
```

### Project Proposal Fields
```
ClientName, ProjectTitle, ProjectDate, ProposalDate, ScopeOfWork,
Timeline, TotalBudget, AuthorName, AuthorTitle, CompanyName
```

---

## Tips
- Save a blank copy of the template before filling (File → Save As → "Template_BLANK")
- For recurring fills (same client, different projects), keep a JSON file of standard field values
- Date formats: spell out months (April 7, 2026) rather than numeric (04/07/26) to avoid ambiguity
- After filling, remove any content control formatting if needed: Right-click control → Remove Content Control
