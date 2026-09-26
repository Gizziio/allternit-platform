---
status: done
date: 2026-09-26
title: Desktop Bridge Research — Programmatic Control of Consumer AI Desktop Apps
scope: ChatGPT Desktop, Claude Desktop, Kimi desktop app on single-tenant cloud desktops (macOS/Windows), unattended
---

# Desktop Bridge Research

Research into mature solutions for programmatically driving consumer AI desktop apps (type prompt, submit, read streaming response, detect completion, scrape progress UIs, capture artifacts) without brittle raw vision/OCR.

**Headline finding:** the "Electron CDP" hypothesis is half right. Claude Desktop is Electron on all platforms and accepts `--remote-debugging-port` (confirmed working in the wild). ChatGPT Desktop is Electron **only on Windows** — the Mac app is native Swift/AppKit. Kimi's official desktop app is **Tauri** (system webview, not bundled Chromium), so CDP works for it only on Windows (WebView2). Net: a Windows guest image gives full CDP/DOM automation for all three apps; a macOS guest forces accessibility-tree automation for ChatGPT and Kimi.

---

## Lane 1 — Electron CDP attach

### (a) Are these apps Electron?

- **Claude Desktop — yes, Electron, on both macOS and Windows.** Multiple independent confirmations: [Daring Fireball (2026-07)](https://daringfireball.net/2026/07/claudes_criminally_bad_mac_app_is_an_inside_job) ("Anthropic released the first version of the Claude 'desktop' app for MacOS in October 2024 — an Electron clunker"), [tonsky.me (2026-03)](https://tonsky.me/blog/fall-of-native/), [dbreunig.com (2026-02)](https://www.dbreunig.com/2026/02/21/why-is-claude-an-electron-app.html). The unofficial Linux repack [aaddrick/claude-desktop-debian](https://github.com/aaddrick/claude-desktop-debian) works by extracting the official `app.asar`, which is itself proof of the Electron packaging.
- **ChatGPT Desktop — split platform story.**
  - **Windows: Electron.** [Notebookcheck (2024-10)](https://www.notebookcheck.net/The-ChatGPT-app-for-Windows-is-simply-an-Electron-based-web-app.903810.0.html): "the ChatGPT app for Windows is a web wrapper in an Electron container." [Reddit r/Windows11](https://www.reddit.com/r/Windows11/comments/1g67rph/chatgpt_for_windows_is_now_official_and_its_an/): "ChatGPT for Windows is now official, and it's an Electron web-based app. The Mac app is fully native."
  - **macOS: native Swift/AppKit, NOT Electron.** [Hacker News thread](https://news.ycombinator.com/item?id=45663569): "ChatGPT on macOS isn't built with Electron, it links against macOS AppKit and the Swift libraries." Corroborated by [Allen Pike (2025-11)](https://allenpike.com/2025/why-is-chatgpt-so-good-claude/). **This kills the CDP plan for ChatGPT on a Mac guest.**
- **Kimi desktop — Tauri, not Electron.** The community rebuild [johnohhh1/kimi-app](https://github.com/johnohhh1/kimi-app) states: "The official Kimi desktop `.deb` (from kimi-moonshot) is built with Tauri v1, which hard-links `libwebkit2gtk-4.0.so.37`." The mirrored official repo metadata ([git.chanpinqingbaoju.com mirror](https://git.chanpinqingbaoju.com/kimi-moonshot/kimi-moonshot)) shows "Rust 100.00%" — the Tauri signature. Official downloads for Mac/Windows at [kimi.com/en/products/download](https://www.kimi.com/en/products/download). Moonshot also ships a separate agentic desktop product, "Kimi Work" (macOS Apple-silicon and Windows), per [explainx.ai (2026-07)](https://explainx.ai/blog/kimi-work-desktop-agent-webbridge-swarm-july-2026). Confidence: high that the official Kimi chat desktop app is Tauri; treat per-version verification of the installed binary as a launch checklist item.

### (b) Do they accept `--remote-debugging-port`?

- **Claude Desktop: confirmed working.** [jedi.be (2026-01)](https://jedi.be/blog/2026/automating-claude-desktop-via-chrome-devtools-protocol/): launching `/Applications/Claude.app/Contents/MacOS/Claude --remote-debugging-port=9222` exposes CDP at `localhost:9222`; the author demonstrates JS injection into the UI, MutationObserver-based response extraction, auto-clicking MCP permission dialogs, and multi-instance orchestration on different ports. Electron passes unknown Chromium switches through to the embedded Chromium, which is why this works on production Electron builds — see the debugging recipes in [this gist](https://gist.github.com/0xdevalias/428e56a146e3c09ec129ee58584583ba) and the general technique (`open -a "Slack" --args --remote-debugging-port=9222`) in [skills.rest's Electron automation notes](https://skills.rest/skill/electron-siarhei-belavus).
- **ChatGPT Desktop (Windows, Electron): same mechanism applies** — relaunching the installed binary with the flag is a supported Chromium behavior; no published evidence that OpenAI blocks it (verify per release; treat as checklist item).
- **Kimi (Tauri) on Windows: CDP works via WebView2.** WebView2 honors `--remote-debugging-port` passed via the `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` environment variable — documented by [Playwright's WebView2 docs](https://playwright.dev/docs/webview2) and [Meziantou](https://www.meziantou.net/debugging-a-webview2-using-playwright-in-dotnet.htm), and demonstrated end-to-end against a Tauri 2 app with Playwright `connectOverCDP` in [Haprog/playwright-cdp](https://github.com/Haprog/playwright-cdp). The [tauri-plugin-playwright](https://lib.rs/crates/tauri-plugin-playwright) crate documents exactly this Windows CDP mode. **On macOS, Tauri uses WKWebView — no CDP; only Safari's Web Inspector protocol, which is not attachable to a third-party app without it opting in.** On Linux it's WebKitGTK (Inspector protocol, similarly awkward).
- Caveat: on macOS, `open -a App --args` works for Electron apps, but hardened-runtime/notarized builds can still be relaunched directly via the inner Mach-O binary path (as in the jedi.be example), which bypasses LaunchServices arg quirks.

### (d) Hardening against CDP attach

Electron provides **fuses** (compile-time feature toggles) that can disable Node debugging flags and `RunAsNode`; the Chromium-side `--remote-debugging-port` is a "different beast" and historically not fully fuse-blockable — see [electron/fuses issue #2](https://github.com/electron/fuses/issues/2) and [electron issue #25651](https://github.com/electron/electron/issues/25651). [HackTricks' macOS Electron injection page (updated 2026-09)](https://hacktricks.wiki/en/macos-hardening/macos-security-and-privilege-escalation/macos-proces-abuse/macos-electron-applications-injection.html) confirms `--remote-debugging-port` remains usable against typical shipped Electron apps and recommends `EnableNodeCliInspectArguments`/`RunAsNode` fuses as defense — i.e., most vendors have not locked this down. Neither Claude Desktop nor ChatGPT Windows is known to ship hardened fuses today (Claude confirmed attachable per jedi.be). Risk: a vendor update could flip fuses at any time — this is the single biggest maintenance hazard of the CDP lane and must be monitored per app update.

### (e) Spectron deprecation and Playwright Electron maturity

- **Spectron: officially deprecated 2022-02-01**, archived by electron-userland — [github.com/electron-userland/spectron](https://github.com/electron-userland/spectron). Do not use.
- **Replacement: Playwright's `_electron` API** (first-party, [playwright.dev/docs/api/class-electron](https://playwright.dev/docs/api/class-electron)): launches Electron binaries, returns an `ElectronApplication`, gives full Playwright `Page` objects per window. Still labeled **experimental** in the docs as of 2026; supported Electron versions v14+ (v12.2.0+/v13.4.0+ for older minors). In practice it is the de-facto standard (used widely since Spectron's death; e.g. [simonwillison.net TIL](https://til.simonwillison.net/electron/testing-electron-playwright)) and there are community skill/packaging layers around it in 2026 ([tessl.io electron-playwright registry entry](https://tessl.io/registry/testland/electron-playwright)).
- For **attaching to an already-running app** (our case — the app is already logged in), the path is `chromium.connectOverCDP("http://localhost:9222")` against the debug port, rather than `_electron.launch`; both are first-party Playwright. This gives full DOM access with the same selectors as the web app.

**Lane 1 verdict: the winner where it applies — Claude Desktop (all OSes), ChatGPT Desktop (Windows only), Kimi (Windows only, via WebView2 CDP).**

---

## Lane 2 — Accessibility-tree automation frameworks

### macOS (AXUIElement)

- **Raw API:** `AXUIElement` via **pyobjc** is the canonical path; everything else wraps it.
- **pyatom/ATOMac** ([github.com/pyatom/pyatom](https://github.com/pyatom/pyatom)): first full Python AX library; stale (Python-2-era origins, last meaningful activity years ago). Fork **atomacos** ([daveenguyen.github.io/atomacos](https://daveenguyen.github.io/atomacos/readme.html)) modernized it via pyobjc. Usable but thin community.
- **pyax** (newer Swift-backed Python AX wrapper) exists but has a small user base; for a commercial product, pyobjc-direct calls are the most supportable.
- **Appium Mac2 driver** ([github.com/appium/appium-mac2-driver](https://www.npmjs.com/package/appium-mac2-driver)): actively maintained, W3C WebDriver protocol over Apple's XCTest/Accessibility stack; v2.x requires Appium 3; requires Xcode + accessibility permissions for the XCTest Helper. This is the most "enterprise-shaped" option for macOS native apps and the one testing communities recommend ([Ministry of Testing thread, 2025-09](https://club.ministryoftesting.com/t/macos-desktop-app-automation/86620)).
- Suitability for chat apps: AX works for the native ChatGPT Mac app (composer is an AX text area, response is AX static text — streamed text updates are observable via AX value changes / polling). It is slower and flakier than DOM but deterministic enough for a fixed, pinned app version.

### Windows (UI Automation)

- **FlaUI** (.NET, MIT): **the top choice.** Actively maintained, v5.0.0 released Feb 2025, wraps UIA2/UIA3 — [FlaUI repo](https://github.com/FlaUI/FlaUI) and the 2026 verified comparison at [KomuraSoft](https://comcomponent.com/en/blog/windows-desktop-ui-automation-testing/): "FlaUI … Actively maintained OSS. v5.0.0 released February 2025. Top choice."
- **pywinauto** (Python): maintained, "the strongest native option" for Python on Windows per [Test Guild (2026-05)](https://testguild.com/automation-tools-desktop/).
- **WinAppDriver: effectively dead for new adoption.** Last stable v1.2.1 was November 2020; industry guidance in 2026 is "not recommended for new adoption" ([KomuraSoft](https://comcomponent.com/en/blog/windows-desktop-ui-automation-testing/)); Katalon dropped its WinAppDriver-based library and moved to a FlaUI-based driver in v10.4.0 ([Katalon docs](https://docs.katalon.com/katalon-studio/create-test-cases/combine-katalon-studio-with-sap-scripting-tracker)).
- **Appium Windows driver** rides on WinAppDriver heritage; usable but inherits its stagnation. For new work: FlaUI (C#) or pywinauto (Python) directly.
- Suitability: on Windows, UIA against an Electron app exposes the Chromium AX tree (Electron apps report full DOM-ish AX trees to UIA), so UIA is a viable **fallback** to CDP even for Electron apps — but CDP is strictly better when available.

**Completion detection via AX/UIA:** poll the AX value of the response container or subscribe to AX notifications (`AXValueChanged`) / UIA TextPattern events; detect "stop generating" button presence as the streaming sentinel. Deterministic but requires per-app AX-tree mapping with Accessibility Inspector / Accessibility Insights.

---

## Lane 3 — Vision/agentic computer-use projects

| Project | License | Local (no third-party screen egress)? | Library vs agent loop | Maintenance (as of 2026-09) |
|---|---|---|---|---|
| OthersideAI **self-operating-computer** | MIT ([repo](https://github.com/OthersideAI/self-operating-computer); eval: [gitigit.dev](https://gitigit.dev/repository/othersideai-self-operating-computer)) | Yes if pointed at local models (Ollama); defaults push screenshots to OpenAI/Anthropic APIs | Python framework with an `operate` loop; embeddable but it's a research-grade agent loop, not a deterministic API | Low activity; ~10.3k stars, quality grade C in third-party telemetry |
| Simular **Agent S / S2 / S3** | Apache-2.0 ([github.com/simular-ai/Agent-S](https://github.com/simular-ai/agent-s), [opendeep.wiki license page](https://opendeep.wiki/simular-ai/Agent-S/license-and-community)) | Yes — supports Ollama/local VLMs; grounding model (UI-TARS-based) can be self-hosted | Framework (`gui_agents` Python package) with composable planner/grounding agents — the most library-shaped of the agent projects | Active; 12k+ stars; company behind it (Simular) funded and shipping |
| ByteDance **UI-TARS / UI-TARS-desktop** | Apache-2.0 ([bytedance/UI-TARS-desktop](https://github.com/bytedance/UI-TARS-desktop); [dev.to overview](https://dev.to/wonderlab/one-open-source-project-a-day-no-62-ui-tars-desktop-bytedances-open-source-multimodal-gui-53pm)) | Yes — self-hosted UI-TARS VLM endpoints supported ([pyshine](https://pyshine.com/UI-TARS-Desktop-ByteDance-Multimodal-AI-Agent/)) | Both: ships `@ui-tars/sdk` (automation SDK, cross-platform operators) **and** full agent apps; the largest open GUI-agent project (~33–34k stars, [crowdy.dev](https://crowdy.dev/en/2026/05/03/ui-tars-gui-agent/)) | Very active; evolved into "Agent TARS" ecosystem in 2026 |
| **OpenAdapt** | Original repo MIT; project **pivoted** | Local-first replay; commercial "OpenAdapt Execute" is a hosted partner service | Now a **governed demonstration compiler** — record once, compile, replay deterministically with zero model calls ([openadapt.ai/how-it-works](https://openadapt.ai/how-it-works), [openadapt-flow](https://github.com/OpenAdaptAI/openadapt-flow)) | Original OpenAdapt repo stalled; new org (openadapt-flow, openadapt-desktop) active in 2026 |
| Microsoft **OmniParser (v2)** | Code MIT; **model weights license unclear/changed** — HF card dropped the MIT tag in Feb 2025 ([HF discussion diff](https://huggingface.co/microsoft/OmniParser-v2.0/discussions/21/files)); YOLOv8 component is AGPL-derived (Ultralytics), which is a commercial-embedding red flag | Yes — fully local YOLOv8 + Florence-2 models | Detection/parsing library only (screenshot → structured elements); needs your own planner + input layer | Moderate; widely used as a grounding component (e.g. inside Agent S2, OmniTool) |
| Microsoft **Magma (Magma-8B)** | Research model; [github.com/microsoft/Magma](https://github.com/microsoft/magma), [HF card](https://huggingface.co/microsoft/Magma-8B) — "designed for research purposes" | Yes (self-hosted weights) | Foundation model for UI grounding/planning, **not** an automation library | Research release (CVPR 2025); not a product |
| XLANG/Moonshot **OpenCUA** | MIT, explicitly including commercial use ([github.com/xlang-ai/OpenCua LICENSE note](https://github.com/xlang-ai/OpenCUA)) | Yes — models (3B–32B) self-hostable | Full framework: AgentNet annotation tool, dataset, training pipeline, agent loop — research infrastructure, not a turnkey library | Active research project (OSWorld SOTA among open models per [VentureBeat](https://venturebeat.com/business/opencuas-open-source-computer-use-agents-rival-proprietary-models-from-openai-and-anthropic)) |
| THUDM **CogAgent** | Apache-2.0, free for commercial use ([HF card](https://huggingface.co/THUDM/CogAgent/blob/main/README.md), [Zhihu announcement](https://zhuanlan.zhihu.com/p/673724578)) | Yes | VLM (screenshot → next GUI action); needs your own loop/driver | Research-grade; last push Apr 2025 |

**OmniParser + a planner as a detection layer — production-ready?** Not as the primary driver for a commercial product: (1) it only detects/captions elements — you still need planning, action execution, and error recovery; (2) the AGPL-tainted YOLOv8 weights and the unclear v2 weight license are embedding hazards; (3) pixel grounding on chat UIs is unnecessary when DOM/AX access exists. It is reasonable as a **last-resort fallback** (e.g. canvas-rendered progress UIs that expose no AX nodes), preferring a cleanly-licensed grounding model (UI-TARS via Agent S2's grounding, Apache-2.0) over OmniParser.

**Lane 3 verdict:** useful as fallbacks and for artifact/progress scraping when DOM/AX fails; none should be the primary mechanism for a deterministic commercial bridge. Agent S2 (Apache-2.0) and UI-TARS SDK (Apache-2.0) are the only ones shaped like embeddable libraries.

---

## Lane 4 — RPA tools with desktop support

- **Robot Framework + RPA.Desktop / ImageHorizonLibrary** (rpaframework, Apache-2.0, [robocorp/rpaframework](https://github.com/robocorp/rpaframework)): image-template and coordinate-based desktop automation. Deterministic-ish but brittle to theme/DPI changes; Robocorp's focus shifted to Sema4.ai and the framework is in maintenance mode ([release notes trail](https://sema4.ai/docs/automation/release-notes)). Fine as a fallback clicker; not a primary.
- **TagUI**: **AI Singapore discontinued maintenance and support** ([aisingapore/TagUI README](https://github.com/aisingapore/TagUI)); community continues it ([Ken Soh's announcement](https://www.linkedin.com/posts/kensoh_happy-to-announce-the-tagui-rpa-is-back-to-activity-7231298106145853440-ATUJ)). Avoid for new commercial dependency.
- **OpenRPA** ([open-rpa/openrpa](https://github.com/open-rpa/openrpa)): still releasing (2025 releases), Windows-only, Windows Workflow Foundation-based, drag-and-drop designer oriented; embedding it as a library in a headless bridge is awkward. Not a sane dependency for this use case.
- **UI.Vision RPA + XModules**: core is open-source (GPL — copyleft red flag for commercial embedding), **XModules are closed-source freeware** ([forum confirmation](https://forum.ui.vision/t/is-xmodules-open-source/12517)); browser-extension-centric architecture with a command-line API. GPL core + closed desktop module = poor fit for a commercial product.
- **SikuliX**: "RaiMan stopped dev" per the [official site](https://sikulix.com/). Dead end.

**Lane 4 verdict:** none are a sane primary dependency. Robot Framework's desktop libraries are the least-bad fallback for synthetic input on a pinned image, but CDP/AX make them unnecessary.

---

## Lane 5 — Deep links, URL schemes, scripting interfaces

- **Claude Desktop: `claude://` deep links — official.** [Anthropic Help Center (2026-06)](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link): opening a `claude://` URL hands it to Claude on macOS/Windows (launching the app if needed) — can jump to a new chat or existing conversation. Claude Code (the CLI, different surface) has documented `claude-cli://` deep links that pre-fill prompts ([Claude Code docs](https://code.claude.com/docs/en/deep-links)). No AppleScript dictionary, no documented local IPC/API. Known Electron-shell quirk: custom schemes in rendered links aren't passed to the OS ([claude-code issue #26952](https://github.com/anthropics/claude-code/issues/26952)).
- **ChatGPT Desktop: no AppleScript dictionary, no documented URL scheme or local API.** OpenAI community threads confirm deep-linking is an unaddressed feature request ([OpenAI community, 2025-05](https://community.openai.com/t/support-custom-url-schemes-or-intent-handlers-to-trigger-specific-behaviors-in-the-chatgpt-mobile-app/1255168)). The Mac app does open `https://chat.openai.com/?q=...` links pre-populated when set as handler ([chorus.fm](https://chorus.fm/blog/chatgpt-url-scheme-works-on-ios-too/)) — usable to *open* a chat but not to submit or read. Community bridges automate the Mac app via AppleScript **keystroke simulation** + Shortcuts, e.g. the [ChatGPT macOS App MCP server](https://mcp.directory/servers/chatgpt-macos-app) — that's UI scripting, not a real API.
- **Kimi desktop: no documented deep links, AppleScript, or local API found.** Being a thin Tauri webview wrapper, the practical "shortcut" is that the entire app state lives at `kimi.moonshot.cn` / `kimi.com` — driving the web app directly (or via CDP into the webview) subsumes anything a URL scheme would do.

**Lane 5 verdict:** only Claude's `claude://` is real, and it solves session-opening, not prompt/read automation. No app offers a documented local automation API.

---

## Completion detection & streaming read, per lane

- **CDP/DOM (Lane 1):** best-in-class. Attach a `MutationObserver` to the response container (demonstrated against Claude Desktop by [jedi.be](https://jedi.be/blog/2026/automating-claude-desktop-via-chrome-devtools-protocol/)); completion = stop-generating button removed / send button re-enabled / DOM quiescence timeout. Artifacts (images, file cards, canvas blocks) are DOM nodes with real URLs — downloadable via the page's own session. Network-level interception (CDP `Network` domain) can capture the SSE stream directly, bypassing the DOM entirely.
- **AX/UIA (Lane 2):** poll `AXValue`/TextPattern of the response region, or subscribe to AX notifications; completion = streaming sentinel (stop button) disappearing + value stable for N polls. Artifacts must be captured via screenshots or AX-exposed links — weaker than DOM.
- **Vision/agentic (Lane 3):** OCR/screenshot diffing on the response region; completion inferred from stop-button template match or frame quiescence. Slowest, least reliable; only as fallback.
- **RPA (Lane 4):** image-template waits (wait-until-image-vanishes). Brittle; avoid as primary.

---

## Comparison table

| Lane | Mechanism | Determinism | Artifact capture | Guest OS | Commercial-embedding risk | Verdict |
|---|---|---|---|---|---|---|
| CDP attach (Electron/WebView2) + Playwright | DOM + network | High | Excellent (DOM URLs, network capture) | Win: all 3 apps. Mac: Claude only | Low (MIT tools); app-update fuse risk | **Primary where available** |
| macOS AX (pyobjc / Appium Mac2) | Accessibility tree | Medium-high | Medium | macOS | Low | Primary for ChatGPT Mac & Kimi Mac |
| Windows UIA (FlaUI / pywinauto) | Accessibility tree | Medium-high | Medium | Windows | Low (MIT) | Fallback on Windows |
| Agent S2 / UI-TARS SDK (vision) | Pixels + VLM | Low-medium | Medium (screenshots) | Any (needs GPU ideally) | Low (Apache-2.0) | Fallback for non-AX surfaces |
| OmniParser + planner | Pixels | Low | Medium | Any | **High** (AGPL-tainted weights, unclear v2 license) | Avoid |
| OpenAdapt (record/replay) | Compiled demo replay | High for fixed flows | Medium | Win/Mac | Low, but pivoted/commercial | Watchlist, not core |
| Robot Framework desktop libs | Image/coords | Low-medium | Low | Win/Mac/Linux | Low | Last-resort input layer |
| TagUI / SikuliX / WinAppDriver / OpenRPA / UI.Vision | — | — | — | — | GPL/closed/dead | **Do not adopt** |
| Deep links (`claude://`) | OS URL scheme | High (open only) | None | Win/Mac | None | Session-opening helper only |

---

## Recommended stack per app

### Claude Desktop
1. **Primary: CDP attach + Playwright `connectOverCDP`.** Relaunch with `--remote-debugging-port`, MutationObserver streaming read, DOM completion detection, network-layer artifact capture. Proven in the wild ([jedi.be](https://jedi.be/blog/2026/automating-claude-desktop-via-chrome-devtools-protocol/)). Works on macOS **and** Windows. Use `claude://` deep links for session navigation ([Anthropic Help Center](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)).
2. **Fallback:** AX/UIA (Appium Mac2 on macOS; FlaUI/pywinauto on Windows) if a future update blocks the debug port (fuses).

### ChatGPT Desktop
1. **Primary (Windows guest): CDP attach** — the Windows app is Electron ([Notebookcheck](https://www.notebookcheck.net/The-ChatGPT-app-for-Windows-is-simply-an-Electron-based-web-app.903810.0.html)).
2. **Primary (macOS guest): AX automation via pyobjc / Appium Mac2** — the Mac app is native Swift ([HN](https://news.ycombinator.com/item?id=45663569), [Allen Pike](https://allenpike.com/2025/why-is-chatgpt-so-good-claude/)); no CDP possible. AppleScript keystroke simulation (the community MCP-server approach) as a degraded tier.
3. **Fallback:** Agent S2 / UI-TARS vision loop.

### Kimi desktop
1. **Primary (Windows guest): WebView2 CDP** via `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=...` + Playwright ([Playwright WebView2 docs](https://playwright.dev/docs/webview2), [Haprog/playwright-cdp Tauri 2 example](https://github.com/Haprog/playwright-cdp)).
2. **Primary (macOS guest): AX automation** (Tauri/WKWebView exposes a partial AX tree); otherwise vision fallback.
3. **Alternative worth evaluating:** skip the desktop app entirely and drive the pinned web app in a managed Chromium — same account, same UI, full Playwright with zero attach hacks. (Confirm feature parity: desktop-only features like "Kimi Work" local-file access would not be covered.)

---

## Guest-OS recommendation

**Windows guest image is the strongly preferred target:** all three apps are CDP-automatable there (Claude = Electron, ChatGPT = Electron, Kimi = Tauri/WebView2), with UIA (FlaUI/pywinauto) as a uniform fallback and cheap licensing/infra. Choose **macOS only if a Mac-only feature is required** (e.g. ChatGPT Mac's Apple-ecosystem integrations); there you get CDP for Claude but must run AX-based drivers for ChatGPT and Kimi. Linux guests are not viable: no official ChatGPT/Claude desktop apps, and Kimi's official Linux build is a broken Tauri v1 `.deb` ([johnohhh1/kimi-app](https://github.com/johnohhh1/kimi-app)).

## Licensing / ToS red flags (commercial product)

- **Tooling licenses are mostly clean:** Playwright (Apache-2.0), FlaUI/pywinauto/Appium (MIT/Apache), Agent S2 + UI-TARS + OpenCUA + CogAgent (Apache-2.0/MIT, commercial OK).
- **OmniParser: avoid embedding** — Ultralytics YOLOv8 (AGPL) derived detection weights and an unclear/changed v2 weight license ([HF diff](https://huggingface.co/microsoft/OmniParser-v2.0/discussions/21/files)).
- **UI.Vision: GPL core + closed XModules** ([forum](https://forum.ui.vision/t/is-xmodules-open-source/12517)) — embedding red flag.
- **The bigger legal exposure is the AI vendors' consumer ToS, not the tooling.** OpenAI's Terms of Use govern ChatGPT usage ([openai.com/policies/row-terms-of-use](https://openai.com/policies/row-terms-of-use)) and Anthropic's Consumer Terms prohibit automated/bot access to the consumer service, with a carve-out only for Anthropic's own automation-shaped products like Claude Code ([autonomee.ai ToS analysis, 2026-02](https://autonomee.ai/blog/claude-code-terms-of-service-explained/), [terms.law Anthropic review](https://terms.law/ToS-Watchdog/ai-services/anthropic/)). "Powering a third-party product with a consumer subscription" and "automated or programmatic use" are exactly the patterns vendors enumerate as suspension triggers (see the representative fair-use language at [use.ai](https://use.ai/help/article/fair-usage-policy)). Driving a customer's own logged-in account on their behalf is a gray zone that needs per-vendor legal review before commercialization; the technical design should assume accounts can be rate-limited or flagged, and keep human-in-the-loop escape hatches.
- **Security note:** a CDP port on a logged-in session is full account access — bind to localhost only, never expose the port off the guest, and treat the guest image as a credential-bearing secret (the keylogger-grade risk is spelled out in [jedi.be](https://jedi.be/blog/2026/automating-claude-desktop-via-chrome-devtools-protocol/)).

---

## Recommended architecture

**Guest OS: Windows (pinned image).** Single-tenant cloud desktop, localhost-only automation endpoints.

1. **Primary driver (all three apps): Playwright over CDP.**
   - Claude Desktop: relaunch binary with `--remote-debugging-port=<port>` → `connectOverCDP`.
   - ChatGPT Desktop (Windows): same Electron mechanism.
   - Kimi (Windows): set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>` before launch → `connectOverCDP`.
   - Prompt injection: DOM fill + Enter/click; streaming read: MutationObserver; completion: stop-button removal + DOM quiescence; progress UIs: DOM scrape; artifacts: DOM node URLs fetched in-session, plus CDP Network-domain capture for generated files.
2. **Fallback driver: UIA layer** (pywinauto or FlaUI) mapped once per app version with Accessibility Insights; activates automatically if CDP attach fails (e.g. vendor flips Electron fuses in an update).
3. **Last-resort driver: Agent S2 (Apache-2.0) with a self-hosted UI-TARS grounding model**, for canvas/bitmap surfaces that expose neither DOM nor AX (e.g. image-generation progress canvases).
4. **Session helpers:** `claude://` deep links for Claude session routing; app-update watchdog that re-verifies CDP attach + selectors after every auto-update and quarantines the image on failure.
5. **If macOS guests are mandated:** CDP for Claude; Appium Mac2 (AX) for ChatGPT and Kimi; same fallback ladder. Expect ~2x the mapping/maintenance cost on Mac.

**Explicitly rejected:** Spectron (deprecated), WinAppDriver (dead), TagUI (unmaintained), SikuliX (abandoned), OmniParser-as-primary (license + capability), UI.Vision (GPL/closed), OpenRPA (wrong shape), self-operating-computer (stale research loop), raw OCR/coordinate RPA as anything but last resort.
