# Allternit Design Plugin System

## Status

Implemented runtime bundle model for the three design plugins.

## Runtime Result

Allternit now installs three local design plugin packages into:

- `~/.allternit/plugins/frontend`
- `~/.allternit/plugins/brand`
- `~/.allternit/plugins/motion`

Each package contains:

- `.claude-plugin/plugin.json`
- `plugin.json`
- `README.md`
- `bundle.manifest.json`
- `.claude-plugin/install-source.json`
- `skills/*/SKILL.md`

Bundled skills are scanned from plugin-local `skills/` directories and exposed as runtime capabilities by the platform capability scanner.

## Product Model

The top-level design plugin count stays fixed at three:

- `Frontend`
- `Brand`
- `Motion`

Users discover plugins first. Raw imported skills are bundled implementation assets, not the primary marketplace object.

## Install / Import Pipeline

The sync command is:

```bash
node scripts/design/sync-design-plugins.mjs
```

What it does:

1. Clones or refreshes upstream skill repos into `.cache/design-plugin-sources/`
2. Copies selected external skill directories into `~/.allternit/plugins/<plugin-id>/skills/<skill-id>`
3. Writes merged `config.json` metadata into each installed skill
4. Writes plugin manifests and install receipts
5. Emits `docs/design/design-plugin-runtime-bundles.json` as an inventory record

## Runtime Scanning

The capability scanner now resolves skills from two places:

- root skill directories like `~/.allternit/skills`
- bundled plugin skill directories like `~/.allternit/plugins/<plugin>/skills/*`

Bundled skills carry plugin metadata:

- `pluginId`
- `pluginName`
- `sourceUrl`
- `filePath`

This lets the runtime treat imported design bundles as real capabilities instead of inert marketplace metadata.

## Installed Bundles

### Frontend

Installed skills:

- `frontend-design` from `anthropics/skills`
- `baseline-ui` from `ibelick/ui-skills`
- `fixing-accessibility` from `ibelick/ui-skills`
- `fixing-metadata` from `ibelick/ui-skills`
- `ui-ux-pro-max` from `nextlevelbuilder/ui-ux-pro-max-skill`
- `design` from `nextlevelbuilder/ui-ux-pro-max-skill`
- `impeccable` from `pbakaus/impeccable`

Purpose:

- interface generation
- quality audits
- accessibility repair
- implementation-aware UI refinement

### Brand

Installed skills:

- `canvas-design` from `anthropics/skills`
- `brand-guidelines` from `anthropics/skills`
- `theme-factory` from `anthropics/skills`
- `algorithmic-art` from `anthropics/skills`
- `brand` from `nextlevelbuilder/ui-ux-pro-max-skill`
- `banner-design` from `nextlevelbuilder/ui-ux-pro-max-skill`

Purpose:

- identity direction
- asset systems
- visual language
- campaign and banner output

### Motion

Installed skills:

- `fixing-motion-performance` from `ibelick/ui-skills`
- `slides` from `nextlevelbuilder/ui-ux-pro-max-skill`
- `pptx` from `anthropics/skills`
- `slack-gif-creator` from `anthropics/skills`

Purpose:

- motion tuning
- presentation flow
- animated media output
- sequence-driven design work

## Marketplace / Design Surface Behavior

`DesignRegistryView` now presents:

- the three plugin cards
- bundled skill counts
- installed runtime counts
- plugin actions
- workflow maps
- supported surfaces

It also passes plugin bundle context into launched design sessions so studio sessions know which bundled skill set they came from.

## Files Changed

Core runtime and UI changes:

- `surfaces/allternit-platform/src/plugins/fileSystem.ts`
- `surfaces/allternit-platform/src/plugins/fileSystem.real.ts`
- `surfaces/allternit-platform/src/plugins/capability.types.ts`
- `surfaces/allternit-platform/src/plugins/useCapabilities.ts`
- `surfaces/allternit-platform/src/plugins/design/designSkills.registry.ts`
- `surfaces/allternit-platform/src/views/design/DesignRegistryView.tsx`
- `surfaces/allternit-platform/src/views/design/DesignModeView.tsx`
- `scripts/design/sync-design-plugins.mjs`

Docs and inventory:

- `docs/design/design-plugin-system.md`
- `docs/design/design-plugin-runtime-bundles.json`

## Verification Targets

Verify these local paths after syncing:

- `~/.allternit/plugins/frontend/skills/*/SKILL.md`
- `~/.allternit/plugins/brand/skills/*/SKILL.md`
- `~/.allternit/plugins/motion/skills/*/SKILL.md`

The current generated inventory record is:

- `docs/design/design-plugin-runtime-bundles.json`
