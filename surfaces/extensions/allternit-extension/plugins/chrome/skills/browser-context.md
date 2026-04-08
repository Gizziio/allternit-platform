---
name: browser-context
description: Understand and use the browser context — URL structure, domain, query params, navigation state, and page type. Trigger with "what site is this", "what's the URL", "am I logged in", "what page am I on", "navigate to", or any question about the browser state itself.
---

# Browser Context

Understands and uses the browser's current state — not just page content, but the
navigational and structural context of where the user is.

## Context Signals

### URL Analysis
- Identify the domain, TLD, subdomain
- Parse path segments (e.g. `/product/shoes/size-10` → product page, category: shoes)
- Parse query params (`?q=allternit` → search query is "allternit")
- Identify pagination (`?page=3`, `/p/3`)
- Detect UTM / tracking params (flag but don't expose to user unless asked)

### Domain Classification
- `github.com` → source control host
- `*.atlassian.net` → Jira/Confluence workspace
- `notion.so` → knowledge base
- `mail.google.com` → email client
- `calendar.google.com` → calendar
- `slack.com` → chat
- Known e-commerce, news, docs, SaaS → tag accordingly

### Authentication State Signals
- Presence of user avatar, account menu, or username in DOM → likely logged in
- Login/signup page detected → not authenticated
- Never attempt to extract passwords or session tokens

### Page Type Detection
- Article / blog post
- Product / listing page
- Documentation / reference
- Search results
- Dashboard / app
- Form / checkout
- Profile / about page
- Error page (404, 500)

## Usage in Other Skills

`browser-context` outputs a structured `PageContext` object used by all other skills:

```typescript
{
  url: string,
  domain: string,
  pageType: PageType,
  isAuthenticated: boolean | 'unknown',
  queryParams: Record<string, string>,
  pathSegments: string[],
}
```

Other skills should call this first when page type affects their behavior.
