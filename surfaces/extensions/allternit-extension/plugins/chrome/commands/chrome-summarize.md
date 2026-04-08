---
description: Summarize the current page — TL;DR, key points, and highlights
argument-hint: "[tldr | bullets | detailed | eli5]"
---

# /chrome:summarize

> If you see unfamiliar tool placeholders or need to check which connectors are active, see [CONNECTORS.md](../CONNECTORS.md).

Summarize the active page in the format most useful to you.

## Modes

```
┌─────────────────────────────────────────────────────────────────┐
│                      SUMMARIZE                                   │
├─────────────────────────────────────────────────────────────────┤
│  STANDALONE (always works)                                       │
│  ✓ TL;DR — one sentence                                         │
│  ✓ Bullet points — key claims and facts                         │
│  ✓ Full summary — structured by section                         │
│  ✓ ELI5 — plain language for complex topics                     │
├─────────────────────────────────────────────────────────────────┤
│  SUPERCHARGED (when tools are connected)                         │
│  + ~~search: cross-check key claims against live sources        │
│  + ~~knowledge base: save summary directly to your notes        │
│  + ~~chat: post summary to a Slack channel or DM                │
└─────────────────────────────────────────────────────────────────┘
```

## Output Format

```markdown
## [Page Title]
**Source**: [domain] · [publish date if available]

**TL;DR**: [one sentence]

### Key Points
- [Point 1 — specific claim or fact from the page]
- [Point 2]
- [Point 3]
- [Point 4 — optional]
- [Point 5 — optional]

### Worth Noting
[Any caveats, counterarguments, or important context buried in the article]
```

## Arguments

- `/chrome:summarize tldr` — single sentence only
- `/chrome:summarize bullets` — bullet points only, no prose
- `/chrome:summarize detailed` — full section-by-section summary
- `/chrome:summarize eli5` — plain language, no jargon

## If Connectors Available

If **~~search** is connected:
- Cross-reference the top 2–3 claims against live search results
- Flag anything that appears contradicted or outdated

If **~~knowledge base** is connected:
- Offer to save the summary as a new page/entry
- Check if a note about this topic already exists

If **~~chat** is connected:
- Offer to post the summary to a channel or DM
