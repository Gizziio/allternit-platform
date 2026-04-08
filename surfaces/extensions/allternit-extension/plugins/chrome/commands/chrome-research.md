---
description: Deep-research a topic using the current page as a starting point
argument-hint: "[topic | question]"
---

# /chrome:research

> If you see unfamiliar tool placeholders or need to check which connectors are active, see [CONNECTORS.md](../CONNECTORS.md).

Use the current page as a launchpad for a thorough research session on any topic.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        RESEARCH                                  │
├─────────────────────────────────────────────────────────────────┤
│  STANDALONE (always works)                                       │
│  ✓ Extract and synthesize the page's core arguments             │
│  ✓ Identify unanswered questions the page raises                │
│  ✓ Map out key entities, people, companies, or concepts         │
│  ✓ Generate a follow-up reading list from cited sources         │
├─────────────────────────────────────────────────────────────────┤
│  SUPERCHARGED (when tools are connected)                         │
│  + ~~search: pull live supporting / conflicting sources         │
│  + ~~knowledge base: cross-reference with your existing notes   │
│  + ~~knowledge base: save the research brief when done          │
└─────────────────────────────────────────────────────────────────┘
```

## Output Format

```markdown
## Research Brief: [Topic]
**Based on**: [page title] · [URL]
**Generated**: [date]

### What the page argues
[2–3 sentences on the central thesis]

### Supporting evidence found
- [Key fact or data point with source]
- [Key fact or data point with source]

### Gaps and open questions
- [Question this page doesn't answer]
- [Conflicting claim or caveat]

### Related sources
- [Title](URL) — [one-line relevance note]
- [Title](URL) — [one-line relevance note]

### My synthesis
[2–3 sentences combining the above into a usable conclusion]
```

## If Connectors Available

If **~~search** is connected:
- Retrieve 3–5 corroborating or conflicting sources by query
- Flag any claims on the page contradicted by search results

If **~~knowledge base** is connected:
- Check for existing notes on this topic before starting
- Offer to save the completed research brief as a new page
