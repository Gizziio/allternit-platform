---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/views/model-lab/GuidesPanel.tsx
  - surfaces/ai.allternit.com/src/views/model-lab/CatalogPanel.tsx
  - surfaces/ai.allternit.com/src/views/model-lab/components/ModelDetailDrawer.tsx
  - surfaces/ai.allternit.com/src/views/model-lab/components/ModelCard.tsx
deviations: []
remaining: []
---

# Model Lab Discover + Catalog Polish — Phase 1 Notes

## Summary
Completed the Discover feed and Hugging Face catalog model cards overhaul in Model Lab to match the Artifact Library card design system and provide full discovery, download, and execution integration.

## Key Changes
1. **GuidesPanel.tsx (Discover)**:
   - Hero header with prominent typography ("Discover open-weights recipes"), direct full-width search input, and horizontal category chips (`All`, `Notebooks`, `Fine-tuning`, `GRPO`, `Export`, `Evaluation`).
   - Standardized `ModelCard` styling (`bg-[var(--bg-elevated)]`, `border-[var(--border-subtle)]`) for featured recipes and grid items, removing beige gradients.
   - Wired "Notebook" and "Guide" actions to open directly in the ACI browser pane via `useBrowserStore().addTab(url, title)`.
2. **CatalogPanel.tsx (HF Catalog)**:
   - Profile-first card previews featuring author avatars (`https://huggingface.co/{author}/avatar`) with fallback icons.
   - Official provider badges for verified AI organizations (`meta-llama`, `mistralai`, `Qwen`, `unsloth`, `microsoft`, `google`, etc.).
   - Hardware-fit badges (`Fits`, `Tight`, `Too big`) based on detected Apple Silicon unified memory / system RAM.
   - Download, import, brain registration, and chat integration.
3. **ModelDetailDrawer.tsx**:
   - Elevated author profile display with official verification badge.
   - Precise and estimated memory footprint calculation.
   - ACI browser integration to view the full model card on Hugging Face.
   - Contextual actions for cached models ("Add to Brain", "Chat with this model").
4. **ModelCard.tsx**:
   - Clean, standard design-token container with subtle hover borders and elevation shadow.
