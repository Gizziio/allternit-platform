# Allternit Office — standalone web surface

A self-contained web app that hosts the full Allternit Office Suite outside the platform shell.

## What it includes

- **Docs** — word processor
- **Sheets** — spreadsheet editor
- **Slides** — presentation editor
- **PDF** — PDF viewer
- **Sign** — native PDF signing

All apps are imported from `@allternit/allternit-office-suite` and run against a browser-based `OfficeHost` that opens files with the native file picker and downloads saves.

## Running locally

```bash
pnpm --filter @allternit/office-surface dev
```

Then open http://localhost:3015.

## Building

```bash
pnpm --filter @allternit/office-surface build
```

The build needs a large heap because all five office apps are bundled together:

```bash
NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter @allternit/office-surface build
```

This is already configured in the `build` script.

## Architecture

- `src/App.tsx` — tab shell that switches between the five apps.
- `src/main.tsx` — React entry point.
- `vite.config.ts` — Vite config, including a small plugin that inlines the AI panel icon assets used by the vendored office apps.

The suite package (`packages/@allternit/allternit-office-suite`) provides:

- `OfficeHostProvider` / `useOfficeHostRequired` — dependency injection for file open/save, locale, AI, and optional xlsx engine.
- `createBrowserHost` — default browser implementation.
- The five app adapters (`DocsApp`, `SheetsApp`, `SlidesApp`, `PdfApp`, `SignApp`).
