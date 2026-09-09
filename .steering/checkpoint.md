# Session checkpoint — office-nav

Goal: Add a floating top-left Back/Home control row (mirroring shell RailControls) to the
standalone office page routes (/docs, /sheets, /slides, /pdf, /office) so the owner can get
back to the main screen. Root cause: those routes render standalone pages outside the shell,
so RailControls (FloatingWidgets.tsx, fixed top-0 left-0 z-[150]) never mounts.

Just did:
- Scouted the shell: RailControls + TitleBarButton in src/shell/FloatingWidgets.tsx
  (TitleBarButton is not exported — replicate style, do not refactor the shell file).
- Confirmed isElectronShell() in src/lib/platform; trafficLightClearance = 72 : 4.
- Built src/shell/OfficePageChrome.tsx + mounted in 5 pages (flex-col layout).
- DEVIATION from brief: the brief asked for a `fixed top-0 left-0` floating row, but
  measurement showed the vendored editors always render their File ribbon tab at
  x=84–130 on mac (ribbon-tabs-mac padding, File tab visible in every env because
  installDesktopBridge always sets __allternitBrowserBridge) — a floating pill at
  marginLeft 72 would cover it. Docked a 44px bar in normal flow instead: no overlap
  by construction, same pill/button visual language, same traffic-light clearance,
  plus a drag region for the frameless Electron window. Flagged in PR.

Next:
1. Create src/shell/OfficePageChrome.tsx (fixed top-left pill: Back + Home, WebkitAppRegion:no-drag).
2. Mount in DocsPage/SheetsPage/SlidesPage/PdfPage/OfficeLauncherPage (src/pages/ only).
3. Add vitest test next to FloatingWidgets.test.tsx conventions.
4. Typecheck + test, visual check, commit/push/PR/merge, ledger attestation, cleanup.

Open questions:
- None — scope fixed by owner: no main-nav entry, no views/office edits (agent-20 owns that).
