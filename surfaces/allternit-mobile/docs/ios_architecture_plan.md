# Allternit iOS — Architecture & Parity Plan (v2)

**Status:** SUPERSEDES the 2026-07-17 scaffolding plan. **Amended 2026-07-18 (v2.1): wire-protocol correction below takes precedence over §2.**
**Date:** 2026-07-18 · **Basis:** code audit of the v1 scaffold + deep research on existing open-source iOS AI apps, libraries, and the Claude iOS feature set (all verified against live sources on 2026-07-18).

---

## 2.0 ⚠️ WIRE-PROTOCOL CORRECTION (v2.1, verified 2026-07-18)

Liveness verification found that §2's `replies-runtime` contract is **scaffold-only**: `/v1/replies` is an in-memory Express app (`api/services/replies-runtime`, port 4200), not deployed (absent from `fly.toml`/`wrangler.toml`/docker-compose), not mounted in any gateway route table, and called by zero code in the web app. §2's contract remains the **future** target (the typed contract package is real and well-designed); the **live** platform protocol — what the web app uses today, and what this client must speak — is:

| Stage | Endpoint (allternit-api, dev `:8013`, Clerk `auth_middleware`) | Status |
|---|---|---|
| Create session | `POST /api/v1/agent-sessions` — `{name, origin_surface:"chat", session_mode:"regular", metadata}` → `ses_*` id | LIVE |
| Send + stream | `POST /api/agent-chat` — `{chatId, message, runtimeModelId?, …}` → SSE-style `data: {json}` lines on the POST response body (bridges to Gizzi daemon) | LIVE |
| Stream frames | `{"type":"message_start", messageId, modelId, runtimeModelId}` · `{"type":"content_block_delta", messageId, partId, delta:{type:"text_delta", text}}` · `{"type":"finish", status:"complete"|"error"}` · tolerate `{chunk, chunk_type:"text|tool_call|tool_result|error|done"}`, `content_block_start` (tool_use), `artifact` events, `[DONE]` | LIVE (per `cmd/allternit-api/src/v1_routes.rs:247-388`, parser reference `native-agent-api.ts:635-807`) |
| Session sync | `GET /api/v1/agent-sessions/sync` (EventSource; session/message/part events) — DEFER, not needed for v1 chat | LIVE |
| History list | `GET /api/v1/agent-sessions` | LIVE |
| History messages | `GET /api/v1/agent-sessions/:id/messages` | LIVE |
| Stop | `POST /api/v1/agent-sessions/:id/abort` | LIVE |
| Attachments | **None** — web composer holds base64 data-URLs and drops them on send; no upload endpoint exists | ABSENT (backend gap) |
| `/api/v1/conversations*` + `/fork` | Mounted on allternit-api but unused by web chat (fork UI effectively unreachable) | MOUNTED, UNUSED |

Consequences for the client: networking is built on **agent-sessions + agent-chat** (this section); the `ReplyEvent` Swift models from Phase 0 are **kept but quarantined as the future replies-runtime adoption path**. Tenant/org headers (`X-Allternit-*`) are **desktop-shell-only** — mobile web/native sends only `Authorization: Bearer <Clerk JWT>`; the earlier open question is resolved: no tenant headers from iOS. Attachments are deferred until the platform gets an upload endpoint — do not invent one client-side.

---

## 1. Goal & Strategy

Build a native SwiftUI iOS client for the Allternit platform with UX parity to the Claude iOS app.

**Research conclusion:** No open-source native iOS clone of the Claude app exists. The fastest viable path is:

1. **Study (don't track)** the best open-source SwiftUI chat apps for proven patterns.
2. **Assemble a small, verified library stack** (all actively maintained, permissive licenses).
3. **Build the artifacts pane ourselves** — no off-the-shelf component exists, and our backend gives us a structural advantage here (§4).

---

## 2. Platform Contracts (verified in the codebase — do not reinvent)

The v1 scaffold invented endpoints that do not exist. The real contracts, confirmed in `api/services/replies-runtime` and `packages/@allternit/replies-contract`:

### Replies / Streaming (SSE)
| Call | Contract |
|---|---|
| `POST /v1/replies` | Body: prompt/conversation ref → `201 { id, runId, status, conversationId }` |
| `GET /v1/replies/:replyId/stream` | SSE. Frames: `data: {ReplyEvent JSON}\n\n`. Terminal events: `reply.completed`, `reply.failed`. Late subscribers get a synthetic terminal event if already finished. |
| `GET /v1/replies/:replyId` | Current reduced reply state |
| `POST /v1/replies/:replyId/cancel` | Cancel an in-flight reply |

**`ReplyEvent` wire types** (`packages/@allternit/replies-contract/src/index.ts:210`):
`reply.started`, `reply.item.added`, `reply.text.delta`, `reply.reasoning.delta`, `tool_call.started` / `.progress` / `.completed` / `.failed`, **`artifact.created`**, `citation.added`, `mcp_app.created`, `code.added`, `terminal.added`, `plan.created`, `plan.updated`, `file_op.added`, `reply.item.done`, `reply.completed`, `reply.failed`.

→ **Generate the Swift models from this contract package** (single source of truth; the client must never hand-model these).

### Conversations (REST)
Web client reference: `surfaces/ai.allternit.com/src/api/conversations.ts` → base `/api/v1/conversations`
- `GET ""` list → envelope `{ object: "list", data: [...] }` (NOT a bare array)
- `POST ""` create → full `ConversationRecord` (`id`, `title: string|null`, `message_count`, …)
- `GET /:id/messages` list, `POST /:id/messages` add
- `POST /:id/fork` — branching (powers edit/retry UX)
- Backend routers: `api/services/replies-runtime/src/conversations.router.ts`

### Auth
- Clerk JWT, sent as `Authorization: Bearer <token>`. The web injects it via `fetch-interceptor.ts` using Clerk's `getToken()` — iOS does the same via the Clerk SDK.
- Desktop additionally sends `X-Allternit-User-Id` / `X-Allternit-Tenant-Id` (org context). **Open question: whether the gateway requires tenant headers from mobile clients — decide in Phase 0.**
- **Gateway host: UNVERIFIED.** v1 hardcoded `https://api.allternit.com/api/v1`. Dev gateway is `127.0.0.1:8013`; web prod uses same-origin/Cloudflare. Phase 0 must confirm the public host for mobile.

---

## 3. Verified Technology Decisions

| Concern | Decision | Package / source | Verified status (2026-07-18) |
|---|---|---|---|
| Deployment target | **iOS 17** (was 16) | — | Required by Clerk 1.x + exyte/Chat; Claude app itself requires iOS 18 |
| Auth | **Clerk official iOS SDK** | `github.com/clerk/clerk-ios` **1.3.2** → products `ClerkKit`, `ClerkKitUI` | MIT, released 2026-07-14, very active. Handles OAuth/Apple Sign-In, Keychain, token refresh; `session.getToken()` for backend calls. iOS 16 support died with the 0.x line (Sep 2024) — do NOT hand-roll `ASWebAuthenticationSession` |
| Chat feed | `exyte/Chat` with custom `messageBuilder`, or plain `LazyVStack` for full control | `github.com/exyte/Chat` 2.1.4+ | MIT, iOS 17+, main branch active 2026-07-17. Streaming = mutate message model; no built-in typewriter needed |
| Streaming markdown | **MarkdownView v3** (`StreamingMarkdownReader` — incremental, background parsing) | `github.com/LiYanan2004/MarkdownView` **3.0.0** | MIT, released 2026-07-05, iOS 16+. Purpose-built for LLM streams. (iOS 18+ alternative: `gonzalezreal/Textual` 0.5.0; old MarkdownUI is maintenance-mode — skip) |
| Inline code highlight | Highlightr (bundled with MarkdownView) | `github.com/raspu/Highlightr` 2.3.0 | MIT, maintained. Cache results; never re-highlight per token |
| Artifact "Code" tab | Runestone (tree-sitter, read-only) | `github.com/simonbs/Runestone` 0.5.2 | MIT, active 2026-03. Overkill for inline blocks — artifact pane only |
| Artifact "Preview" tab | **Build it (~150 lines):** `WKWebView` + custom `WKURLSchemeHandler` (serve from memory, e.g. `artifact://`), CSP meta `default-src 'none'`, `WKWebpagePreferences.allowsContentJavaScript` off unless the artifact needs JS, `decidePolicyFor` cancels all non-custom-scheme navigation | No dependency — none exists | iOS 26 adds native SwiftUI `WebView`/`WebPage` (WWDC25) — adopt as cleanup when min target allows |
| SSE transport | **Hand-rolled** `URLSession.bytes(for:)` + `.lines` + `AsyncThrowingStream` (~60 lines; same pattern as MacPaw/OpenAI, ChatGPTSwift). If resume/reconnect becomes needed: `launchdarkly/swift-eventsource` 3.3.0 (Apache-2.0; `Config.headers` for Bearer, `HeaderTransform` to refresh the Clerk JWT per reconnect, Last-Event-ID) | — | Inaka/EventSource and SwiftKeychainWrapper are dead — skip |
| Composer | Native `TextField(axis: .vertical).lineLimit(1...6)` | — | iOS 16+; no library |
| History drawer | Custom `ZStack` + `.offset` + drag gesture + scrim | — | All drawer libs (SideMenu et al.) abandoned; v1 scaffold's approach was already correct |
| Keychain | Nothing — Clerk SDK owns token storage | — | |
| Client-side AI SDKs | None (wrong layer — backend owns provider calls) | `swift-ai-sdk` exists but not needed | — |

### Reference apps to study (patterns, not dependencies)
- **Enchanted** — `github.com/gluonfield/enchanted` (Apache-2.0, active): per-token UI **throttling** during streams, SwiftData history, attachments, voice prompts. ⚠️ Author is pivoting to a successor project — copy patterns, don't track upstream.
- **fullmoon** — `github.com/mainframecomputer/fullmoon-ios` (MIT): minimal SwiftUI+SwiftData chat core; collapsible "thinking" blocks (maps to our `reply.reasoning.delta`).
- **AWS SwiftChat** — `github.com/aws-samples/sample-mobile-ai-assistant` (MIT-0, React Native): closest feature-parity reference anywhere (artifact-style web preview, multi-endpoint). Use as the feature checklist.
- **LibreChat** (MIT) + **e2b-dev/fragments** (Apache-2.0): web artifacts UX blueprints (card → preview interactions).
- **MacPaw/OpenAI** — `github.com/MacPaw/OpenAI` (MIT): production-grade hand-rolled SSE parsing in Swift.

---

## 4. The Artifacts Advantage

Every open-source Claude-artifacts clone (LibreChat, AIaW, LobeChat) relies on copying Anthropic's leaked ~4000-token system prompt so models emit `<antArtifact>` tags, then regex-parsing the stream.

**We don't need any of that.** `replies-runtime` emits structured **`artifact.created`** events on the SSE stream. Our artifact pane is a **typed-event consumer**, not a markdown-regex guesser.

Consequences:
- **Delete** `ChatViewModel.checkForArtifacts` (v1's O(n²) regex) — do not "fix" it.
- Artifact card appears when the event arrives, not when a fence happens to close.
- Artifact content is stripped from rendered markdown by construction (it was never inline text).

---

## 5. Parity Checklist (from the live Claude iOS app, v1.260716.0)

**v1 scope — table stakes:**
- Streaming feed, stop button, auto-scroll during stream
- Markdown + syntax-highlighted code blocks, per-block copy
- Composer: text + attachments (camera/photos/files) + dictation mic
- Searchable history drawer, cross-device sync (server-side conversations)
- Model selector; message edit/retry (→ backend `/fork`)

**Phase 2 — differentiators:**
- Artifacts: in-thread card → full-screen Preview|Code view, version switching, iterate via chat
- Voice mode (two-way TTS/STT) — backend dependency, defer
- Projects, chat search/memory — defer

**Out of scope:** AI-powered shareable artifacts, Claude Code/Cowork surfaces.

---

## 6. Revised Directory Layout

```
surfaces/allternit-mobile/ios/
├── Allternit.xcodeproj            # NEW — v1 had no buildable project
├── App/
│   ├── AllternitApp.swift         # Clerk.configure, scenePhase stream lifecycle
│   └── RootView.swift             # auth gate (ClerkKitUI AuthView or custom)
├── Core/
│   ├── API/
│   │   ├── APIClient.swift        # REWRITE — async request builder (fixes v1 header race)
│   │   ├── RepliesStreamClient.swift  # POST /v1/replies + GET stream → AsyncThrowingStream<ReplyEvent, Error>
│   │   └── Models/
│   │       ├── ReplyEvent.swift   # GENERATED from @allternit/replies-contract
│   │       └── Conversation.swift # matches web ConversationRecord envelope
│   ├── Auth/                      # DELETED v1 ClerkAuthManager — replaced by ClerkKit
│   └── DesignSystem/Color+Theme.swift  # pick ONE source: asset catalog OR hex constants
├── Features/
│   ├── Chat/ (Views, ViewModels)  # feed, composer, MessageRow (MarkdownView), streaming throttle (Enchanted pattern)
│   ├── History/                   # drawer wired to GET /api/v1/conversations
│   ├── Artifacts/                 # card view + full-screen Preview|Code pane + sandboxed WebView
│   └── Attachments/               # PhotosPicker, document picker, dictation
└── Assets.xcassets                # NEW — brand colors live here
```

**v1 deletions/replacements:** fabricated Clerk OAuth URL + `?token=` extraction; Keychain-by-hand auth state; `POST /conversations/{id}/stream` with OpenAI-style `[DONE]` parsing; `[String: String]` response decoding; artifact regex; hardcoded sidebar mock data; unused `sidebarOffset`; `NavigationView` → `NavigationStack`.

---

## 7. Phase Plan

**Phase 0 — Contract lock (½ wk)**
- Confirm public gateway host for mobile; document org/tenant header requirements.
- Generate Swift `ReplyEvent`/conversation models from `@allternit/replies-contract`.
- Verify gateway accepts Clerk JWTs from a native app (JWKS verification path).

**Phase 1 — Project + Auth (1 wk)**
- Xcode project, iOS 17, SPM deps (ClerkKit/UI, MarkdownView, Runestone, exyte/Chat optional).
- Clerk: enable Native API in dashboard, `webcredentials:` associated domain, `Clerk.configure(publishableKey:)`; login gate → `session.getToken()`.

**Phase 2 — Networking (1 wk)**
- `APIClient` rewrite: async request builder with Bearer injection (v1 race fixed by construction); envelope-correct decoding.
- `RepliesStreamClient`: POST reply → open GET stream → decode `ReplyEvent`s → cancel support; `scenePhase` background→cancel / foreground→reconnect strategy.

**Phase 3 — Chat UI (2 wk)**
- Feed + composer + streaming markdown (throttled updates), history drawer wired to real conversations API, model selector, edit/retry via `/fork`.

**Phase 4 — Artifacts (1.5 wk)**
- `artifact.created` consumer → in-thread card → full-screen Preview|Code pane, sandboxed WebView, version switching.

**Phase 5 — Parity polish (1.5 wk)**
- PhotosPicker + document picker, dictation mic, chat search, haptics, empty/error states, offline banner.

**Phase 6 — QA & release (1 wk)**
- SSE interruption matrix (background, network switch, token expiry mid-stream), TestFlight, perf pass on long streams.

**Total: ~8 weeks** (vs. 11 in the old roadmap — the library stack and typed artifact events remove the riskiest work).

---

## 8. Risks / Open Questions

1. **Gateway host for mobile is unconfirmed** — the single Phase-0 blocker.
2. **Enchanted maintenance** — author pivoting; we copy patterns only.
3. **Tenant/org headers** — web sends Clerk org context; mobile behavior undefined.
4. **Last-Event-ID resume** — backend currently sends a synthetic terminal event to late subscribers but has no replay cursor; if resume-on-foreground matters, backend work is required (or accept "reconnect = fetch final state").
5. **Voice mode** — no backend voice contract for mobile yet; explicitly deferred.
