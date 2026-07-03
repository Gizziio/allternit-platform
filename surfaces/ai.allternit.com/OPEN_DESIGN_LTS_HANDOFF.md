# Open Design → Allternit Design LTS Handoff
**Session:** 2026-07-03  
**Working directory:** `/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/ai.allternit.com`  
**Upstream:** `nexu-io/open-design` (Apache-2.0)

---

## What was ported in this pass

This branch forks the **Open Design skill/craft/protocol layer** into Allternit Design mode so it can discover, bind, and execute open-design-compatible skills.

### 1. Skill registry + parser
- `src/lib/design/skill-registry.ts` — typed `SkillRecord`, minimal YAML frontmatter parser, `od:` block normalization (mode, scenario, preview, inputs, parameters, craft, outputs, capabilities).
- `src/lib/design/bundled-skills.ts` — imports five sample `SKILL.md` files as raw strings and parses them.
- `src/lib/design/skills-api.ts` — async client API merging bundled + locally imported skills.
- `src/lib/design/use-skills.ts` — React hook with polling + window-focus revalidation for hot-reload semantics.
- `src/lib/design/local-skill-discovery.ts` — File System Access API discovery for local `~/.claude/skills/` or `./skills/` directories.

### 2. Sample skills under `/skills/`
| Skill | Mode | Assets |
|---|---|---|
| `saas-landing-skill` | prototype | `assets/base.html` |
| `dashboard-skill` | prototype | `assets/base.html` |
| `magazine-deck-skill` | deck | `assets/template.html` |
| `design-system-skill` | design-system | — |
| `mobile-app-skill` | prototype | — |

### 3. Craft references under `/craft/`
- `typography.md`
- `color.md`
- `anti-ai-slop.md`
- `src/lib/design/craft-loader.ts` — resolves craft slugs and concatenates bodies.

### 4. Prompt composition
- `src/lib/design/studio-system-prompt.ts` now accepts `skillBody`, `skillName`, `craftRequirements`, and `skillValues`.
- Craft refs are injected **between** DESIGN.md and skill body (brand wins; craft covers universal gaps).

### 5. UI wiring
- `src/views/design/SkillPicker.tsx` — modal with mode/scenario filters, search, refresh.
- `src/views/design/NewProjectScreen.tsx` — optional skill picker trigger + dynamic input fields.
- `src/views/design/DesignModeView.tsx` — skill state, picker state, prompt composition, opener message.

### 6. Todo progress streaming
- `src/lib/design/todo-progress.ts` — parses `[x]`, `[ ]`, `Step N — completed`, and `✅` markers.
- `src/components/design/TodoProgressCard.tsx` — live progress card with bar and checklist.
- `src/components/design/StudioMessageRenderer.tsx` — renders progress card above artifact content.

### 7. Artifact export pipelines
- `src/lib/design/artifact-export.ts` — HTML, PDF (print), ZIP bundle, PPTX scaffold.
- `src/components/design/ArtifactPreviewPane.tsx` — export dropdown with four formats.

### 8. TypeScript
- `src/types/raw-modules.d.ts` — declarations for `*.md?raw` and `*.txt?raw` imports.
- `pnpm typecheck:fast` passes with zero new errors.

---

## LTS gaps still to close

To reach full parity with `nexu-io/open-design`, the following remain for future LTS work:

1. **Daemon-side skill discovery (partially addressed by local FS picker)**
   - Browser-side File System Access API picker is wired into SkillPicker.
   - LTS: add server-side scan via `/api/design/skills` or existing Allternit API for non-browser contexts.
   - Watch filesystem with `chokidar` in dev; re-index on `SIGHUP` in production.

2. **Agent adapter pool**
   - Detect `claude`, `codex`, `cursor-agent`, `kimi`, etc. on `PATH`.
   - Spawn CLI with skill context + DESIGN.md + CWD set to artifact workspace.
   - Stream stdout/stderr as structured events.

3. **Project file workspace**
   - Artifact file tree UI (read/write files next to the preview).
   - Plain files on disk under daemon-managed storage per root `AGENTS.md`.

4. **Plugin marketplace**
   - Parse `open-design.json` manifest spec.
   - Category browsing: scenarios, image-templates, video-templates, design-systems, atoms, examples.
   - Per-agent install scripts (`od mcp install <agent>` equivalent).

5. **Full PPTX export**
   - Use `pptxgenjs` to build real slides from `slides.json` when a deck skill produces one.

6. **MP4 / HyperFrames export**
   - Integrate `hyperframes-html` renderer for HTML→MP4 motion graphics.

7. **Comment-mode surgical edits**
   - Targeted patching via agent comment protocol; requires agent capability gating.

8. **Live parameter sliders**
   - Render `od.parameters` as sliders; re-prompt agent on change.

9. **Design system resolver**
   - Resolve `./DESIGN.md`, `./design-system/DESIGN.md`, or user-configured path.
   - Hot-reload on file change.

10. **Claude Design ZIP import**
    - `/api/import/claude-design` route to unpack and convert OD sessions.

---

## Key files

| File | Role |
|---|---|
| `src/lib/design/skill-registry.ts` | Skill parser + types |
| `src/lib/design/bundled-skills.ts` | Shipped skill catalog |
| `src/lib/design/skills-api.ts` | Client discovery API |
| `src/lib/design/use-skills.ts` | Hot-reload hook |
| `src/lib/design/craft-loader.ts` | Craft reference loader |
| `src/lib/design/studio-system-prompt.ts` | Prompt composer |
| `src/lib/design/todo-progress.ts` | Plan progress parser |
| `src/lib/design/artifact-export.ts` | Export pipelines |
| `src/views/design/SkillPicker.tsx` | Skill picker UI |
| `src/views/design/NewProjectScreen.tsx` | Project start with skill inputs |
| `src/components/design/TodoProgressCard.tsx` | Progress card UI |
| `src/components/design/ArtifactPreviewPane.tsx` | Export controls |
| `craft/*.md` | Universal craft references |
| `skills/*/SKILL.md` | Bundled open-design skills |

---

## Patterns followed

- No build commands during task work.
- Read before editing.
- CSS variables for colors.
- No external API calls from browser; exports are client-side.
- `localStorage` key pattern `allternit-design-*` preserved where applicable.
