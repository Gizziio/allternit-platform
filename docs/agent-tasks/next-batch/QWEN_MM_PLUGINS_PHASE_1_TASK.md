# Qwen-MM-Plugins Adapter — Phase 1 Task

**Scope:** Add a Qwen multimodal plugin adapter to Allternit's plugin SDK so that Qwen MM plugins can be registered and invoked natively in gizzi-code / Allternit surfaces. This is a Rust/TypeScript SDK integration; no UI is required in Phase 1.

**Agent:** qwen
**Repo:** `/Users/joe/Desktop/allternit-workspace/allternit`
**Branch target:** `ao/p1-qwen-mm-plugins`

## Deliverables

1. Research Qwen-MM-Plugins contract:
   - Source: `https://github.com/QwenLM/Qwen-MM-Plugins`
   - Read the README and at least one example plugin manifest. Identify the manifest schema, input/output types, and invocation protocol (likely OpenAI-compatible function/tool calls).
2. Adapter crate/module:
   - File: `platform/plugins/src/adapters/qwen-mm.ts` (extend the existing `platform/plugins/src/adapters/` directory)
   - Implement `QwenMMPluginAdapter` class extending `BasePlugin` (or implementing the `Plugin` interface) from `platform/plugins/src/plugin.ts`.
   - Load a Qwen MM plugin manifest, validate it against a Zod or TypeScript schema, and expose its tools through the `PluginContext`.
3. Manifest schema:
   - File: `platform/plugins/src/adapters/qwen-mm.schema.ts`
   - Define TypeScript types for the Qwen MM plugin manifest.
4. Registration:
   - File: `platform/plugins/src/registry.ts`
   - Add a registration helper `registerQwenMMPlugin(manifestPath: string)` that instantiates the adapter and activates it.
5. Tests:
   - File: `platform/plugins/tests/qwen-mm-adapter.test.ts` (create `platform/plugins/tests/` if needed)
   - At least 3 unit tests: load manifest, validate invalid manifest fails, invoke tool through context.

## Constraints

- Keep dependencies minimal; reuse existing `platform/plugins` infrastructure.
- Do not pull proprietary Qwen code into the repo; only the adapter and test fixtures that reference the public schema.
- Match existing platform/plugins code style.
- Final validation: `bun x tsc --noEmit` in `platform/plugins` and `bun test` or `node --test` for the adapter tests.
- No git commits/pushes.

## Reference

- `platform/plugins/src/plugin.ts`
- `platform/plugins/src/registry.ts`
- `platform/plugins/src/index.ts`
- `https://github.com/QwenLM/Qwen-MM-Plugins` (fetch via WebSearch/FetchURL)

## Sentinel

When finished, write `docs/agent-tasks/QWEN_MM_PLUGINS_PHASE_1_NOTES.md` starting with YAML frontmatter:

```yaml
status: done
files_changed:
  - platform/plugins/src/adapters/qwen-mm.ts
  - platform/plugins/src/adapters/qwen-mm.schema.ts
  - platform/plugins/src/registry.ts
  - platform/plugins/tests/qwen-mm-adapter.test.ts
  - platform/plugins/package.json
deviations: []
remaining: []
```

Then prose notes summarizing the Qwen MM plugin contract and validation results.
