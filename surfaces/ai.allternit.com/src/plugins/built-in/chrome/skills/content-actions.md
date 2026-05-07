---
name: content-actions
description: Save, share, copy, or send page content to connected tools. Trigger with "save this", "send to Notion", "copy as markdown", "post to Slack", "share this", "add to my notes", "create a ticket from this", or any request to do something with the page content beyond reading it.
---

# Content Actions

Handles all outbound actions — saving, sharing, posting, and syncing page content
to connected tools or the clipboard.

## Action Types

### Save to ~~knowledge base (Notion, Confluence, etc.)
- Create a new page with: title, URL, summary, key points, tags, saved date
- Optionally append to an existing page/database
- Respect the user's preferred Notion workspace/database if previously configured
- Never overwrite without confirmation

### Post to ~~chat (Slack, Teams)
- Generate a concise share message: title + URL + 1-line summary
- Prompt for channel or DM target before posting
- Offer thread format (for long content) vs single message

### Create in ~~project tracker (Linear, Jira)
- Map page content to issue fields: title, description, labels
- For bug pages: pre-fill with URL, steps, expected vs actual
- For feature requests: extract requirements as acceptance criteria
- Always preview the ticket before creating

### Add to ~~calendar (Google Calendar)
- Extract date/time/location from page
- Pre-fill event title, description, and location
- Show preview before creating — never create silently

### Copy to clipboard
- Markdown: `## [Title]\n**URL**: ...\n\n[Summary]`
- Plain text: clean version without markdown formatting
- JSON: structured extraction of key page data
- Always available — no connectors needed

## Output Confirmation Pattern

For all actions that write to external tools:
1. Show a preview of what will be created/sent
2. Ask "Create this?" before executing
3. Confirm success with a link or reference to the created item
4. Never silently execute — always confirm with the user first
