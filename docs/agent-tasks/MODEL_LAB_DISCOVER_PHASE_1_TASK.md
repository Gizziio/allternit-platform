# Model Lab Discover + Catalog Polish — Phase 1

## Goal
Polish the Discover feed and Hugging Face catalog model cards in Model Lab so they match the Artifact Library card style and provide a real discovery experience.

## Current state
- `surfaces/ai.allternit.com/src/views/model-lab/ExplorePanel.tsx` has Discover + Catalog sub-tabs.
- `surfaces/ai.allternit.com/src/views/model-lab/GuidesPanel.tsx` is the Discover view. It currently shows a category dropdown and a grid of cards with a beige-ish gradient header.
- `surfaces/ai.allternit.com/src/views/model-lab/CatalogPanel.tsx` is the Hugging Face catalog search + local cache. Cards use `bg-[var(--bg-elevated)]` but the user wants better visuals (HF avatar/profile, official provider badge, size, clickable detail).
- `surfaces/ai.allternit.com/src/views/model-lab/components/ModelDetailDrawer.tsx` opens when a HF card is clicked. It already shows author, official badge, stats, description, tags, and actions.

## Files to modify
- `surfaces/ai.allternit.com/src/views/model-lab/GuidesPanel.tsx`
- `surfaces/ai.allternit.com/src/views/model-lab/CatalogPanel.tsx`
- `surfaces/ai.allternit.com/src/views/model-lab/components/ModelDetailDrawer.tsx`
- `surfaces/ai.allternit.com/src/views/model-lab/components/ModelCard.tsx` (if needed)

## Detailed requirements

### GuidesPanel.tsx (Discover)
Replace the current plain search + dropdown + grid with a polished discovery feed:

1. **Hero section**
   - Large headline: "Discover open-weights recipes".
   - Subheadline about Unsloth notebooks, guides, and fine-tuning recipes.
   - Search bar below the headline (not hidden in a card), styled like Artifact Library search.
   - Category filter as a horizontal chip row (not a dropdown) below the search: All, Notebooks, Fine-tuning, GRPO, Export, Evaluation.

2. **Featured guide card**
   - Full-width hero card for the featured guide.
   - Use `ModelCard` style (`bg-[var(--bg-elevated)]` border) not a beige gradient.
   - Show title, description, tags, "Launch job", "Notebook", "Guide" buttons.
   - Notebook and Guide buttons open in the ACI browser pane via `useBrowserStore().addTab(url, title)`.

3. **Guide cards grid**
   - Each card: `ModelCard` with `bg-[var(--bg-elevated)]`, no beige gradient.
   - Header: small category badge + accent icon.
   - Body: title, description (line-clamp), tags.
   - Footer actions: "Launch job", "Notebook" (if available), "Open in ACI" (opens guideUrl).
   - Cards should feel like Artifact Library cards: subtle hover shadow, consistent border radius.

### CatalogPanel.tsx (Hugging Face search)
Improve the model cards and search experience:

1. **Search section**
   - Keep the search input but ensure text color uses `var(--text-primary)` and placeholder uses `var(--text-tertiary)`.
   - Sort and Fit filters use the existing `Select` component; ensure labels render correctly.

2. **Model cards**
   - Use `ModelCard` component.
   - Header should display the HF author avatar (`https://huggingface.co/{author}/avatar`) as the card preview image, with a fallback icon.
   - Show an "Official" badge for models from known official orgs (the list is in `api.ts` `OFFICIAL_HF_ORGS`).
   - Show pipeline tag badge, size in GB, and hardware-fit badge.
   - Show downloads and likes.
   - Clicking a card opens `ModelDetailDrawer`.

3. **Empty / loading states**
   - Keep existing empty and loading states; just ensure styling matches.

### ModelDetailDrawer.tsx
Enhance the detail drawer:
1. Ensure the author avatar uses the HF avatar URL and shows the org profile image prominently.
2. Show the "Official" badge if applicable.
3. Show GB size using `sizeBytes` when available, otherwise estimated size.
4. Add an "Open model card on Hugging Face" button that opens `https://huggingface.co/{repoId}` in the ACI browser pane.
5. For cached models, keep "Add to Brain" and "Chat with this model" actions.

### ModelCard.tsx
Ensure `ModelCard` is consistent with Artifact Library: `bg-[var(--bg-elevated)]`, `border-[var(--border-subtle)]`, rounded-xl, hover border + shadow. No beige/tinted gradients.

## Visual consistency
- Match existing Tailwind styling: CSS vars for bg/fg/border.
- Use Phosphor icons and `lucide-react` where already used.
- Use existing `Button`, `Badge`, `Input`, `Select` components.
- Use `cn()` from `@/lib/utils`.

## Constraints
- Do NOT run builds, typechecks, dev servers, or git operations.
- Do NOT touch bot code, ACI code, or model-picker code beyond the ACI `addTab` calls.
- Do NOT add new dependencies.
- Keep changes scoped to Model Lab view directory.
- Preserve all existing functionality (search, download, launch, brain register, chat).

## Deliverable
When finished, write `docs/agent-tasks/MODEL_LAB_DISCOVER_PHASE_1_NOTES.md` with YAML frontmatter:

```yaml
status: done
files_changed:
  - surfaces/ai.allternit.com/src/views/model-lab/GuidesPanel.tsx
  - surfaces/ai.allternit.com/src/views/model-lab/CatalogPanel.tsx
  - surfaces/ai.allternit.com/src/views/model-lab/components/ModelDetailDrawer.tsx
  # plus any other files changed
deviations: []
remaining: []
```

Then prose notes summarizing what changed and any issues.
