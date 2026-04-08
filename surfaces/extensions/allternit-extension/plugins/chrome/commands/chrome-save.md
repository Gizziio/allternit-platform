---
description: Save this page or extracted content to a connected tool
argument-hint: "[notion | linear | slack | calendar | clipboard]"
---

# /chrome:save

> If you see unfamiliar tool placeholders or need to check which connectors are active, see [CONNECTORS.md](../CONNECTORS.md).

Clip, save, or share the current page (or a selection) to wherever you need it.

## What Can Be Saved

```
┌─────────────────────────────────────────────────────────────────┐
│                         SAVE                                     │
├─────────────────────────────────────────────────────────────────┤
│  STANDALONE (always works)                                       │
│  ✓ Copy a clean summary to clipboard                            │
│  ✓ Generate a shareable brief (title + URL + summary)           │
│  ✓ Export extracted content as markdown or JSON                 │
├─────────────────────────────────────────────────────────────────┤
│  SUPERCHARGED (when tools are connected)                         │
│  + ~~knowledge base: save as a new page with metadata           │
│  + ~~project tracker: create a ticket with the page as context  │
│  + ~~chat: post a summary to a channel or DM                    │
│  + ~~calendar: create an event from a date/time on the page     │
│  + ~~email: draft an email with the page as context             │
└─────────────────────────────────────────────────────────────────┘
```

## Arguments

- `/chrome:save notion` — save to Notion with title, URL, summary, and tags
- `/chrome:save linear` — create a Linear issue with page context
- `/chrome:save slack` — post summary to a Slack channel (will prompt for channel)
- `/chrome:save calendar` — create a calendar event from dates found on the page
- `/chrome:save clipboard` — copy clean markdown summary to clipboard

## Default Save Format (to ~~knowledge base)

```markdown
# [Page Title]

**URL**: [page URL]
**Saved**: [date]
**Source**: [domain]

## Summary
[3–5 sentence summary]

## Key Points
- [point]
- [point]

## Tags
[auto-suggested tags based on content]
```

## If No Connectors Available

Falls back to clipboard: copies a clean markdown summary of the page, ready to paste
anywhere. Always works, no setup required.
