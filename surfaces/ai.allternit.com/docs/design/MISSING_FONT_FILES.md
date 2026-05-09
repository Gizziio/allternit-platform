# Missing Allternit Font Files

Production Allternit font binaries are missing.

The v0.1 source pack (`allternit_sans_v0_1_source_pack.zip`) is a prototype and must not be loaded as production UI typography.

## Required Future Files

| File | Weight | Style |
|------|--------|-------|
| `AllternitSans-Regular.woff2` | 400 | normal |
| `AllternitSans-Medium.woff2` | 500 | normal |
| `AllternitSans-Semibold.woff2` | 600 | normal |
| `AllternitSans-Bold.woff2` | 700 | normal |
| `AllternitSerif-Regular.woff2` | 400 | normal |
| `AllternitSerif-Medium.woff2` | 500 | normal |
| `AllternitMono-Regular.woff2` | 400 | normal |
| `AllternitMono-Medium.woff2` | 500 | normal |

## Current Fallback Behavior

Until production binaries are available, the typography token system falls back to:
- **Sans:** Inter → ui-sans-serif → system-ui → sans-serif
- **Serif:** Georgia → ui-serif → Cambria → serif
- **Mono:** SFMono-Regular → Menlo → Monaco → Consolas → monospace

## Prototype File

A prototype v0.1 WOFF2 was generated from the source pack for exploration only.
It is stored at:
```
public/fonts/prototypes/AllternitSans-Regular.woff2
```

This file must NOT be loaded in production UI.
