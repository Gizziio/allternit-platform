# Vercel Agent Plugin Adapter — Phase 1 Task

**Scope:** Add a Vercel AI SDK protocol adapter to Allternit's plugin SDK so that Vercel-style agent plugins can be loaded and invoked natively. Phase 1 focuses on the adapter and registration helper.

**Agent:** qwen
**Repo:** `/Users/joe/Desktop/allternit-workspace/allternit`
**Branch target:** `ao/p1-vercel-agent-plugins`

## Deliverables

1. Research Vercel agent plugins:
   - Source: `https://vercel.com/blog/introducing-agent-plugins` and `https://github.com/vercel-labs/ai-cli` if needed.
   - Identify the plugin manifest schema and tool invocation protocol.
2. Adapter implementation:
   - File: `platform/plugins/src/adapters/vercel-agent.ts`
   - Implement `VercelAgentPluginAdapter` extending `BasePlugin`.
   - Load a Vercel agent plugin manifest, validate it, and register its tools/actions through `PluginContext`.
3. Schema:
   - File: `platform/plugins/src/adapters/vercel-agent.schema.ts`
   - TypeScript types for the Vercel agent plugin manifest.
4. Registration:
   - File: `platform/plugins/src/registry.ts`
   - Add `registerVercelAgentPlugin(manifestPath: string)` helper.
5. Tests:
   - File: `platform/plugins/tests/vercel-agent-adapter.test.ts`
   - At least 6 unit tests: load manifest, invalid manifest, activate, tool invocation, registry integration, missing file.

## Constraints

- Keep dependencies minimal; reuse existing `platform/plugins` infrastructure.
- Do not embed proprietary Vercel code; only the adapter and test fixtures.
- Final validation: `bun x tsc --noEmit` in `platform/plugins` and `bun test`.
- No git commits/pushes.

## Reference

- `platform/plugins/src/plugin.ts`
- `platform/plugins/src/registry.ts`
- `platform/plugins/src/adapters/qwen-mm.ts` (example adapter from Qwen-MM-Plugins)
- `https://vercel.com/blog/introducing-agent-plugins` (fetch via WebSearch/FetchURL)

## Sentinel

When finished, write `docs/agent-tasks/VERCEL_AGENT_PLUGIN_ADAPTER_PHASE_1_NOTES.md` starting with YAML frontmatter:

```yaml
status: done
files_changed:
  - platform/plugins/src/adapters/vercel-agent.ts
  - platform/plugins/src/adapters/vercel-agent.schema.ts
  - platform/plugins/src/registry.ts
  - platform/plugins/tests/vercel-agent-adapter.test.ts
  - platform/plugins/package.json
deviations: []
remaining:
  - Live Vercel marketplace integration
  - Authentication / token exchange
```

Then prose notes summarizing the Vercel plugin contract and validation results.
