# Use-case playbooks

These playbooks are production-ready reference implementations you can adapt for common AI applications on Allternit. Each playbook includes a goal, system prompt, tool configuration, and evaluation checklist.

## 1. Customer support triage

**Goal:** Classify incoming support tickets, draft a first response, and escalate when sentiment is strongly negative.

### System prompt

```text
You are a support triage assistant. Read the ticket, classify the issue into one of:
Billing, Technical, Account, Feature Request. Draft a brief, empathetic first response.
If sentiment is strongly negative or the issue mentions "legal", "lawsuit", or "regulator",
set escalate to true and do not draft a response.
```

### Tool

Use a structured output schema:

```json
{
  "type": "object",
  "properties": {
    "category": { "enum": ["Billing", "Technical", "Account", "Feature Request"] },
    "sentiment": { "enum": ["positive", "neutral", "negative", "strongly_negative"] },
    "escalate": { "type": "boolean" },
    "response": { "type": "string" }
  },
  "required": ["category", "sentiment", "escalate", "response"]
}
```

### Allternit request

```bash
curl https://api.allternit.com/v1/chat/completions \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [
      { "role": "system", "content": "You are a support triage assistant..." },
      { "role": "user", "content": "I was double charged this month and your dashboard will not load." }
    ],
    "response_format": { "type": "json_object" }
  }'
```

### Evaluation checklist

- [ ] Category accuracy > 90% on a labeled test set
- [ ] No drafted response when `escalate` is true
- [ ] Response tone matches brand guidelines

## 2. Legal document summarization

**Goal:** Summarize contracts or legal memos with structured risk flags.

### System prompt

```text
You are a legal summarization assistant. Produce a 3-bullet summary, list key parties,
flag any uncapped liability or indemnification clauses, and quote the relevant passage
for each flag.
```

### Tool

Attach the document via `/v1/files` and reference it as a `file` message content:

```json
{
  "messages": [
    { "role": "user", "content": [
      { "type": "file", "file": { "file_id": "file_abc123" } },
      { "type": "text", "text": "Summarize this contract and flag risky clauses." }
    ]}
  ]
}
```

### Evaluation checklist

- [ ] Summary covers scope, term, and payment
- [ ] Risk flags include supporting quotes
- [ ] No hallucinated clauses

## 3. Code review assistant

**Goal:** Review a diff for bugs, security issues, and style violations.

### System prompt

```text
You are a code reviewer. Review the provided diff. Output findings as JSON with
severity (info/warning/critical), file, line, and a suggested fix. If no issues are
found, return an empty findings array.
```

### Tool configuration

Use `tool_choice: none` to force structured JSON output without tool calls, or define a
`code_review` tool in the tool registry.

### Evaluation checklist

- [ ] Catches the seeded security issue
- [ ] Does not flag false positives on style-only changes
- [ ] Suggested fixes compile or are syntactically plausible

## 4. Data extraction from forms

**Goal:** Extract structured fields from PDF or image forms.

### System prompt

```text
Extract the requested fields from the document. Return only valid JSON. If a field is
missing or unreadable, use null.
```

### Allternit request

Upload the file, then request a JSON schema via `response_format`:

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "invoice_extraction",
      "schema": {
        "type": "object",
        "properties": {
          "invoice_number": { "type": "string" },
          "date": { "type": "string" },
          "total": { "type": "number" },
          "line_items": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "description": { "type": "string" },
                "quantity": { "type": "integer" },
                "amount": { "type": "number" }
              }
            }
          }
        },
        "required": ["invoice_number", "date", "total"]
      }
    }
  }
}
```

### Evaluation checklist

- [ ] Field-level F1 > 0.9
- [ ] Dates normalized to ISO-8601
- [ ] Totals parsed as numbers, not strings

## 5. RAG Q&A over internal docs

**Goal:** Answer employee questions using an internal knowledge base.

### Architecture

1. Index documents into an Allternit memory store (`/beta/memory-stores`).
2. Query the memory store to retrieve top-k passages.
3. Pass passages into the model context with citations.

### System prompt

```text
Answer the question using only the provided passages. Cite each passage with [index].
If the answer is not in the passages, say so.
```

### Evaluation checklist

- [ ] Answers are grounded in retrieved passages
- [ ] Citations are accurate
- [ ] Refuses appropriately when context is insufficient

## Next steps

- [Model migration guide](./model-migration.md)
- [Glossary](../glossary.md)
- [API reference](../api/reference.md)
