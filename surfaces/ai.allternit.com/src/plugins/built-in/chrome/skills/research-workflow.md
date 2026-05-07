---
name: research-workflow
description: Conduct structured research sessions using the current page as a starting point. Trigger with "research this topic", "find more about", "deep dive on", "help me understand [X]", "what else should I know about", or any request to go deeper than what the current page covers.
---

# Research Workflow

Turns any webpage into a launchpad for thorough, structured research. Combines
page content with connected search tools and the user's existing knowledge base.

## Research Modes

### Quick Explainer
User wants to understand something on the page they don't know.
- Extract the concept from the page
- Explain it in plain language
- Provide 2–3 related concepts for context
- Suggest 1–2 follow-up questions

### Fact Check
User wants to verify claims on the page.
- Identify specific verifiable claims (statistics, dates, attributions)
- If ~~search is connected: run targeted queries for each claim
- Flag confirmed, unverified, or contradicted claims with source links
- Summarize confidence level

### Topic Deep Dive
User wants comprehensive understanding of the page's subject.
- Extract the page's core argument or subject
- Identify key entities (people, companies, concepts, events)
- Build a structured brief covering: what, why, who, when, implications
- If ~~search is connected: pull supporting sources and counterarguments
- If ~~knowledge base is connected: cross-reference with existing notes

### Competitive / Comparative
User wants to compare what's on the page to alternatives.
- Identify the subject being evaluated (product, company, idea)
- Extract evaluative claims (pros, cons, specs, prices)
- If ~~search is connected: find comparable alternatives
- Generate a structured comparison table

## Research Brief Output

```markdown
## Research Brief: [Subject]
**Source page**: [title] · [URL]
**Date**: [today]

### Overview
[2–3 sentences: what is this and why does it matter]

### Key Claims from Source
- [Claim 1] — [confidence: verified/unverified/contradicted]
- [Claim 2]

### External Context (if ~~search connected)
- [Supporting source: title + URL + 1-line note]
- [Conflicting source: title + URL + 1-line note]

### Open Questions
- [What the source doesn't answer]

### Synthesis
[Your 2–3 sentence conclusion]
```

## Knowledge Base Integration

If ~~knowledge base is connected:
- Before starting, check if the user already has notes on this topic
- Offer to merge new findings with existing notes
- Suggest tags consistent with the user's existing taxonomy
