# Swarm C — Phase 5 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-c`  
**Branch:** `ao/p5-c`  
**Base:** `parity/swarm-sprint`

## Goal
Close Tool Belt multimodal and parallel-tool gaps.

## Deliverables

1. **Tool use with images**
   - Extend the tool input schema (`ToolParameter`) to accept image content blocks (base64 or URL) as a new `image` type.
   - Update `NativeWebTools` / tool dispatcher to pass image inputs through to vision-capable providers.
   - Add a test in `tool-belt.test.ts`.

2. **Vision input / Vision coordinates**
   - Add a `vision` content block type to the harness `Message` schema supporting base64/URL images.
   - Add `vision_coordinates` support for model-returned pointing coordinates (e.g. `click(x, y)` results).
   - Map vision blocks correctly in `toOpenAIRequest` and `toAnthropicRequest`.
   - Add tests.

3. **Parallel tool use**
   - Implement parallel tool-call semantics in the Tool Belt dispatcher: when a model returns multiple tool calls, execute them concurrently (with a concurrency limit) and return results in call order.
   - Add tests.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass
- `vitest run sdk/allternit-sdk/src/ai-runtime/__tests__/tool-belt.test.ts` — pass
- `bun test sdk/allternit-sdk/src/ai-runtime/harness/__tests__` — pass

## Commit
Commit on `ao/p5-c` with message: `feat(p5): Swarm C image tool inputs, vision blocks, and parallel tool execution`.
