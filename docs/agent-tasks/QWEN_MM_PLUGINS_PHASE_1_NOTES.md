---
status: done
files_changed:
  - platform/plugins/src/adapters/qwen-mm.ts
  - platform/plugins/src/adapters/qwen-mm.schema.ts
  - platform/plugins/src/registry.ts
  - platform/plugins/tests/qwen-mm-adapter.test.ts
  - platform/plugins/package.json
deviations: []
remaining: []
---

## Qwen-MM-Plugins Contract

The Qwen-MM-Plugins project (https://github.com/QwenLM/Qwen-MM-Plugins) is a collection of multimodal AI capabilities packaged as **Skills + MCP servers**. It does not use a traditional JSON plugin manifest; instead it distributes via:

1. **`marketplace.json`** (at `.claude-plugin/marketplace.json`) — a top-level manifest listing all capabilities with `git-subdir` source references (url, path, ref tag). This is the primary discovery manifest.

2. **`plugin-versions.json`** (at repo root) — a flat version map keyed by capability name (e.g. `"core": "1.0.1"`) with a `tag_format` template for git tags.

3. **Per-capability `.mcp.json`** — each capability directory contains an MCP server config declaring the command, args, and env needed to launch the MCP process.

4. **Installation** is orchestrated by `install.sh`, which delegates to each harness's native plugin/extension/mcp install verb (Claude plugins, Codex, Qwen Code extensions, Gemini MCP add).

### Schema modeled in the adapter

The adapter schema covers both the marketplace manifest shape (`QwenMMMarketplaceManifest`) and a synthetic capability manifest shape (`QwenMMCapabilityManifest`) that the Allternit plugin system uses internally. The capability manifest carries:
- `name`, `version`, `description` — identity
- `tools[]` — each with `name`, `description`, `inputSchema` (JSON Schema compatible with OpenAI/MCP tool call conventions)
- `server` — `{ command, args, env? }` matching the MCP server launch spec
- `config?` — required API keys (e.g. `DASHSCOPE_API_KEY`)

### Adapter behavior

`QwenMMPluginAdapter` extends `BasePlugin` and on `activate()`:
- Iterates `manifest.tools`, wraps each as a `Tool` (prefixed id: `qwen-mm-{name}:{toolName}`), and calls `context.registerTool()`.
- `getTools()` returns the tool catalog with input schemas.
- `getServerCommand()` returns the MCP launch command with merged env (config + server env).
- `fromManifestPath()` is the primary factory — reads a JSON file, validates via `validateCapabilityManifest`, and returns a configured adapter.

### Registration

`PluginRegistry.registerQwenMMPlugin(manifestPath, config?)` loads the adapter, registers it, and activates it in one call.

### Validation results

- `bun x tsc --noEmit` — **clean** (0 errors)
- `bun test` — **10/10 pass** covering: load manifest, activate + tool registration, tool invocation, invalid manifest rejection (3 cases), marketplace validation, registry integration (2 cases), server command exposure.
