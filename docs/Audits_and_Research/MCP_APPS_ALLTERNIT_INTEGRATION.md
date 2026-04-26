# MCP Apps in allternit

Last reviewed: March 26, 2026

## Source set

- Overview: https://modelcontextprotocol.io/extensions/apps/overview
- Proposal post: https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/
- Stable launch post: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
- Stable spec: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
- SDK package: https://www.npmjs.com/package/@modelcontextprotocol/ext-apps

## What changed

The linked materials describe three distinct milestones:

1. November 21, 2025:
   MCP Apps was proposed as SEP-1865. The proposal standardized `ui://` resources, `_meta.ui.resourceUri`, sandboxed HTML apps, and JSON-RPC-over-`postMessage` between a host and an app.
2. January 26, 2026:
   MCP Apps was announced as stable and production-ready. The launch post says support was available in Claude web and desktop, Goose, VS Code Insiders, and ChatGPT rolling out that week.
3. Current overview page:
   The extension is documented as "interactive UI applications that render inside MCP hosts."

Important constraint:

- These three linked sources do not establish the Claude mobile timeline by themselves. The January 26, 2026 launch post explicitly mentions Claude web and desktop, not mobile.

## What MCP Apps actually is

This is not "host ships a native integration for Figma/Amplitude/etc."

It is:

- An MCP server declares a UI resource via `ui://...`
- A tool references that resource in `_meta.ui.resourceUri`
- The host fetches the resource with `resources/read`
- The host renders the returned HTML with MIME type `text/html;profile=mcp-app`
- The iframe app and host communicate via MCP-style JSON-RPC over `postMessage`

That makes MCP Apps an app runtime and distribution layer for MCP-capable hosts.

## What allternit already has

There are three nearby systems in the repo:

- MCP tool transport
  - [`services/gateway/routing/src/mcp_bridge.rs`](/Users/macbook/Desktop/allternit-workspace/allternit/services/gateway/routing/src/mcp_bridge.rs)
- Internal rich UI transport via A2UI/canvas
  - [`surfaces/platform/docs/A2UI_GUIDE.md`](/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/platform/docs/A2UI_GUIDE.md)
  - [`platform/protocols/allternit-canvas-protocol/src/lib.rs`](/Users/macbook/Desktop/allternit-workspace/allternit/platform/protocols/allternit-canvas-protocol/src/lib.rs)
- A custom "capsule" iframe runtime that already uses the phrase "MCP Apps"
  - [`services/gateway/routing/routing/src/mcp_apps_routes.rs`](/Users/macbook/Desktop/allternit-workspace/allternit/services/gateway/routing/routing/src/mcp_apps_routes.rs)
  - [`surfaces/platform/src/components/CapsuleFrame/CapsuleFrame.tsx`](/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/platform/src/components/CapsuleFrame/CapsuleFrame.tsx)

That is useful because the product already understands:

- chat surfaces
- embedded iframe UI
- tool execution
- event streams
- host-side security concerns

## The actual gap

Today allternit is not an MCP Apps host yet.

### 1. MCP is wired as "tools only"

The current backend MCP bridge lists tools and calls tools, but it does not implement the UI-resource half of the spec.

- [`services/gateway/routing/src/mcp_bridge.rs:217`](/Users/macbook/Desktop/allternit-workspace/allternit/services/gateway/routing/src/mcp_bridge.rs:217)
- [`services/gateway/routing/src/mcp_bridge.rs:268`](/Users/macbook/Desktop/allternit-workspace/allternit/services/gateway/routing/src/mcp_bridge.rs:268)

What is missing there:

- no capture of `_meta.ui.resourceUri`
- no tool visibility handling (`model` vs `app`)
- no `resources/read` path for `ui://...`
- no host-side notion of MCP Apps capability negotiation

### 2. The existing "capsule" runtime is custom, not spec-compliant

The current capsule path is REST plus SSE plus a custom `postMessage` API.

- [`services/gateway/routing/routing/src/mcp_apps_routes.rs:1`](/Users/macbook/Desktop/allternit-workspace/allternit/services/gateway/routing/routing/src/mcp_apps_routes.rs:1)
- [`surfaces/platform/src/components/CapsuleFrame/CapsuleFrame.tsx:1`](/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/platform/src/components/CapsuleFrame/CapsuleFrame.tsx:1)

That differs from the stable MCP Apps spec in material ways:

- no `ui/initialize` handshake
- no `ui/notifications/initialized`
- no host capability advertisement
- no MCP JSON-RPC proxying for `tools/call` and `resources/read`
- no `ui/open-link`, `ui/message`, `ui/update-model-context`, `ui/request-display-mode`
- no spec-defined app-only tool visibility enforcement

### 3. The current web iframe security model does not match the recommended host model

For web hosts, the spec requires a sandbox proxy between host and app content. allternit currently renders custom iframe content directly.

- [`surfaces/platform/src/components/CapsuleFrame/CapsuleFrame.tsx:373`](/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/platform/src/components/CapsuleFrame/CapsuleFrame.tsx:373)

The spec requires:

- host origin and sandbox proxy origin to differ
- sandbox proxy iframe with `allow-scripts allow-same-origin`
- raw HTML passed to the sandbox proxy
- inner iframe CSP derived from the resource metadata

### 4. Frontend MCP support exists, but it stops before apps

The platform already has a browser-side MCP client wrapper and can list resources, which is exactly the right place to extend for MCP Apps.

- [`surfaces/platform/src/lib/ai/mcp/mcp-client.ts:1`](/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/platform/src/lib/ai/mcp/mcp-client.ts:1)

What is missing:

- no extraction of `_meta.ui.resourceUri`
- no host bridge built with `@modelcontextprotocol/ext-apps/app-bridge`
- no message rendering path that mounts an MCP App when a tool result points to a UI resource

### 5. Parts of the UI are still stubs

- [`surfaces/platform/src/views/CapsuleManagerView.tsx:1`](/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/platform/src/views/CapsuleManagerView.tsx:1)

That view still uses a dummy capsule instead of a real MCP Apps host path.

## Recommended integration shape

Do not try to force MCP Apps into A2UI.

Instead:

1. Keep A2UI as allternit's internal agent-generated UI protocol.
2. Add MCP Apps as a separate standards-compliant host layer.
3. Let the chat surface decide whether a rich tool result should render:
   - as plain text
   - as A2UI
   - as an MCP App

## Concrete implementation plan

### Phase 1: Spec alignment in discovery and metadata

Goal:
Teach allternit to recognize MCP App tools without rendering them yet.

Work:

- preserve full MCP tool metadata from discovery
- extract `_meta.ui.resourceUri`
- enforce `visibility`
- negotiate `io.modelcontextprotocol/ui`

Artifacts:

- [`surfaces/platform/src/lib/ai/mcp/apps.ts`](/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/platform/src/lib/ai/mcp/apps.ts)

### Phase 2: Backend resource bridge

Goal:
Let the host resolve `ui://` resources through the same MCP server connection that exposed the tool.

Work:

- extend the MCP bridge to retain the original tool metadata
- expose `resources/read` for the owning MCP server connection
- bind app-only tools to the originating server only
- reject cross-server app calls

Likely files:

- [`services/gateway/routing/src/mcp_bridge.rs`](/Users/macbook/Desktop/allternit-workspace/allternit/services/gateway/routing/src/mcp_bridge.rs)
- [`services/gateway/routing/routing/src/tools_routes.rs`](/Users/macbook/Desktop/allternit-workspace/allternit/services/gateway/routing/routing/src/tools_routes.rs)

### Phase 3: Real host bridge on the platform surface

Goal:
Render an MCP App from a tool result inside the chat surface.

Work:

- add `@modelcontextprotocol/ext-apps` to the platform
- create a host-side bridge with `@modelcontextprotocol/ext-apps/app-bridge`
- map host capabilities:
  - `serverTools`
  - `serverResources`
  - `logging`
  - `openLinks`
  - `updateModelContext`
  - `message`
- feed host context:
  - theme
  - locale
  - display mode
  - container dimensions
  - mobile-safe-area data where relevant

Likely files:

- [`surfaces/platform/src/lib/ai/mcp/mcp-client.ts`](/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/platform/src/lib/ai/mcp/mcp-client.ts)
- [`surfaces/platform/src/views/chat/ChatMessageParts.tsx`](/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/platform/src/views/chat/ChatMessageParts.tsx)
- [`surfaces/platform/src/views/chat/ChatMessageTypes.ts`](/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/platform/src/views/chat/ChatMessageTypes.ts)

### Phase 4: Web-safe sandbox proxy

Goal:
Meet the spec's required security architecture for web surfaces.

Work:

- host page renders a sandbox proxy iframe on a different origin
- proxy loads raw HTML from `resources/read`
- proxy enforces CSP from `_meta.ui.csp`
- proxy forwards JSON-RPC messages between app and host

This should be implemented as a new component, not by continuing to evolve the current custom `CapsuleFrame`.

### Phase 5: Product integration

Goal:
Make app results feel native inside allternit.

Work:

- mount inline in chat first
- support fullscreen display mode second
- persist app context with `ui/update-model-context`
- surface app-triggered follow-up messages with `ui/message`
- reuse existing shell framing for borders, fullscreen, and sidecar behavior

## Why this should not be "replace capsules with MCP Apps"

Because the current capsule runtime is doing two jobs:

- product-specific miniapp/canvas behavior
- a rough placeholder for interactive tool UI

MCP Apps only solves the second one.

The right move is:

- keep capsules if they still serve allternit-native miniapps
- stop treating them as the protocol boundary for external MCP UI
- put the MCP Apps bridge beside them, not under them

## Immediate next implementation target

The highest-leverage next step is:

1. extend backend MCP discovery so tool metadata and UI resource URIs survive end-to-end
2. add a platform-side `McpAppFrame` that uses the official host bridge
3. wire one chat message path to render a single inline MCP App

That gets allternit from "custom iframe widgets" to "real MCP Apps host" with the least wasted work.
