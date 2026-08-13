# Multilingual support guidance

Allternit is language-agnostic at the API layer: you can send prompts, system messages, and documents in any language the underlying model supports. This page gives practical guidance for building reliable multilingual applications.

## What Allternit handles automatically

- **UTF-8 end-to-end** — Requests, responses, file uploads, and tool inputs are treated as UTF-8.
- **Locale-agnostic tokenization** — Token counts are computed by the provider tokenizer, not a language-specific heuristic.
- **Provider routing by language support** — If a model family is known to underperform for a target language, the model registry flags it as a limitation.

## Recommendations for prompts

### 1. Write system instructions in the target language

Models follow the dominant language of the system prompt. If you want French output, write the system message in French.

```json
{
  "model": "openai/gpt-4o",
  "messages": [
    { "role": "system", "content": "Tu es un assistant utile. Réponds en français." },
    { "role": "user", "content": "Explique le RAG en deux phrases." }
  ]
}
```

### 2. Be explicit about output language

Even when the input is mixed, state the desired output language:

```
"Detect the language of the user message and respond in the same language."
```

### 3. Avoid culture-specific assumptions in JSON schemas

When using structured outputs, keep enum values and field descriptions neutral:

```json
{
  "name": "sentiment",
  "schema": {
    "type": "object",
    "properties": {
      "label": { "enum": ["positive", "neutral", "negative"] },
      "confidence": { "type": "number" }
    }
  }
}
```

### 4. Test with right-to-left (RTL) scripts

Arabic, Hebrew, and Persian mix directionality. Verify that tool arguments, citations, and rendered UI preserve bidirectional text correctly.

## Localization for docs and SDK messages

- SDK error messages from Allternit are returned in English by default. Localized error strings are on the roadmap.
- Documentation is published in English first. Community translations are accepted under `docs/public/i18n/`.

## Multilingual tooling

Use the built-in `web_search` tool to retrieve locale-specific context, and instruct the model to cite sources in the requested language.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Model switches to English mid-conversation | System prompt is English-only | Include target-language instruction in every system message |
| Tool arguments parsed incorrectly | JSON Schema has ASCII-only examples | Add Unicode examples to `description` fields |
| Citations garbled | Client font/encoding issue | Ensure your renderer supports the script |

## Related resources

- [Glossary](./glossary.md)
- [API reference](./api/reference.md)
- [Build a tool guide](./guides/build-a-tool.md)
