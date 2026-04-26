# Gizzi-Code Dependency Audit Worksheet

**Date:** March 6, 2026  
**Purpose:** Classify all dependencies into Keep/Wrap/Remove/Internalize buckets  
**Scope:** `cmd/gizzi-code/node_modules` - Focus on runtime-critical packages first

---

## Classification Rules

### Bucket A — Keep Upstream ✅
Commodity libraries, stable, not part of product identity:
- HTTP clients / fetch polyfills
- SSE parsers
- zod, yargs, diff, semver
- mime-types, jsonc-parser
- Standard utilities

**Action:** Leave as external dependency

### Bucket B — Wrap and Isolate 🔄
Dependencies you use but only behind your interfaces:
- @anthropic-ai/sdk
- Provider SDKs (OpenAI, Google, etc.)
- MCP SDKs
- PTY libraries
- Cloud auth libs

**Action:** Import only inside `runtime/providers/*/` or `runtime/integrations/*/`

### Bucket C — Remove ❌
Unused or inherited fork residue:
- Providers you're not supporting
- Alternate model gateways you don't want
- Duplicate auth stacks
- CLI helpers that don't fit Gizzi
- Experiments / legacy package glue

**Action:** Remove from package.json, verify no imports

### Bucket D — Internalize 📦
Tiny modules that are:
- Core to product behavior
- Small enough to own
- Stable enough to maintain
- Causing dependency drag or lock-in

**Action:** Copy into `cmd/gizzi-code/src/shared/` or `runtime/`, remove external dep

---

## Phase 1: Anthropic-Related Packages

| Package | Version | Direct/Indirect | Used By | Category | Action | Notes |
|---------|---------|-----------------|---------|----------|--------|-------|
| `@anthropic-ai/sdk` | ? | Direct | `runtime/providers/` | **B** | Wrap | Only import inside `runtime/providers/anthropic/` |
| `@anthropic-ai/claude-code` | ? | Direct | `cli/` | **B** | Wrap | CLI surface, keep behind adapter |
| `@ai-sdk/anthropic` | 2.0.65 | Direct | `runtime/providers/` | **B** | Wrap | Vercel AI SDK provider |
| `ai` | 5.0.124 | Direct | `runtime/providers/` | **B** | Wrap | Vercel AI SDK core |

**Decision:** All Anthropic packages stay as **Bucket B** (Wrap). No internalization yet.

---

## Phase 2: Provider SDKs

| Package | Version | Direct/Indirect | Used By | Category | Action | Notes |
|---------|---------|-----------------|---------|----------|--------|-------|
| `@ai-sdk/openai` | 2.0.89 | Direct | `runtime/providers/` | **B** | Wrap | Keep behind ProviderAdapter |
| `@ai-sdk/google` | 2.0.54 | Direct | `runtime/providers/` | **B** | Wrap | Keep behind ProviderAdapter |
| `@ai-sdk/amazon-bedrock` | 3.0.82 | Direct | `runtime/providers/` | **C?** | Remove? | Do you support Bedrock? |
| `@ai-sdk/azure` | 2.0.91 | Direct | `runtime/providers/` | **C?** | Remove? | Do you support Azure OpenAI? |
| `@ai-sdk/groq` | 2.0.34 | Direct | `runtime/providers/` | **C?** | Remove? | Do you support Groq? |
| `@ai-sdk/gateway` | 2.0.30 | Direct | `runtime/providers/` | **C?** | Remove? | Do you support Gateway? |
| `@openrouter/ai-sdk-provider` | 1.5.4 | Direct | `runtime/providers/` | **C?** | Remove? | Do you support OpenRouter? |

**Action Required:** List which providers Gizzi-Code will **natively support** vs remove.

---

## Phase 3: Runtime-Critical Packages

| Package | Version | Direct/Indirect | Used By | Category | Action | Notes |
|---------|---------|-----------------|---------|----------|--------|-------|
| `hono` | * | Direct | `runtime/server/` | **D?** | Internalize? | Web server - core to product? |
| `drizzle-orm` | 1.0.0-beta.12 | Direct | `runtime/session/storage/` | **D?** | Internalize? | Database ORM - core to product? |
| `@modelcontextprotocol/sdk` | 1.25.2 | Direct | `runtime/tools/mcp/` | **B** | Wrap | MCP protocol - wrap behind ToolDispatcher |
| `@agentclientprotocol/sdk` | 0.14.1 | Direct | `runtime/integrations/acp/` | **B** | Wrap | ACP protocol - wrap |
| `@opentui/core` | 0.1.79 | Direct | `cli/ui/tui/` | **A** | Keep | TUI library - commodity |
| `@opentui/solid` | 0.1.79 | Direct | `cli/ui/tui/` | **A** | Keep | TUI SolidJS bindings |
| `@clack/prompts` | 1.0.0-alpha.1 | Direct | `cli/` | **A** | Keep | CLI prompts - commodity |
| `solid-js` | * | Direct | `cli/ui/tui/` | **A** | Keep | UI framework - commodity |
| `yargs` | 18.0.0 | Direct | `cli/` | **A** | Keep | CLI parser - commodity |
| `zod` | 4.3.6 | Direct | Everywhere | **A** | Keep | Schema validation - commodity |

**Decision Needed:** Are `hono` and `drizzle-orm` **core product identity** (Bucket D) or commodity (Bucket A)?

---

## Phase 4: Cloud SDKs (Largest Transitive Trees)

| Package | Version | Direct/Indirect | Used By | Category | Action | Size Estimate |
|---------|---------|-----------------|---------|----------|--------|---------------|
| `@aws-sdk/credential-providers` | 3.993.0 | Direct | `runtime/providers/` | **B** | Wrap | ~100MB transitive |
| `@aws-sdk/*` (various) | 3.x | Indirect | `runtime/providers/` | **B** | Wrap | Bedrock support? |
| `@azure/identity` | 4.13.0 | Direct | `runtime/providers/` | **C?** | Remove? | Azure support needed? |
| `@azure/core-rest-pipeline` | 1.23.0 | Indirect | `runtime/providers/` | **C?** | Remove? | Azure support needed? |
| `google-auth-library` | 10.5.0 | Direct | `runtime/providers/` | **B** | Wrap | Google provider support |

**Action:** If you're not supporting Bedrock/Azure/Vertex, remove these entire trees.

---

## Phase 5: File System & Watchers

| Package | Version | Direct/Indirect | Used By | Category | Action | Notes |
|---------|---------|-----------------|---------|----------|--------|-------|
| `@parcel/watcher` | 2.5.1 | Direct | `runtime/workspace/` | **A** | Keep | File watching - commodity |
| `chokidar` | 4.0.3 | Direct | `runtime/workspace/` | **C?** | Remove? | Duplicate of @parcel/watcher? |
| `glob` | 13.0.5 | Direct | `runtime/workspace/` | **A** | Keep | File globbing - commodity |
| `ignore` | 7.0.5 | Direct | `runtime/workspace/` | **A** | Keep | .gitignore parsing - commodity |
| `minimatch` | 10.0.3 | Direct | `runtime/workspace/` | **A** | Keep | Pattern matching - commodity |
| `tree-sitter-bash` | 0.25.0 | Direct | `runtime/tools/` | **D?** | Internalize? | Shell parsing - core to product? |
| `web-tree-sitter` | 0.25.10 | Direct | `runtime/tools/` | **D?** | Internalize? | Tree-sitter WASM - core? |

**Question:** Is shell script parsing (tree-sitter) part of Gizzi's product identity?

---

## Phase 6: Utility Libraries

| Package | Version | Direct/Indirect | Used By | Category | Action | Notes |
|---------|---------|-----------------|---------|----------|--------|-------|
| `remeda` | * | Direct | Everywhere | **A** | Keep | FP utilities - commodity |
| `diff` | * | Direct | `runtime/tools/` | **A** | Keep | Diff library - commodity |
| `decimal.js` | 10.5.0 | Direct | `runtime/` | **A** | Keep | Decimal math - commodity |
| `fuzzysort` | 3.1.0 | Direct | `cli/ui/` | **A** | Keep | Fuzzy search - commodity |
| `gray-matter` | 4.0.3 | Direct | `runtime/` | **A** | Keep | Frontmatter parsing - commodity |
| `jsonc-parser` | 3.3.1 | Direct | `runtime/` | **A** | Keep | JSONC parsing - commodity |
| `mime-types` | 3.0.2 | Direct | `runtime/server/` | **A** | Keep | MIME types - commodity |
| `partial-json` | 0.1.7 | Direct | `runtime/` | **D?** | Internalize? | JSON streaming - small enough to own? |
| `strip-ansi` | 7.1.2 | Direct | `cli/ui/` | **A** | Keep | ANSI stripping - commodity |
| `turndown` | 7.2.0 | Direct | `runtime/` | **A** | Keep | HTML→Markdown - commodity |
| `ulid` | * | Direct | `runtime/` | **A** | Keep | ULID generation - commodity |
| `clipboardy` | 4.0.0 | Direct | `cli/` | **A** | Keep | Clipboard access - commodity |

**Candidate for Internalization:** `partial-json` - tiny, used for streaming JSON parsing

---

## Phase 7: Auth & Security

| Package | Version | Direct/Indirect | Used By | Category | Action | Notes |
|---------|---------|-----------------|---------|----------|--------|-------|
| `@openauthjs/openauth` | * | Direct | `runtime/auth/` | **D?** | Internalize? | Auth system - core to product? |
| `@gitlab/opencode-gitlab-auth` | 1.3.3 | Direct | `runtime/auth/` | **C?** | Remove? | GitLab-specific auth needed? |
| `google-auth-library` | 10.5.0 | Direct | `runtime/auth/` | **B** | Wrap | Behind AuthStore |

**Decision:** Is `@openauthjs/openauth` core to Gizzi's identity (Bucket D) or commodity (Bucket A)?

---

## Phase 8: Protocol Adapters

| Package | Version | Direct/Indirect | Used By | Category | Action | Notes |
|---------|---------|-----------------|---------|----------|--------|-------|
| `vscode-languageserver-protocol` | ^3.17.5 | Direct | `runtime/integrations/lsp/` | **B** | Wrap | LSP integration |
| `vscode-jsonrpc` | ^8.2.1 | Direct | `runtime/integrations/lsp/` | **B** | Wrap | LSP dependency |
| `@actions/core` | 1.11.1 | Direct | `runtime/integrations/` | **C?** | Remove? | GitHub Actions - needed? |
| `@actions/github` | 6.0.1 | Direct | `runtime/integrations/` | **C?** | Remove? | GitHub integration - needed? |
| `@octokit/rest` | * | Direct | `runtime/integrations/` | **C?** | Remove? | GitHub API - needed? |
| `@octokit/graphql` | 9.0.2 | Direct | `runtime/integrations/` | **C?** | Remove? | GitHub GraphQL - needed? |

**Question:** Is GitHub integration core to Gizzi, or should it be a plugin?

---

## Phase 9: Build & Dev Dependencies

| Package | Version | Direct/Indirect | Used By | Category | Action | Notes |
|---------|---------|-----------------|---------|----------|--------|-------|
| `typescript` | * | Dev | Build | **A** | Keep | Standard |
| `drizzle-kit` | 1.0.0-beta.12 | Dev | Database migrations | **D?** | Internalize? | Migration tooling |
| `@types/bun` | * | Dev | Build | **A** | Keep | Type definitions |
| `@types/yargs` | 17.0.33 | Dev | Build | **A** | Keep | Type definitions |
| `@types/turndown` | 5.0.5 | Dev | Build | **A** | Keep | Type definitions |
| `why-is-node-running` | 3.2.2 | Dev | Debugging | **A** | Keep | Debug utility |

---

## Phase 10: Platform-Specific Optional Dependencies

| Package | Version | Direct/Indirect | Used By | Category | Action | Notes |
|---------|---------|-----------------|---------|----------|--------|-------|
| `@parcel/watcher-darwin-arm64` | 2.5.1 | Optional | macOS | **A** | Keep | Platform-specific |
| `@parcel/watcher-darwin-x64` | 2.5.1 | Optional | macOS Intel | **A** | Keep | Platform-specific |
| `@parcel/watcher-linux-arm64-glibc` | 2.5.1 | Optional | Linux ARM | **C?** | Remove? | Supporting Linux? |
| `@parcel/watcher-linux-arm64-musl` | 2.5.1 | Optional | Linux ARM musl | **C?** | Remove? | Supporting Linux? |
| `@parcel/watcher-linux-x64-glibc` | 2.5.1 | Optional | Linux x64 | **C?** | Remove? | Supporting Linux? |
| `@parcel/watcher-linux-x64-musl` | 2.5.1 | Optional | Linux x64 musl | **C?** | Remove? | Supporting Linux? |
| `@parcel/watcher-win32-x64` | 2.5.1 | Optional | Windows | **C?** | Remove? | Supporting Windows? |

**Action:** Remove platform-specific packages for platforms you don't support.

---

## Summary: Actions by Priority

### Week 1: Freeze Provider Boundary
- [ ] Create `runtime/providers/types.ts` with ProviderAdapter interface
- [ ] Move all `@anthropic-ai/sdk` imports into `runtime/providers/anthropic/`
- [ ] Move all `@ai-sdk/*` imports into `runtime/providers/*/`
- [ ] Verify no provider SDK imports outside `runtime/providers/`

### Week 2: Remove Unused Providers
- [ ] Decide which providers to support natively
- [ ] Remove provider packages for unsupported providers
- [ ] Update `runtime/providers/registry.ts` to only include supported providers

### Week 3: Audit Cloud SDKs
- [ ] If not supporting Bedrock: remove `@aws-sdk/*` packages
- [ ] If not supporting Azure: remove `@azure/*` packages
- [ ] Keep only cloud SDKs for supported providers

### Week 4: Internalize Tiny Modules
- [ ] Evaluate `partial-json` for internalization
- [ ] Evaluate `tree-sitter-bash` for internalization (if core to product)
- [ ] Evaluate `@openauthjs/openauth` for internalization (if core to product)

### Week 5: Platform Cleanup
- [ ] Remove platform-specific packages for unsupported platforms
- [ ] Document supported platforms clearly

### Week 6: Architecture Tests
- [ ] Add ESLint rule: no provider SDK imports outside `runtime/providers/`
- [ ] Add test: verify dependency boundaries
- [ ] Add test: verify no model strings leak outside `models/`

---

## Dependency Ledger Template

```markdown
| Package | Version | Direct/Indirect | Used By | Category | Action | Owner | Status |
|---------|---------|-----------------|---------|----------|--------|-------|--------|
|         |         |                 |         |          |        |       |        |
```

**Instructions:**
1. Copy this template for each phase above
2. Fill in actual versions from `package.json`
3. Assign an owner to each action
4. Track status: Pending → In Progress → Complete → Verified

---

## Verification Checklist

After completing the audit:

- [ ] All provider SDK imports are inside `runtime/providers/*/`
- [ ] No unused provider packages remain in `package.json`
- [ ] Cloud SDK tree is minimal (only supported providers)
- [ ] Platform-specific packages match supported platforms
- [ ] Tiny internalized modules have tests
- [ ] Architecture tests pass
- [ ] Dependency tree is <300MB (down from 560MB)

---

**Next Step:** Run `bunx npm-remote-ls` or `bunx depcheck` to get full dependency tree, then fill in this worksheet.

**Generated:** March 6, 2026  
**Owner:** [Assign]  
**Due Date:** [Set based on sprint planning]
