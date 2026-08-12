# Swarm C — Phase 7 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-c`  
**Branch:** `ao/p7-c`  
**Base:** `parity/swarm-sprint`

## Goal
Build the Allternit skill library scaffold and a PowerPoint skill.

## Deliverables

1. **SKILL.md format and skill registry**
   - Define a canonical `SKILL.md` package format in `docs/public/skills/skill-format.md`:
     - `name`, `version`, `description`, `tools[]`, `entrypoint`, `progressive_disclosure` sections.
   - Create `sdk/allternit-sdk/src/ai-runtime/skills/registry.ts` that loads skills from `~/.allternit/skills/` and validates against the format.

2. **PowerPoint skill**
   - Create `sdk/allternit-sdk/src/ai-runtime/skills/powerpoint.ts`.
   - Implement `create_presentation` and `add_slide` tools using `pptxgenjs` if available in the workspace; otherwise implement a minimal PPTX XML builder.
   - Register the skill as `allternit/powerpoint`.

3. **Tests**
   - Add tests for SKILL.md validation.
   - Add a test that generates a `.pptx` and verifies it contains at least one slide.

## Validation
- `bun test sdk/allternit-sdk/src/ai-runtime/__tests__/tool-belt.test.ts` — pass
- `cargo check -p allternit-api` — pass

## Commit
Commit on `ao/p7-c` with message: `feat(p7): Swarm C skill library scaffold and PowerPoint skill`.
