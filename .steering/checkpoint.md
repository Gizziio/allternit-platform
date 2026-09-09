# Session checkpoint — office-dedup

Goal: Remove the duplicate standalone office suite. Keep the shell ACI "Office & Extensions"
hub (browser-extensions view) as the SINGLE office surface. (a) Desktop: drop the per-program
office BrowserWindows; deliver office opens (menu, file association, shell:open-office IPC) to
the main window via preload channel (new office:open-target sibling of office:open-file).
(b) Platform: delete /office route + OfficeLauncherPage (keep /office → redirect /), keep
editor routes and OfficePageChrome; extend desktop-bridge.ts to route into the SHELL
(allternit:open-view) when ShellApp is mounted ('/' or /shell), else navigate to the editor
route (fallback). Do NOT touch views/office, views/docs|sheets|slides, BrowserExtensionsView,
cowork/design embeds, add-ins, or PR #188 assistant work.

Just did:
- unified-main.ts: officeWindows/openOfficeWindow/resolveOfficeUrl removed; new
  deliverToMainWindow + pendingOfficeDeliveries queue flushed on main-window
  did-finish-load (registered in createMainWindow); openOfficeTarget;
  shell:open-docs/shell:open-office/file-assoc/OPEN_DOCS_ON_START all deliver to
  main window; tray 'Allternit Office' is now a single item opening the hub
  ('launcher' target → browser-extensions view in the bridge).
- preload: office.onOpenTarget added (office:open-target channel); onOpenFile kept.
- desktop-bridge.ts: in-shell open via allternit:open-view when ShellApp mounted
  ('/' or /shell), route-navigation fallback otherwise; file bytes via stashFile;
  'launcher' → browser-extensions hub.
- routes.tsx: /office route removed → redirect to '/'; OfficeLauncherPage deleted.
- Tests: desktop office-windows/docs-window rewritten for main-window delivery
  (context().addInitScript seeds onboarding key); platform office-launcher.spec
  → redirect + hub flows via new tests/helpers/office-hub.ts; office-markdown.spec
  repointed through the hub (URL assertions dropped, in-shell instead).
- docs office-suite.mdx updated (hub is the entry point; /office redirects).

Next:
1. VERIFY Playwright: DONE for platform — all 9 specs in office-launcher.spec.ts +
   office-markdown.spec.ts PASS (chromium via pw.scratch.config.ts executablePath →
   chromium-1234 build on port 5199; scratch config deleted after). Shared
   ms-playwright cache for pinned rev 1208 was churned by session webmcp-play;
   headless shell never completed. Fix applied during verification: hub pdf tests use
   getByText('hello.pdf').first() (strict-mode violation in-shell, 3 matches).
   NOTE: first cold-run pdf failures were cold-start flake; warm runs pass in ~20s.
2. Desktop electron specs (rewritten for main-window delivery; build:main +
   build:preload compiled clean): ATTEMPT RUNNING NOW in background task
   bash-w7via1vw (electron binary present via pnpm store). If it fails on
   environment (sidecars/ports), note honestly in PR.
3. Then: rm pw.scratch leftovers (done), commit/push/PR/merge, ledger, cleanup.

STATUS so far (all verified):
- Desktop typecheck (main+preload): PASS. Desktop vitest office-programs: 5/5 PASS.
- Platform typecheck: PASS. Platform vitest src/shell + src/views/office: 20/20 PASS.
- Platform vite build: PASS (11s).
- Code complete on both surfaces + docs mdx + tests rewritten.

Open questions:
- officePathFor stays exported+tested in office-programs.ts though now unused by main (pure
  helper module; kept deliberately).
