# Cookbook: Bulk Content Extraction

## Goal
Extract all structured data from a page (tables, lists, contacts, prices) into a
clean portable format and deliver it to the user's preferred destination.

## Preconditions
- An active browser tab with structured content (tables, lists, or repeated elements)
- Optionally: ~~knowledge base or ~~spreadsheet connected for saving

## Family
browser, knowledge

## Mode
extract

## Steps

1. **Classify page content**
   - Invoke `browser-context` skill to identify page type
   - Invoke `web-extraction` skill to scan for extractable content types
   - Report what was found: "I found 3 tables, 2 lists, and 14 contact entries"

2. **Confirm extraction scope**
   - If multiple content types found, ask which to extract
   - If `page.selection` is set, confirm: "Extract only from your selection?"
   - Default: extract all if user said "extract everything"

3. **Run extraction**
   - Tables → markdown table + row count
   - Lists → bulleted/numbered with nesting preserved
   - Contacts → name / title / email / company / phone (where present)
   - Prices → item / price / currency / context
   - Dates → date / event name / context

4. **Quality check**
   - Count extracted items vs visible items on page
   - Flag any ambiguous or partially-extracted entries with `?`
   - Note any content behind pagination or lazy-load not captured

5. **Deliver output**
   - Show preview in sidebar
   - Offer: clipboard (markdown), JSON download, or save to connected tool
   - If ~~knowledge base: save as structured database entry
   - If ~~spreadsheet: push table rows directly

## Expected Output
- Structured extraction in markdown, JSON, or CSV
- Row/item count with completeness note
- Destination confirmation (clipboard or connected tool)

## Failure Handling
- **Dynamic content (React/Vue SPA)**: extract from visible DOM, note incomplete render
- **Paywalled content**: extract visible teaser only, note paywall
- **Complex merged tables**: flatten with best-effort, flag with `[merged cell]` marker
