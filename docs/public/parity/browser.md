# Browser parity

ChatGPT's browser can search, preview, discuss, and act on web pages inside a chat. Allternit splits this into lightweight `web_search`/`web_fetch`, isolated Playwright sessions in `@allternit/browser-tools`, and ACI for vision-based interactive browsing.

## Start browser work

Start an ACI run with an explicit goal and site allowlist:

```bash
curl -X POST http://127.0.0.1:8013/api/aci/run \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Compare the API examples with our implementation; do not submit forms",
    "model": "allternit-balanced",
    "allowedSites": ["docs.example.com"],
    "openLinksInBrowser": true,
    "autoVerify": false
  }'
```

The response supplies a `sessionId`. Watch `/api/aci/stream/{sessionId}`, stop with `POST /api/aci/stop/{sessionId}`, and approve or deny a pending action with `POST /api/aci/approve/{sessionId}?deny=true`.

## Keep browser tasks scoped

A narrow goal, host allowlist, clean session, and approval-required writes are the main scoping controls. State what the agent must not do (for example, submit a form), and end the run when its goal is complete.

## Search from the address bar

Allternit does not replace the user's address bar. The equivalent agent workflow uses `web_search` for discovery and `web_fetch` for readable page text.

## Preview a page

For rendered pages, create a browser-tools session, navigate, extract the DOM, or take a screenshot:

```typescript
import { createSession, navigate, extractContent, takeScreenshot } from '@allternit/browser-tools';

const session = await createSession({ headless: true, incognito: true });
await navigate(session.id, { url: 'https://example.com' });
const page = await extractContent(session.id, { maxLength: 20_000 });
const preview = await takeScreenshot(session.id, { fullPage: true });
```

## Comment on the page

There is no page-anchored comment UI. Ask the agent to review the extracted DOM or screenshot and identify elements by selector, visible text, or coordinates. Persist review comments in the chat, issue tracker, or source files.

## Styling feedback

Provide the target viewport and acceptance criteria; browser-tools supports DOM extraction, screenshots, hover, click, and viewport-specific sessions. ACI can provide visual feedback when the relevant surface is not represented in the DOM.

## Browser data

Browser-tools sessions are isolated Playwright contexts and can be incognito.

## Manage browsing history

The package supports back, forward, and reload within the active session, but Allternit does not provide a consumer browser-history manager. Chat/session history is managed separately by `gizzi` and the session API.

Self-hosting means page content, screenshots, cookies, and credentials stay on the selected host unless a configured model or external search provider receives them. Retention is deployment policy, not an OpenAI browsing-history setting. Close the browser session when finished and use a fresh/incognito context for sensitive tasks.

## Website permissions and confirmations

`@allternit/browser-tools` provides host allowlists, action approval, quarantine, and audit logging. ACI exposes explicit approve/deny endpoints. Configure network policy independently for agent shell tools:

```toml
[sandbox]
allow_network = true
allowed_domains = ["docs.example.com"]

[approval_policy]
mode = "ask"
```

Treat login, uploads, purchases, posts, form submissions, and destructive actions as confirmation boundaries.

## Limitations

- Allternit does not ship a ChatGPT-branded embedded browser or address-bar integration.
- `web_fetch` returns readable content, not a full interactive page; use browser-tools or ACI when rendering matters.
- Browser sessions do not automatically inherit personal browser cookies or history.
- Site defenses, CAPTCHAs, downloads, pop-ups, and cross-origin flows may require human intervention.
- ACI screenshots require a reachable computer-use gateway; browser-tools requires Playwright/browser binaries.

See [ACI](../aci/index.md) and the [Native Tool Belt](../tools/tool-belt.md).
