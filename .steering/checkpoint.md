# Steering checkpoint

## Goal

Integrate Firecrawl `anydoc` into the Allternit platform and all five surfaces so users can open supported document files as Markdown from the Office launcher/action surface.

## Just did

- Fetched `https://github.com/firecrawl/anydoc` to confirm capabilities: Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, PDF → GitHub-Flavored Markdown via Node/Rust/Python/WASM bindings.
- Confirmed the Allternit codebase lives in the session worktree and that `services/office-engine` already exposes `/parse`, `/extract`, `/pptx/parse`, `/xlsx/parse`, etc.
- Confirmed `OfficeLauncherView` / `OfficeSuiteSection` currently live only in `surfaces/ai.allternit.com` and support `.docx`, `.xlsx`, `.pptx`, `.pdf`.

## Next

- Enter plan mode and produce a concrete implementation plan covering:
  1. Backend: add an `anydoc`-powered `/markdown` (or `/to-markdown`) endpoint to `services/office-engine`.
  2. Web surface: extend `OfficeSuiteSection` with an "Open as Markdown" action for any supported file type.
  3. Desktop surface: expose the same capability through the existing `office-engine-manager`.
  4. Extensions surface: add an "Open as Markdown" option in the Office add-in / extension sidepanel.
  5. Mobile surface: add Swift API call + UI affordance.
  6. Docs surface: document the new capability.
- Get plan approval, then implement and verify.

## Open questions

- Should the conversion run in `office-engine` directly (add `@firecrawl/anydoc` npm dependency) or as a separate microservice?
- Which exact formats should be surfaced in the UI? (anydoc supports 14 extensions; current launcher only advertises 4.)
- Should converted Markdown be shown in a new read-only view, streamed into the chat composer, or saved as an artifact?
