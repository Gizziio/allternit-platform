---
name: page-reading
description: Read and understand the content of the active browser tab. Trigger with "what does this page say", "what is this about", "explain this page", "who wrote this", "when was this published", or any question about the page's content, author, or topic.
---

# Page Reading

Core skill for understanding active browser tab content. Automatically invoked whenever the user asks about what's on the current page.

## Available Page Context

- `page.title` — document title
- `page.url` — full URL including path and query params
- `page.text` — extracted body text (cleaned, no ads/nav)
- `page.meta.description` — meta description
- `page.meta.author` — byline if present
- `page.meta.publishDate` — publish or modified date if present
- `page.meta.ogImage` — social preview image URL
- `page.selection` — highlighted text (if user selected before asking)
- `page.links[]` — all hyperlinks on page

## Reading Strategies

### For articles / blog posts
- Lead with author, publication, and date
- Identify the thesis in the first 2 paragraphs
- Note any data, statistics, or direct quotes
- Summarize conclusion or call to action

### For product / landing pages
- Identify what the product does (one sentence)
- List pricing tiers if present
- Note CTAs and target audience signals

### For documentation / reference pages
- Identify the subject and version/date
- Extract the most relevant section to the user's question
- Note prerequisites or dependencies mentioned

### For search results / listings
- Enumerate results with title + description
- Filter to most relevant by user intent
- Note pagination state

### For forms / checkout pages
- Identify required vs optional fields
- Note any validation requirements mentioned
- Flag any irreversible actions (payment, submission)

## Selection Priority

If `page.selection` is non-empty, restrict all analysis to the selected text only.
Do not summarize the rest of the page unless explicitly asked.
