# Chrome extension parity

The ChatGPT Chrome extension brings the active tab, selected text, files, and website actions into ChatGPT. Allternit does not currently ship the optional `@allternit/extension` package: the compatibility module in `gizzi-code` exposes no browser MCP tools and fails with an installation message if explicitly activated. The extension-specific experience is therefore **Not applicable / roadmap**.

## Set up the Chrome extension

**Roadmap.** There is no supported extension to install.

## Use ChatGPT from Chrome

There is no Allternit toolbar chat. Use the Allternit web client alongside Chrome. For automation, `@allternit/browser-tools` supports Chromium through Playwright.

## Start a Chrome task from ChatGPT

There is no extension handoff. Start an isolated browser task through [ACI](../aci/index.md), providing an explicit goal and allowed-site list.

## Bring tabs and selected text into a chat

There is no automatic active-tab or selection bridge. Copy the URL/text into chat, use `web_fetch`, or supply an explicit URL to browser-tools. This avoids ambient collection from unrelated tabs.

## Ask about a YouTube video

There is no YouTube-specific extension context. Give Allternit the video URL plus a transcript/captions file or accessible page text. Visual/audio understanding of arbitrary playback in the user's Chrome profile remains roadmap; do not claim that `web_fetch` can watch a video.

## Upload files

Uploads are supported by the platform, not by a Chrome extension. `POST /api/v1/uploads` accepts a JSON envelope containing `name`, `mediaType`, and `dataBase64` (maximum 20 MB decoded) and returns an `uploadId` and fetchable URL:

```bash
DATA=$(base64 < notes.txt | tr -d '\n')
curl -s http://127.0.0.1:8013/api/v1/uploads \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"notes.txt\",\"mediaType\":\"text/plain\",\"dataBase64\":\"$DATA\"}"
```

Clients can attach the returned URL as a file content part in an agent-chat request.

## Control website access

Because there is no extension, Chrome host-permission toggles and extension-managed allowed/blocked lists do not apply. Scope ACI with `allowedSites`, configure `sandbox.allowed_domains`, and use browser-tools host allowlists and action approvals instead. These policies control agent access; they do not change Chrome's own permissions.

## Data and security

Allternit's automation uses isolated sessions rather than silently reading every open tab. In a self-hosted deployment, browser state and screenshots reside on the chosen host, subject to its retention and audit configuration. Page data sent to a configured model provider, search provider, or MCP server follows that provider's policy. Never assume that self-hosting prevents an explicitly configured external provider from receiving prompt context.

## What OpenAI stores from browsing

**Not applicable.** Allternit does not send browser data to OpenAI unless the operator deliberately selects an OpenAI model/service. Storage is determined by the Allternit host and every configured downstream provider. Operators should document screenshot, audit-log, upload, session, and model-provider retention for their deployment.

## Manage allowed and blocked websites

Use positive allowlists close to the execution boundary:

```toml
[sandbox]
allow_network = true
allowed_domains = ["developer.mozilla.org", "github.com"]
```

For ACI, pass the same scope in `allowedSites` on every run. A first-class Chrome-extension allow/block UI remains roadmap.
