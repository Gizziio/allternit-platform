# Cookbook: Deep Research Session

## Goal
Start from a single webpage and produce a comprehensive, sourced research brief
saved to the user's knowledge base.

## Preconditions
- An active browser tab with readable content
- Optionally: ~~search connected for live source retrieval
- Optionally: ~~knowledge base connected to save the output

## Family
browser, knowledge

## Mode
assist

## Steps

1. **Read the page**
   - Invoke `page-reading` skill
   - Extract: title, author, date, URL, body text
   - Identify page type (article, documentation, product page, etc.)

2. **Extract core subject**
   - Identify the central topic, argument, or entity the page covers
   - List key entities mentioned (people, companies, products, concepts)

3. **Check existing notes** *(if ~~knowledge base connected)*
   - Query knowledge base for the central topic
   - If notes exist, surface them to the user before continuing
   - Ask: "You already have notes on [topic]. Should I add to those or start fresh?"

4. **Gather supporting sources** *(if ~~search connected)*
   - Run 2–3 targeted search queries based on key claims and entities
   - Retrieve top 3 results per query
   - Filter for relevance and recency

5. **Fact-check key claims**
   - Identify top 3–5 verifiable claims from the source page
   - If ~~search connected: cross-reference each claim
   - Mark each as: confirmed / unverified / contradicted

6. **Generate research brief**
   - Structure: Overview → Key Claims → External Context → Open Questions → Synthesis
   - Format: markdown, suitable for saving to ~~knowledge base
   - Length: 300–600 words

7. **Save** *(if ~~knowledge base connected)*
   - Preview the brief for the user
   - Confirm before saving
   - Return the link to the created note

## Expected Output
- A structured research brief (markdown)
- Confidence ratings on key claims
- Source list with relevance notes
- Link to saved note (if ~~knowledge base connected)

## Failure Handling
- **Page unreadable (paywall / heavy JS)**: extract what's visible, note limitation
- **Search returns no results**: skip fact-check step, note that claims are unverified
- **Knowledge base save fails**: offer clipboard fallback
