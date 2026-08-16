# Model Lab / Local Engine / Training Integration — Phase 1 Task

**Agent:** kimi  
**Worktree:** /Users/joe/Desktop/allternit-workspace/allternit  
**Goal:** Deeply integrate Unsloth and Local Studio into Allternit Model Lab as native first-class features, and fix UI consistency across Model Lab panels.

## Projects to research

1. **unslothai/unsloth** — open-source desktop app. Fork/integrate model download infrastructure, model training, quantization, export, and notebook discovery into Allternit surfaces.
2. **sybil-solutions/local-studio** — Local Studio Electron app. Audit its UI tabs and runtime behavior. Integrate its useful UI patterns (model recipes, download, serve, usage, logs) into Allternit Model Lab as native tabs. The user wants this to appear as if it is a native first-hand feature, not a wholesale adapter.
3. **arman-bd/guppylm** — browser-based model training. Research and plan integration.
4. **Alibaba Cloud ModelStudio Console** — the user likes the tabs for training models. Plan to scrape or mimic the features and add them to Allternit surfaces.

## Deliverables

1. Write `docs/agent-tasks/MODEL_LAB_TRAINING_MAP.md` with:
   - One-paragraph summary of each project
   - License and reuse risk
   - Adopt / extract / fork / reference / reject decision
   - Concrete UI tabs and backend routes needed

2. Implement in this phase (production quality, full implementation, no stubs):
   - Add a `ModelCard` shared component under `src/views/model-lab/components/ModelCard.tsx` that matches the Artifact Library card style (rounded-xl, border border-[var(--border-subtle)], bg-[var(--bg-elevated)], hover:border-[var(--border-hover)], shadow on hover). Replace all `GlassCard` usage in Model Lab panels with `ModelCard` or direct equivalent styling. Remove beige/glass tints.
   - Implement a "Downloads" sub-tab or panel in Model Lab for downloading Hugging Face / Unsloth models with progress tracking and queue management.
   - Implement a "Recipes" sub-tab in Local Studio that mirrors Local Studio's model recipe configuration (model id, backend, quantization, max_model_len, metadata) and persists recipes to the Allternit local engine.
   - Add Unsloth notebook/guide feed auto-discovery: create a lightweight scraper/feed reader that fetches new Unsloth guide/notebook links (from unsloth.ai/docs and the Unsloth X/Twitter feed pattern) and displays them in the Discover tab. Store the feed in the Model Lab store.
   - Ensure the Engine panel and Local Runtime panel display unified memory detection correctly on Apple Silicon (show "Unified Memory" label when GPU name contains "Apple").

3. When finished, write `docs/agent-tasks/MODEL_LAB_TRAINING_PHASE_1_NOTES.md` with YAML frontmatter:
   ```yaml
   status: done
   files_changed: []
   deviations: []
   remaining: []
   ```

## Constraints

- Do NOT run git commits, pushes, or upstream code imports.
- Match repo idiom: React + TypeScript, Tailwind CSS, Phosphor or Lucide icons, Zustand stores, Rust axum backend when adding routes.
- Do NOT start phase 2.
- Append milestones to `.allternit/shared-context.md` if it exists.
