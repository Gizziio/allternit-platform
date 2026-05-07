# Missing Allternit Font Files

The typography token chain is fully wired — `--font-allternit-sans/serif/mono` → `--font-ui/research/code` → `--font-sans/serif/mono` → Tailwind `font-sans/ui/research/code`.

**Font binaries are not yet present in `public/fonts/`.** Until they exist, the runtime falls back to Inter, Georgia, and system monospace fonts.

## Required files

Place these in `surfaces/allternit-platform/public/fonts/`:

```
AllternitSans-Regular.woff2
AllternitSans-Medium.woff2
AllternitSans-Semibold.woff2
AllternitSans-Bold.woff2
AllternitSerif-Regular.woff2
AllternitSerif-Medium.woff2
AllternitSerif-Semibold.woff2
AllternitSerif-Bold.woff2
AllternitMono-Regular.woff2
AllternitMono-Medium.woff2
```

## Next step

Once font files are placed, create `src/styles/fonts.css` with `@font-face` declarations and add `import "@/styles/fonts.css"` to `src/app/layout.tsx` (after `theme.css`, before `typography.css`).

The `allternit_sans_v0_1_source_pack.zip` in `Desktop/allternit-assets/` may contain the source files — check if `.woff2` files can be extracted from it.
