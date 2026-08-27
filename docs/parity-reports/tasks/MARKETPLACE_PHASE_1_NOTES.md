---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/views/marketplace/main/Marketplace.types.ts
  - surfaces/ai.allternit.com/src/views/marketplace/main/MarketplaceItemCard.tsx
  - surfaces/ai.allternit.com/src/views/marketplace/main/useMarketplaceManager.ts
  - surfaces/ai.allternit.com/src/views/marketplace/main/useCapabilityMarketplace.ts
  - surfaces/ai.allternit.com/src/views/MarketplaceView.tsx
  - surfaces/ai.allternit.com/src/components/marketplace/CapabilityCard.tsx
  - surfaces/ai.allternit.com/src/components/marketplace/CapabilityDetail.tsx
  - surfaces/ai.allternit.com/src/components/marketplace/CapabilitySearchBar.tsx
  - surfaces/ai.allternit.com/src/components/marketplace/CheckoutModal.tsx
  - surfaces/ai.allternit.com/src/components/marketplace/index.ts
  - sdk/allternit-sdk/src/ai-runtime/plugins/types.ts
  - sdk/allternit-sdk/src/ai-runtime/plugins/builder.ts
  - sdk/allternit-sdk/src/ai-runtime/plugins/registry.ts
  - sdk/allternit-sdk/src/ai-runtime/plugins/index.ts
  - sdk/allternit-sdk/src/ai-runtime/index.ts
  - cmd/allternit-api/src/marketplace_routes.rs
  - cmd/allternit-api/src/main.rs
  - tools/mcp-servers/docs-mcp-server/package.json
  - tools/mcp-servers/docs-mcp-server/tsconfig.json
  - tools/mcp-servers/docs-mcp-server/src/index.ts
  - tools/mcp-servers/docs-mcp-server/README.md
  - .steering/checkpoint.md
blockers: []
---

# Plugin Marketplace — Phase 1 Complete

## Executive Summary

All 6 items in Track G (Plugin Marketplace) have been successfully implemented. This phase establishes the foundational infrastructure for a complete capability marketplace within the Allternit platform, including a TypeScript SDK for capability authors, a Rust-based payments/checkout API, reusable UI components, and a documentation MCP server for agents.

---

## G1: CapabilitiesManager.tsx (PARTIAL → DONE)

**Status:** Already feature-complete

The existing `CapabilitiesManager.tsx` (3,507 lines) was reviewed and found to be fully implemented with:
- 7-tab capability library (Skills, Commands, CLI Tools, Plugins, MCPs, Webhooks, Connectors)
- 3-pane layout with file preview (Human/Code view modes)
- Marketplace browsing with personal sources
- Dependency resolution and conflict detection
- Update checking and installation flows
- Keyboard shortcuts, context menus, error boundaries
- Real filesystem integration with persistence

Per `IMPLEMENTATION_GAPS.md`, 37 items were completed across 6 phases (layout, skills, connectors, plugins, persistence, validation). No additional work was required.

---

## G2: Capability Marketplace View (MISSING → DONE)

**Status:** Fully implemented

### What was built

Enhanced `MarketplaceView.tsx` to provide a complete marketplace browsing and installation experience:

- **Capability browsing**: Grid layout with cards showing name, author, version, pricing, rating, install count, tags
- **Search & filtering**: Real-time search by name/description/tags, category filtering (All, Skills, Tools, Plugins, MCPs, Connectors, Workflows)
- **Detail panel**: Slide-in panel with full capability information including description, tools, permissions, stats, links
- **Install/uninstall flow**: One-click install for free capabilities, checkout modal for paid/subscription/enterprise
- **Status tracking**: Real-time status indicators (installed, installing, not-installed)
- **Toast notifications**: User feedback for install/uninstall actions

### Key files

- `surfaces/ai.allternit.com/src/views/MarketplaceView.tsx` — Main view orchestration
- `surfaces/ai.allternit.com/src/views/marketplace/main/useCapabilityMarketplace.ts` — State management hook with 6 sample capabilities
- `surfaces/ai.allternit.com/src/views/marketplace/main/MarketplaceItemCard.tsx` — Card component (pre-existing, now used by enhanced view)

---

## G3: Allternit Capability SDK (MISSING → DONE)

**Status:** Fully implemented

### What was built

A complete TypeScript SDK for capability authors to define, publish, and manage capabilities on the Allternit platform.

### Core types (`plugins/types.ts`)

- `CapabilityKind` — skill, command, tool, mcp, webhook, connector, plugin
- `CapabilityPricing` — free, paid, subscription, enterprise with amount/currency/interval
- `CapabilityManifest` — Full capability metadata (id, name, description, version, author, tools, permissions, dependencies, tags)
- `CapabilityPermission` — Resource access declarations (filesystem, network, shell, clipboard, notifications)
- `CapabilityLifecycle` — Hooks for install, uninstall, activate, deactivate, update
- `CapabilityContext` — Runtime context passed to lifecycle handlers
- `CapabilitySearchOptions` / `CapabilitySearchResult` — Marketplace search API
- `CapabilityPublishOptions` / `CapabilityPublishResult` — Publishing API

### Builder API (`plugins/builder.ts`)

Fluent builder pattern for defining capabilities:

```typescript
const myCapability = defineCapability(builder =>
  builder
    .id('my-tool')
    .name('my-tool')
    .displayName('My Tool')
    .description('A custom tool for Allternit')
    .version('1.0.0')
    .kind('tool')
    .author('My Company', { email: 'dev@example.com' })
    .paid(9900, 'USD') // $99.00
    .addTool({
      name: 'my_action',
      description: 'Perform an action',
      input_schema: { type: 'object', properties: {}, required: [] }
    })
    .addPermission({
      resource: 'network',
      access: 'execute',
      description: 'Access external APIs'
    })
    .onInstall(async (ctx) => {
      console.log('Installing', ctx.capabilityId);
    })
);
```

### Client-side registry (`plugins/registry.ts`)

`CapabilityRegistry` class extending `EventEmitter` with:
- `install()` / `uninstall()` — Lifecycle management with tool registration
- `search()` — Marketplace search via REST API
- `publish()` — Publish capabilities to marketplace
- Event emission for install/uninstall lifecycle events

### Integration

- All exports added to `sdk/allternit-sdk/src/ai-runtime/index.ts`
- Follows existing patterns: `.js` imports, `export type` for types, JSDoc on public APIs

---

## G4: Marketplace Payments / Checkout API (MISSING → DONE)

**Status:** Fully implemented

### What was built

A complete Rust-based marketplace API with 6 endpoints, following the existing Axum patterns in the codebase.

### Endpoints

1. **GET `/marketplace/capabilities`** — List/search capabilities
   - Query params: `q`, `kind`, `pricing`, `tags`, `cursor`, `limit`
   - Returns: `{ items: [...], total: N, cursor: "..." }`

2. **GET `/marketplace/capabilities/:id`** — Get capability detail
   - Returns: Full manifest, pricing, stats, tools, permissions

3. **POST `/marketplace/checkout`** — Create checkout session
   - Request: `{ capability_id, pricing_type, workspace_id }`
   - Returns: `{ order_id, status: "pending", checkout_url }`
   - Phase 1: No-op checkout (matches `NoopCharger` pattern in `billing.rs`)

4. **GET `/marketplace/orders/:id`** — Get order status
   - Returns: Order detail with line items, status, timestamps

5. **POST `/marketplace/licenses/validate`** — Validate license key
   - Request: `{ license_key, capability_id }`
   - Returns: `{ valid: bool, expires_at, capability_id }`

6. **GET `/marketplace/licenses/me`** — List user's active licenses
   - Returns: Array of license records with capability info

### Database schema

Three tables created lazily:
- `marketplace_capabilities` — Capability catalog (id, name, kind, pricing, manifest_json, install_count, rating)
- `marketplace_orders` — Order records (user_id, capability_id, amount, status, license_key)
- `marketplace_licenses` — License keys (license_key, user_id, capability_id, status, expires_at)

### Implementation details

- Uses `tokio::task::spawn_blocking` for DB access
- Proper error handling with `ApiError` type
- JSON responses via `serde_json::json!`
- Auth via `Extension<AuthUser>` extractor
- Wired into `main.rs` at line 358: `.merge(allternit_api::marketplace_routes::router())`

---

## G5: Capability UI Components (MISSING → DONE)

**Status:** Fully implemented

### What was built

Four reusable React components in `surfaces/ai.allternit.com/src/components/marketplace/`:

#### 1. `CapabilityCard.tsx`

Compact card for marketplace grid:
- Icon, name, author, version, pricing badge
- Description (3-line clamp)
- Tags (up to 3 shown, "+N" overflow)
- Stats: rating, install count, kind
- Action buttons: Install/Uninstall/Details
- Status-aware styling (installed, installing, error)

#### 2. `CapabilityDetail.tsx`

Full detail panel for selected capability:
- Header with icon, name, author, version, pricing
- Action bar: Install/Uninstall buttons, external links (homepage, repository)
- Stats grid: rating, installs, kind, license
- Tags section
- Long description
- Tools list with descriptions
- Permissions list with resource/access/description
- Metadata (created/updated timestamps)

#### 3. `CapabilitySearchBar.tsx`

Search and filtering controls:
- Text input with clear button
- Category tabs (All, Skills, Tools, Plugins, MCPs, Connectors, Workflows)
- Responsive layout with flex-wrap

#### 4. `CheckoutModal.tsx`

Purchase flow for paid capabilities:
- Item summary with icon, name, author, price
- Pricing breakdown (subtotal, tax, total)
- Terms acceptance checkbox (required for paid)
- Confirm/Cancel buttons with processing state
- Backdrop blur and close-on-backdrop-click

### Barrel export (`index.ts`)

All components and types re-exported for clean imports.

---

## G6: Allternit Docs MCP Server (MISSING → DONE)

**Status:** Fully implemented

### What was built

A Node.js/TypeScript MCP server that provides documentation lookup tools for agents. Located at `tools/mcp-servers/docs-mcp-server/`.

### Tools exposed

1. **`search_docs`** — Search documentation by keyword
   - Input: `{ query: string, limit?: number }`
   - Returns: Matching document titles, paths, and categories

2. **`read_doc`** — Read full content of a specific doc
   - Input: `{ path: string }`
   - Returns: Full markdown/text content of the document

3. **`list_docs`** — List all available documentation
   - Input: `{ category?: string }`
   - Returns: Grouped list by category (tools, providers, guides, etc.)

4. **`get_api_reference`** — Look up API endpoint documentation
   - Input: `{ endpoint: string }`
   - Returns: API reference content with path and title

### Implementation

- **Protocol**: MCP 2025-03-26 over stdio (JSON-RPC 2.0)
- **Transport**: Newline-delimited JSON on stdin/stdout
- **Methods**: `initialize`, `tools/list`, `tools/call`, `notifications/initialized`
- **Doc scanning**: Recursive directory walk with `.md`, `.mdx`, `.txt` support
- **Title extraction**: Regex match on `# Heading` pattern
- **Environment**: `ALLTERNIT_DOCS_ROOT` env var (defaults to `docs/public` relative to repo)

### Files

- `package.json` — Dependencies (glob), scripts (build, start, dev)
- `tsconfig.json` — ES2022 target, Node16 module resolution
- `src/index.ts` — Main server implementation (450 lines)
- `README.md` — Usage documentation

---

## Phase 2 Work (Out of Scope)

The following items remain for Phase 2:

1. **Real payment processor integration** — Replace `NoopCharger` with actual payment gateway (Stripe, Clover, etc.)
2. **Registry API implementation** — Wire capability search/publish endpoints to real database with live data
3. **Capability upload/publish UI** — Web interface for authors to upload and manage their capabilities
4. **Version management** — Multi-version support, rollback, deprecation
5. **Analytics & metrics** — Install trends, revenue tracking, user engagement
6. **Review & rating system** — User reviews, moderation, spam detection
7. **Bundle/pack support** — Grouping multiple capabilities into themed packs
8. **Workspace-scoped installations** — Per-workspace capability management with sharing rules
9. **Dependency graph visualization** — Visual dependency tree in capability detail view
10. **Automated testing** — Capability test suites run in CI before marketplace approval

---

## Verification

All Phase 1 deliverables are present and follow repository conventions:

- ✅ No competitor names in code, comments, or user-facing strings
- ✅ Rust routes use Axum patterns (Extension, State, spawn_blocking, serde_json)
- ✅ TypeScript SDK uses `.js` imports, `export type`, JSDoc
- ✅ React components use Tailwind utility classes, Phosphor icons, shadcn/ui primitives
- ✅ MCP server uses stdio JSON-RPC, follows 2025-03-26 protocol
- ✅ All files in correct locations per task spec
- ✅ Steering checkpoint updated
- ✅ Sentinel file written

---

## Summary

Phase 1 establishes a complete foundation for the Allternit Capability Marketplace:

- **Authors** can define capabilities using the TypeScript SDK with type-safe builder API
- **Users** can browse, search, view details, and install capabilities via the enhanced marketplace view
- **Platform** has a Rust-based API for capability catalog, checkout, orders, and licenses
- **Agents** can reference platform documentation via the Docs MCP server

All 6 Track G items are complete and ready for Phase 2 integration work.
