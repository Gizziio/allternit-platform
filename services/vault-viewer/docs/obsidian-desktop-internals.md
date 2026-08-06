# Obsidian Desktop 1.12.7 — Tri thức Reverse Engineering

> **Mục đích:** Tài liệu này ghi lại kết quả reverse engineering Obsidian Desktop App (bản 1.12.7, macOS)
> để WebObsidian có thể **sao chép chính xác** hành vi, format dữ liệu, và giao diện của Obsidian.
> Mọi regex, giá trị mặc định, schema JSON, công thức bên dưới đều được **trích xuất verbatim từ code thật**
> (asar đã extract), không phải từ tài liệu công khai.
>
> **Nguồn:** `/Applications/Obsidian.app/Contents/Resources/obsidian.asar` extract bằng
> `npx @electron/asar extract` → `app.js` (3.6MB renderer), `app.css` (588KB), `main.js` (60KB Electron main),
> `worker.js` (239KB Metadata Cache Worker), `sim.js` (Graph physics worker), `starter.js` (vault chooser),
> cùng vault thật `~/ObsidianVault-Trilium/.obsidian/`.
>
> **Thư viện đi kèm (lib/):** CodeMirror 6 (bundled trong app.js; lib/codemirror là CM5 chỉ cho sandbox/legacy),
> PixiJS (graph render), Mermaid, MathJax (tex-chtml-full), Prism (syntax highlight), PDF.js, moment,
> i18next, turndown (HTML→MD), readability, DOMPurify (bundled trong app.js).
>
> Cập nhật: 2026-06-10.

## Mục lục

1. [Electron shell, vault registry, obsidian:// protocol](#1-electron-shell)
2. [Object model lõi & hệ thống event](#2-object-model)
3. [Registry core plugins & view types](#3-core-plugins)
4. [Commands & hotkeys mặc định](#4-commands--hotkeys)
5. [Schema settings (.obsidian/) — đầy đủ](#5-settings-schema)
6. [Format workspace.json](#6-workspacejson)
7. [Markdown dialect — regex chính xác](#7-markdown-dialect)
8. [Link resolution & MetadataCache](#8-link-resolution--metadatacache)
9. [Editor: CodeMirror 6, Live Preview, suggesters, fuzzy search](#9-editor)
10. [Reading view & pipeline post-processing](#10-reading-view)
11. [Global Search: grammar & operators](#11-global-search)
12. [Quick Switcher](#12-quick-switcher)
13. [Graph view: physics & graph.json](#13-graph-view)
14. [Canvas (.canvas format)](#14-canvas)
15. [Bases (.base format)](#15-bases)
16. [Daily notes / Templates / Unique note](#16-daily-notes--templates)
17. [Xử lý file: attachments, rename, trash, recovery](#17-file-handling)
18. [Lưu trữ per-device: localStorage & IndexedDB](#18-per-device-state)
19. [Hệ thống CSS/theming — design tokens](#19-css-theming)
20. [Cấu trúc DOM class](#20-dom-classes)
21. [Callouts — bảng đầy đủ](#21-callouts)
22. [Checklist khi clone tính năng](#22-checklist-clone)

---

## 1. Electron shell

### Cửa sổ vault

```js
new BrowserWindow({
  width: 800, height: 600, minWidth: 200, minHeight: 150,
  backgroundColor: "#00000000",
  trafficLightPosition: { x: 19, y: 12 },
  show: false,
  frame: <true chỉ khi config.frame === "native">,
  titleBarStyle: <"default" nếu native frame, ngược lại "hidden">,
  webPreferences: { contextIsolation: false, nodeIntegration: true,
    nodeIntegrationInWorker: true, spellcheck: true, webviewTag: true },
  ...savedWindowState  // x,y,width,height khôi phục theo từng vault
})
```

- App load qua custom protocol `app://obsidian.md/index.html` (serve file từ asar, hỗ trợ Range,
  `X-Frame-Options: DENY`); một origin random thứ hai `app://<36 hex ngẫu nhiên>/` serve file local tùy ý
  (tài nguyên vault).
- Trạng thái cửa sổ mỗi vault lưu ở `<userData>/<vaultId>.json`: `{x, y, width, height, isMaximized, devTools, zoom}`
  (debounce 100ms khi move/resize). Khôi phục clamp tối thiểu 300×200, kiểm tra hiển thị trên mọi display.
- Vault chooser (starter): frameless 800×650, không resize, bg `#1e1e1e`. Help window: 600×680.
- Khởi động: mở mọi vault có `open: true` trong registry; nếu không có thì hiện starter.

### Vault registry — `<userData>/obsidian.json`

```jsonc
{
  "vaults": {
    "<vaultId>": { "path": "/abs/path", "ts": 1780115021752, "open": true }
  },
  // các key khác: "frame", "insider", "cli", "updateDisabled", "disableGpu",
  // "adblock", "adblockFrequency", "icon", "openSchemes"
}
```
- `vaultId` = 16 ký tự hex ngẫu nhiên (`(Math.random()*16|0).toString(16)` × 16).
- `ts` = `Date.now()` mỗi lần mở vault (độ "gần đây").
- `open: true` khi vault đang có cửa sổ (xóa khi đóng, trừ lúc quit) — dùng để khôi phục khi launch.
- Lookup vault theo id **hoặc** basename thư mục (không phân biệt hoa thường).

### Protocol `obsidian://`

Parse phía main process, payload tiêm vào renderer qua `window.OBS_ACT` (gọi nếu là function,
gán nếu chưa — SPA pick up lúc boot). Web clone có thể tái dùng contract này nguyên vẹn.

| URL | Action |
|---|---|
| `obsidian:///abs/path` | `{action:"open", path}` → tìm vault chứa path |
| `obsidian://vault/<tênHoặcId>/<file...>` | `{action:"open", vault, file}` |
| `obsidian://<action>?k=v&...#hash` | `{action, ...query, hash}` (param không giá trị → `"true"`) |

Handler phía renderer (Map `protocolHandlers`, mở rộng được qua `registerObsidianProtocolHandler`):
- **`open`** — file + subpath qua `getFirstLinkpathDest`, param `paneType`
- **`search`** — `query` → global-search
- **`new`** — params `file`/`name`, `content` | `clipboard`, `append`/`prepend`/`overwrite`, `silent`, `paneType`; tự tạo folder
- **`show-plugin`** (`id`), **`show-theme`** (`name`), **`show-release-notes`**, **`debug-info`**,
  **`publish-sites`**, **`sync-setup`**, **`vault-setup`**, **`hook-get-address`** (x-callback-url, gated bởi config `uriCallbacks`)
- Hỗ trợ x-callback-url chung qua params `x-success`/`x-error`.

### Kênh IPC chính

`is-dev, version, file-url, print-to-pdf, vault, vault-list, vault-remove, vault-move, vault-open,
vault-message, starter, help, sandbox, context-menu, request-url (proxy net.request), open-url,
trash (shell.trashItem), set-menu/render-menu, create-browser-session`, cùng CLI server qua local socket
(lệnh `obsidian` CLI, gated bởi setting `cli`).

---

## 2. Object model

### App (singleton, khởi tạo với `(adapter, appId)`)

`appId` = vault id — làm namespace cho localStorage (`<appId>-<key>`), IndexedDB (`<appId>-cache`, `<appId>-backup`),
webview partition (`persist:vault-<appId>`).

Thành phần: `keymap` (Keymap), `scope` (root Scope), `commands`, `hotkeyManager`, `dragManager`, `customCss`,
`embedRegistry`, `viewRegistry`, rồi `vault`, `workspace`, `fileManager`, `statusBar`, `metadataCache`,
`metadataTypeManager` (property types → `types.json`), `setting` (modal settings), `foldManager`
(fold state → localStorage `<appId>-note-fold-<path>`), `internalPlugins`, `plugins` (community).

**Thứ tự boot:** vault adapter → `vault.setupConfig` → Workspace/FileManager/StatusBar/MetadataCache/
MetadataTypeManager/Setting/FoldManager → áp theme/font/css → đăng ký built-in commands → load toàn bộ
internal plugins → `internalPlugins.enable()` → community plugins → `workspace.loadLayout()` →
`trigger("layout-ready")`.

### Vault + DataAdapter

- `fileMap: {path → TAbstractFile}` (TFile / TFolder), root `""`/`"/"`; `configDir` mặc định `".obsidian"`
  (đổi được, phải bắt đầu bằng `.`; tên thay thế lưu localStorage `<appId>-config`).
- Watcher thô của adapter → Vault map sự kiện: `folder-created`/`file-created` → `create`, `modified` → `modify`,
  `file-removed`/`folder-removed` → `delete`, `renamed` → `rename(file, oldPath)`, `closed` (mất thư mục vault),
  `raw(path)` (dotfiles — dùng hot-reload `app.json`, `appearance.json`, `hotkeys.json`, `core-plugins.json`,
  `data.json` của plugin → sống chung được với sync/multi-window).
- API adapter: `read/readBinary/write/writeBinary/append/process/mkdir/rmdir/remove/rename/copy/stat/exists/list/watch/getResourcePath`, `trashSystem` (OS trash) và `trashLocal` (chuyển vào `<vault>/.trash/`).
- Config: merge `appearance.json` rồi `app.json` (app thắng); `setConfig` debounce-save 1s và trigger
  `config-changed`; khi save tách key ngược lại 2 file theo whitelist appearance (§5).

### MetadataCache

- Parse trong `worker.js` (Worker riêng tên "Metadata Cache Worker"). Protocol: post
  `{metadataCache: <ArrayBuffer bytes file>}` → trả `CachedMetadata` (§8).
- Cache bền: IndexedDB **`<appId>-cache`** (version **19**), 2 store:
  - `file`: path → `{hash, mtime, size}`
  - `metadata`: hash → CachedMetadata; `hash` = **SHA-256 hex của raw bytes**.
  - Boot revalidate bằng `mtime`+`size`; lệch → parse lại. Dọn path đã xóa mỗi 600s.
- Duy trì `resolvedLinks` / `unresolvedLinks`: `{sourcePath: {targetPath|linktext: count}}` — nguồn cho graph/backlinks.
- Event: `changed` (metadata file đổi), `deleted`, `resolve` (links 1 file), `resolved` (cả vault xong), `finished` (index lần đầu).
- API: `getFileCache, getCache, getFirstLinkpathDest, getLinkpathDest, fileToLinktext, iterateAllRefs, isUnresolved`.

### Workspace

- Cây item: `WorkspaceItem → WorkspaceParent → WorkspaceSplit / WorkspaceTabs / WorkspaceLeaf`,
  root split, sidebar trái/phải, floating (popout), mobile drawers.
- Field: `rootSplit, leftSplit, rightSplit, floatingSplit, leftRibbon, activeLeaf, activeTabGroup,
  recentFileTracker (lastOpenFiles), undoHistory (Mod+Shift+T), protocolHandlers, hoverLinkSources`
  (đăng ký sẵn: `editor, preview, search, graph, outline, properties, file-explorer, bases, tab-header`).
- `requestSaveLayout` debounce 1s. Leaf: `setViewState({type, state, active, pinned, group})`, history
  back/forward (serialize được), **deferred views** (placeholder "DeferredView" khi tab không hiển thị,
  load qua `loadIfDeferred`), pin, group (linked panes).

### Keymap & Scope

- Keymap global, **stack** scope (`pushScope/popScope`), bắt `keydown` capture trên window;
  modifier chuẩn hóa thành chuỗi sort `"Alt,Ctrl,Meta,Shift"`; `"Mod"` = Meta trên macOS / Ctrl nơi khác.
  Handler trả `false` → `preventDefault`.
- `Scope.register(modifiers, key, func)`; scope chain lên parent.

### Commands & HotkeyManager

- `addCommand({id, name, icon, callback | checkCallback | editorCallback | editorCheckCallback, hotkeys, ...})`.
- HotkeyManager: `defaultKeys` (từ addCommand) + `customKeys` từ `<configDir>/hotkeys.json` (hot-reload).

### Toàn bộ tên event `trigger("...")` tìm thấy

```
active-leaf-change, bookmarks:bookmarks-menu, canvas:edge-menu, canvas:node-connection-drop-menu,
canvas:node-menu, canvas:selection-menu, change, changed, closed, config-changed, create, css-change,
delete, deleted, editor-change, editor-drop, editor-menu, editor-paste, editor-selection-change,
extensions-updated, file-created, file-menu, file-open, file-removed, files-menu, finished,
folder-created, folder-removed, group-change, history-change, hover-link, input, layout-change,
layout-ready, leaf-menu, markdown-properties-menu, markdown-scroll, markdown-viewport-menu, modified,
modify, navigated, new-log, options-updated, pinned-change, post-processor-change, quick-preview,
quit, raw, receive-files-menu, receive-text-menu, rename, renamed, resize, resolve, resolved,
search:results-menu, status-change, swipe, tab-group-menu, url-menu, view-changed, view-registered,
view-unregistered, webviewer:update-history, window-close, window-frame-change, window-open
```
(Vault: `create/modify/delete/rename/raw/closed/config-changed`; MetadataCache: `changed/deleted/resolve/resolved/finished`;
Workspace: `active-leaf-change/file-open/layout-change/layout-ready/css-change/resize/quick-preview/hover-link/...`).

---

## 3. Core plugins

31 internal plugins. Trạng thái bật/tắt ở `core-plugins.json` (`{id: bool}`); thiếu key → fallback `defaultOn`.
Legacy id `starred` → `bookmarks`.

| id | mặc định | view types đăng ký | ghi chú |
|---|---|---|---|
| `audio-recorder` | off | — | ghi `Recording YYYYMMDDHHmmss.<ext>` vào attachments |
| `backlink` | **on** | `backlink` | + "backlinks in document" |
| `bases` | **on** | `bases` (+ ext `.base`); layout nội bộ `table`, `cards`, `list` | DB views |
| `bookmarks` | **on** | `bookmarks` | `bookmarks.json` |
| `canvas` | **on** | `canvas` (+ ext `.canvas`) | |
| `command-palette` | **on** | — (modal) | `recentCommands` |
| `daily-notes` | **on** | — | |
| `editor-status` | **on** (ẩn khỏi list) | — | status bar Editing/Reading |
| `file-explorer` | **on** | `file-explorer` | |
| `file-recovery` | **on** | — | snapshot → IndexedDB |
| `footnotes` | off | `footnotes` | panel footnotes (mới 1.12) |
| `global-search` | **on** | `search` | |
| `graph` | **on** | `graph`, `localgraph` | |
| `markdown-importer` | off | — | |
| `note-composer` | **on** | — | extract/merge/split |
| `outgoing-link` | **on** | `outgoing-link` | |
| `outline` | **on** | `outline` | |
| `page-preview` | **on** | — | hover popover, per-source `overrides` |
| `properties` | **on** | `all-properties`, `file-properties` | |
| `publish` | off | — | |
| `random-note` | off | — | |
| `slash-command` | off | — | `/` suggest |
| `slides` | off | — | |
| `switcher` | **on** | — (modal) | |
| `sync` | **on** (idle đến khi cấu hình) | `sync` | IndexedDB `<appId>-sync` |
| `tag-pane` | **on** | `tag` | |
| `templates` | **on** | — | |
| `webviewer` | off (desktop only) | `webviewer`, `webviewer-history` | |
| `word-count` | **on** | — | status bar |
| `workspaces` | off | — | `workspaces.json` |
| `zk-prefixer` | off | — | Unique note creator |

### ViewRegistry built-in (luôn đăng ký)

| view type | extensions |
|---|---|
| `markdown` | `md` |
| `image` | `bmp, png, jpg, jpeg, gif, svg, webp, avif` |
| `audio` | `mp3, wav, m4a, 3gp, flac, ogg, oga, opus` |
| `video` | `mp4, webm, ogv, mov, mkv` |
| `pdf` | `pdf` |
| `release-notes`, `empty` | — |

Extension không đăng ký → mở bằng app mặc định của OS (trừ khi `showUnsupportedFiles`).

---

## 4. Commands & hotkeys

~196 command id namespaced. `Mod` = Cmd (macOS) / Ctrl. **Đậm** = có hotkey mặc định.

**App:** `app:delete-file`, **`app:go-back`** (Mod+Alt+←), **`app:go-forward`** (Mod+Alt+→),
`app:open-another-vault`, **`app:open-help`** (F1), `app:open-sandbox-vault`, **`app:open-settings`** (Mod+,),
`app:open-vault`, `app:reload`, `app:show-debug-info`, `app:show-release-notes`, `app:show-tab-switcher`,
`app:switch-vault`, `app:toggle-left-sidebar`, `app:toggle-right-sidebar`, `app:toggle-ribbon`,
`theme:switch`, `theme:toggle-light-dark`, `window:zoom-in/out`, `window:reset-zoom`, `window:toggle-always-on-top`.

**Editor:** `editor:add-cursor-above/below`, `editor:attach-file`, `editor:clear-formatting`,
`editor:cycle-list-checklist`, **`editor:delete-paragraph`** (Mod+D), `editor:focus(-left/right/up/down)`,
`editor:fold-all/fold-less/fold-more/unfold-all`, **`editor:follow-link`** (Alt+Enter),
`editor:insert-callout/codeblock/embed/footnote/horizontal-rule/mathblock/table/tag/wikilink`,
**`editor:insert-link`** (Mod+K), **`editor:open-link-in-new-leaf`** (Mod+Enter),
**`editor:open-link-in-new-split`** (Mod+Alt+Enter), **`editor:open-link-in-new-window`** (Mod+Alt+Shift+Enter),
**`editor:open-search`** (Mod+F), **`editor:open-search-replace`** (Mod+H), `editor:redo/undo`,
`editor:rename-heading`, **`editor:save-file`** (Mod+S), `editor:set-heading(-0..6)`, `editor:swap-line-up/down`,
`editor:table-*` (thao tác hàng/cột), `editor:toggle-blockquote`, **`editor:toggle-bold`** (Mod+B),
`editor:toggle-bullet-list`, **`editor:toggle-checklist-status`** (Mod+L), `editor:toggle-code`,
**`editor:toggle-comments`** (Mod+/), `editor:toggle-fold`, `editor:toggle-highlight`,
`editor:toggle-inline-math`, **`editor:toggle-italics`** (Mod+I), `editor:toggle-line-numbers`,
`editor:toggle-numbered-list`, `editor:toggle-readable-line-length`, `editor:toggle-source`,
`editor:toggle-spellcheck`, `editor:toggle-strikethrough`, `editor:indent-list/unindent-list`,
`markdown:add-alias`, **`markdown:add-metadata-property`** (Mod+;), `markdown:clear-metadata-properties`,
**`markdown:toggle-preview`** (Mod+E).

**Workspace:** **`workspace:close`** (Mod+W), `workspace:close-others`, `workspace:close-tab-group`,
**`workspace:close-window`** (Mod+Shift+W), `workspace:copy-path/copy-full-path/copy-url`,
**`workspace:edit-file-title`** (F2), `workspace:export-pdf`, **`workspace:goto-tab-1…8`** (Mod+1…8),
**`workspace:goto-last-tab`** (Mod+9), `workspace:move-to-new-window`, **`workspace:new-tab`** (Mod+T),
`workspace:new-window`, **`workspace:next-tab`** (Ctrl+Tab; macOS thêm Meta+Shift+]),
**`workspace:previous-tab`** (Ctrl+Shift+Tab; macOS Meta+Shift+[), `workspace:show-trash` (khi trashOption=local),
`workspace:split-horizontal/vertical`, `workspace:toggle-pin`, `workspace:toggle-stacked-tabs`,
**`workspace:undo-close-pane`** (Mod+Shift+T).

**Plugin:** **`command-palette:open`** (Mod+P); **`switcher:open`** (Mod+O); **`global-search:open`** (Mod+Shift+F);
**`graph:open`** (Mod+G), `graph:open-local`, `graph:animate`; **`file-explorer:new-file`** (Mod+N),
**`file-explorer:new-file-in-new-pane`** (Mod+Shift+N), `file-explorer:new-folder/duplicate-file/move-file/reveal-active-file`;
`backlink:open(-backlinks)`, `backlink:toggle-backlinks-in-document`; `bookmarks:open`,
`bookmarks:bookmark-current-view/-search/-section/-heading`, `bookmarks:bookmark-all-tabs`;
`canvas:new-file/convert-to-file/export-as-image/jump-to-group`; `daily-notes`, `daily-notes:goto-prev/next`;
`note-composer:extract-heading/merge-file/split-file`; `outline:open(-for-current)`; `outgoing-links:open(-for-current)`;
`properties:open(-local)`; `random-note`; `tag-pane:open`; `templates:insert-template`;
`workspaces:load/save/open-modal`; `file-recovery:open`; `open-with-default-app:open/show`;
`audio-recorder:start/stop`; `slides:start`; `sync:*`; `webviewer:*`; `bases:*`.

Cặp ký tự toggle định dạng: bold `**` (alt `__`), italic `*` (alt `_`), code `` ` ``, highlight `==`,
strikethrough `~~`, comment `%%`, math `$`.

Hotkey tùy biến: `.obsidian/hotkeys.json` — `{ "<command-id>": [{ "modifiers": ["Mod"], "key": "F" }] }`;
**mảng rỗng `[]` = gỡ hotkey mặc định**.

---

## 5. Settings schema

Một object defaults duy nhất; khi save, key thuộc whitelist appearance ghi vào **`appearance.json`**,
còn lại vào **`app.json`**. **Chỉ ghi key khác default** (vault mới ⇒ `{}`).

### appearance.json

| key | type | default | ý nghĩa |
|---|---|---|---|
| `accentColor` | string | `""` | hex; rỗng = tím mặc định |
| `theme` | string | `"system"` | `"system"` \| `"obsidian"` (dark) \| `"moonstone"` (light) |
| `cssTheme` | string | `""` | tên thư mục theme trong `.obsidian/themes/` |
| `enabledCssSnippets` | string[] | `[]` | tên file (không `.css`) trong `snippets/` |
| `showViewHeader` | bool | `true` | |
| `showRibbon` | bool | `true` | |
| `nativeMenus` | bool\|null | `null` | |
| `translucency` | bool | `false` | |
| `textFontFamily` / `interfaceFontFamily` / `monospaceFontFamily` | string | `""` | (legacy `editorFontFamily` → `textFontFamily`) |
| `baseFontSize` | number | `16` | px |
| `baseFontSizeAction` | bool | `false` | |
| `slidingSidebar` / `floatingNavigation` / `autoFullScreen` | bool | `true` | mobile |

### app.json

| key | type | default | ý nghĩa |
|---|---|---|---|
| `alwaysUpdateLinks` | bool | `false` | tự update link khi rename, không hỏi |
| `spellcheck` | bool | `true` | |
| `spellcheckLanguages` | string[]\|null | `null` | |
| `readableLineLength` | bool | `true` | giới hạn bề rộng dòng |
| `strictLineBreaks` | bool | `false` | |
| `propertiesInDocument` | string | `"visible"` | `"visible"\|"hidden"\|"source"` |
| `showInlineTitle` | bool | `true` | |
| `showUnsupportedFiles` | bool | `false` | |
| `autoPairBrackets` / `autoPairMarkdown` | bool | `true` | |
| `smartIndentList` | bool | `true` | |
| `foldHeading` / `foldIndent` | bool | `true` | |
| `showLineNumber` | bool | `false` | |
| `showIndentGuide` | bool | `true` | |
| `useTab` | bool | `true` | |
| `tabSize` | number | `4` | |
| `rightToLeft` | bool | `false` | |
| `autoConvertHtml` | bool | `true` | paste HTML → MD |
| `vimMode` | bool | `false` | |
| `livePreview` | bool | `true` | chế độ edit mặc định là LP |
| `defaultViewMode` | string | `"source"` | `"source"` (edit) \| `"preview"` (reading) |
| `useMarkdownLinks` | bool | `false` | `[]()` thay wikilink |
| `newLinkFormat` | string | `"shortest"` | `"shortest"\|"relative"\|"absolute"` |
| `attachmentFolderPath` | string | `"/"` | `"/"`=root, `"./"`=cạnh note, `"./sub"`=subfolder cạnh note, `"name"`=folder cố định |
| `newFileLocation` | string | `"root"` | `"root"\|"current"\|"folder"` |
| `newFileFolderPath` | string | `"/"` | dùng khi `newFileLocation==="folder"` |
| `userIgnoreFilters` | string[]\|null | `null` | Excluded files |
| `focusNewTab` | bool | `true` | |
| `promptDelete` | bool | `true` | |
| `trashOption` | string | `"system"` | `"system"\|"local"(.trash/)\|"none"` |
| `deleteUnlinkedAttachments` | string | `"ask"` | `"ask"\|"always"\|"never"` |
| `openBehavior` | string | `""` | `"daily"` = mở daily note lúc launch |
| `pdfExportSettings` | object | `{pageSize:"Letter",landscape:false,margin:"0",downscalePercent:100}` | |
| `uriCallbacks` | bool | `false` | cho phép `hook-get-address` |

### Toàn bộ file trong `.obsidian/`

| File | Schema |
|---|---|
| `app.json`, `appearance.json` | trên |
| `core-plugins.json` | `{ "<plugin-id>": bool }` |
| `community-plugins.json` | **mảng** id plugin đang bật |
| `hotkeys.json` | `{ "<command-id>": [{modifiers, key}] }`; `[]` = gỡ default |
| `graph.json` | §13 |
| `canvas.json` | `{ "snapToObjects": bool, "snapToGrid": bool }` |
| `switcher.json` | `{ showExistingOnly:false, showAttachments:true, showAllFileTypes:false }` |
| `daily-notes.json` | `{ format:"" (moment, mặc định "YYYY-MM-DD"), folder:"", template:"" }` |
| `templates.json` | `{ folder:"", dateFormat:"" ("YYYY-MM-DD"), timeFormat:"" ("HH:mm") }` |
| `zk-prefixer.json` | `{ format:"" ("YYYYMMDDHHmm"), folder:"", template:"" }` |
| `bookmarks.json` | `{ items: [...] }` — types: `file` (`{type,ctime,path,subpath?,title?}` — heading/block bookmark là file+subpath), `folder`, `group` (`{items:[...], title}` lồng được), `search` (`{query}`), `graph` (`{title, options:<như graph.json>}`), `url` |
| `workspace.json` / `workspace-mobile.json` | §6 |
| `workspaces.json` | `{ workspaces: { "<tên>": <layout đầy đủ> }, active: "<tên>" }` |
| `types.json` | `{ types: { "<PropertyName>": "<widget>" } }` — widget: `text, multitext, number, checkbox, date, datetime, tags, aliases` (ép buộc: `aliases→aliases`, `cssclasses→multitext`, `tags→tags`) |
| `snippets/` | file `<name>.css` |
| `themes/<Tên>/` | `manifest.json` (`{name, version, minAppVersion, author, authorUrl}`) + `theme.css` |
| `plugins/<id>/` | `manifest.json` (`{id,name,version,minAppVersion,description,author,authorUrl,isDesktopOnly}`), `main.js`, `styles.css`, `data.json` |
| `<plugin-id>.json` khác | settings core plugin theo pattern `<id>.json` (`backlink.json`, `note-composer.json`, `page-preview.json`, …) |

---

## 6. workspace.json

Ghi bởi `Workspace.saveLayout()` (debounce 1s), JSON pretty-print:

```jsonc
{
  "main":  { /* root split */ },
  "left":  { /* sidebar trái */ },
  "right": { /* sidebar phải */ },
  "left-ribbon": { "hiddenItems": { "<pluginId>:<Title>": false } }, // thứ tự = thứ tự key
  "floating": { "type": "floating", "children": [ /* popout windows */ ] }, // chỉ khi có popout
  "active": "<leaf id>",
  "lastOpenFiles": ["path1", "..."]
}
```

Node (đều có `id` hex ngẫu nhiên, tùy chọn `dimension` = flex-grow %):
- **split**: `{id, type:"split", direction:"vertical"|"horizontal", children:[...]}`. Root ép `vertical`;
  sidebar `horizontal` + thêm `width` (px) và `collapsed: true`.
- **tabs**: `{id, type:"tabs", children:[leaf...], currentTab?: n (bỏ nếu 0), stacked?: true}`.
- **leaf**: `{id, type:"leaf", state:{type:"<viewType>", state:{file, mode:"source"|"preview", source:bool, ...}, pinned?, icon, title}, group?, pinned?}`
  — `icon`/`title` lưu để deferred view vẽ tab header mà không cần khởi tạo view. Leaf history
  (back/forward) cũng serialize cho undo-close.
- **window** (trong floating): `{id, type:"window", children, x, y, width, height, maximize, zoom}`.

Luật deserialize: leaf trần nằm ngay dưới split → tự bọc vào `tabs`; container rỗng bị tỉa; view type
lạ → placeholder "plugin missing"; thiếu `main` → tabs+empty leaf mới, mở lại `lastOpenFiles[0]`.

Ví dụ view state search (live): `{"type":"search","state":{"query":"...","matchingCase":false,"explainSearch":false,"collapseAll":false,"extraContext":false,"sortOrder":"alphabeticalReverse"}}`.

---

## 7. Markdown dialect

Parser reading-view/metadata = fork **remark** với `{breaks: true, commonmark: true}` —
**xuống dòng đơn render thành `<br>`**. Cùng code parser nhân bản trong `worker.js`.
Editor dùng mode **HyperMD** stream (CM5-style) adapt vào CM6, options:
`{front_matter, math, table, toc, hashtag, fencedCodeBlockHighlighting, highlightFormatting, taskLists,
strikethrough, highlight, headers, blockquotes, indentedCode, lists, hr, blockId: true; emoji: false}`.

### Wikilink & embed

- Regex inline (ưu tiên trước `link`): locator `/!?\[\[/g`, match **`/^(!?)\[\[(.+?)]]/`**.
  Nội dung `.trim()`; **loại nếu chứa `[[` lồng**. `!` → embed (`<span class="internal-embed" src alt>`),
  không → `<a class="internal-link" href data-href>`.
- Tách alias: alias = sau dấu `|` **đầu tiên** (index > 0), trim; href = trước `|`, strip `\` cuối, rồi
  `href.replace(/ /g," ").trim().normalize("NFC")`.
- **Display text mặc định** (không alias): `href.split("#").filter(Boolean).join(" > ")` —
  `[[Note#Head]]` hiển thị `Note > Head`. Link có alias thêm `aria-label` = display mặc định.
- Subpath: tách tại `#` đầu → `{path, subpath}`. `#^` = block, `#[^` = footnote, còn lại heading;
  heading đa cấp `#H1#H2` resolve tuần tự.
- **Size param ảnh**: segment `|` cuối của alt khớp `/^\s*([0-9]+)\s*(?:x\s*([0-9]+)\s*)?$/` →
  attr `width`(/`height`), bỏ khỏi alt. Áp cho `![[img|300]]`, `![[img|300x200]]`, `![alt|300](url)`.
- Extension embed được: ảnh/audio/video/pdf (bảng §3) + `md`, `canvas`, `base`. PDF hỗ trợ `#page=N`
  (`&selection=...`, `&annotation=ID`).
- Markdown link `[]()` trỏ nội bộ vault → convert thành cùng node ilink/iembed (decodeURI + NFC).
- Ký tự **cấm trong link text**: `#^[]|`; cấm trong filename: (Win) `*"\/<>:|?`, (khác) `\/:`.

### Block ID `^id`

- Inline: `/^\^([a-zA-Z0-9\-]+)$/` (trước đó phải là whitespace, phải kết thúc run).
- Cuối paragraph: `/^\^([a-zA-Z0-9\-]+)(?=$|\n$|\n\n)/` — id trên dòng riêng gắn vào block **trước**.
- **Charset chỉ `[a-zA-Z0-9-]`.** Key cache lowercase.
- **Tự sinh**: 6 hex ngẫu nhiên, chèn `#^<id>` vào link và ` ^<id>` cuối dòng.

### Tag

- Regex reading/metadata: **`/^#[^ -⁯⸀-⹿'!"#$%&()*+,.:;<=>?@^`{|}~\[\]\\\s]+/`**
  (trước phải là whitespace/đầu text); **loại nếu thuần số** `/^#\d+$/`. Render `<a class="tag" href="#tag">`.
- Editor thêm điều kiện phải chứa ít nhất 1 chữ cái (`/[a-z]/i`).
- Cho phép: chữ, số, `_`, `-`, `/` (nested `a/b`), emoji, non-ASCII.
- Tag frontmatter: key `/^tags$/i` (migrate `tag`), string split `/[ ,\n]/`, bỏ entry chứa space, tự thêm `#`.

### Callout

- Regex (dòng đầu blockquote, cả editor lẫn reading): **`/^\[!([^\]]+)\]([+\-]?)(?:\s|$)/`**
  - Group 1 tách tại `|` đầu: trước = type, sau = metadata (`data-callout-metadata`).
  - Chuẩn hóa type: `.trim().toLowerCase().replace(/\s+/g,"-")`.
  - Group 2: `+` mở sẵn foldable, `-` gập sẵn, rỗng = không fold.
- DOM: `div.callout[data-callout][data-callout-fold][data-callout-metadata]` →
  `div.callout-title` (`div.callout-icon` + `div.callout-title-inner`) + `div.callout-content`.
- Title mặc định: type thay `-`→space, viết hoa chữ đầu. Title = phần còn lại dòng đầu.
- Màu custom: `color` dạng `#rgb/#rrggbb` trong data → inline `--callout-color: "r,g,b"`.
- Bảng type đầy đủ: §21.

### Frontmatter / Properties

- Block tokenizer `onlyAtStart`: document phải bắt đầu đúng `---\n`; `---` đóng phải sau `\n`;
  parse bằng yaml lib; chỉ giữ nếu là plain object.
- Key reserved (ép widget): `aliases → aliases`, `cssclasses → multitext`, `tags → tags`.
  Migration (case-insensitive): `tag→tags`, `alias→aliases`, `cssclass→cssclasses`; string split `/[ ,\n]/`;
  entry `cssclasses` chứa space bị bỏ.
- **Suy luận type**: `null→text`; string khớp `/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d$/`→`datetime`,
  `/^\d{4}-[01]\d-[0-3]\d$/`→`date`, còn lại `text`; number→`number`; boolean→`checkbox`;
  array→`multitext`; khác→`unknown`.
- Format hiển thị datetime chấp nhận: `YYYY-MM-DD[T]HH:mm:ss`, `YYYY-MM-DD[T]HH:mm`,
  `YYYY-MM-DD HH:mm:ss`, `YYYY-MM-DD HH:mm`.
- Type người dùng gán lưu `.obsidian/types.json` (watch + hot reload).

### Inline khác

- **Highlight** `==...==`: mở bằng `==` không theo sau whitespace, không phải `====`; đóng ở `==` kế → `<mark>`.
- **Strikethrough** `~~...~~` (GFM).
- **Comment** `%%...%%`: inline `/^%%(.+?)%%/` — bị **drop khỏi output**; block-level `%%` fence theo dòng.
- **Footnote**: ref `[^id]` → `<sup class="footnote-ref" data-footnote-id="fnref-N">` (đánh số theo thứ tự,
  `-k` cho ref lặp); definition `[^id]: ...` (dòng tiếp indent 4 space/tab); **inline `^[note]`**
  (scan escape `\\` + đếm `[` lồng). Editor regex footref: `/^\[\^([^\]\s]*?)\](:?)/`.
- **Math**: scan ký tự (không regex đơn): `\$` escape; inline `$...$` — mở không được theo sau space/tab,
  đóng không sau space/tab và không trước chữ số; `$$...$$` block. Render **MathJax** (lazy).
- **Code fence**: ``` hoặc `~~~`; info-string `/^\s*(~~~+|```+)[ \t]*([\w\/+#-]*)[^\n`]*$/`;
  render `<pre><code class="language-X">` + **Prism** (lazy). Indented code có hỗ trợ.
- **Mermaid**: fence lang đúng `"mermaid"` → lazy load, render vào `div.mermaid`; label chứa
  internal link được hậu xử lý thành `a.internal-link`.
- **HTML**: cho phép nhưng **mọi section đi qua DOMPurify** với config:
  `{ALLOW_UNKNOWN_PROTOCOLS:true, RETURN_DOM_FRAGMENT:true, FORBID_TAGS:["style"], ADD_TAGS:["iframe"],
  ADD_ATTR:["frameborder","allowfullscreen","allow","sandbox","data-tooltip-position"]}`.
  Hook: mọi `<a>` → `target="_blank" rel="noopener nofollow"`; mọi `<iframe>` ép
  `sandbox="allow-forms allow-modals allow-presentation allow-same-origin allow-scripts"`.
- **External link**: `class="external-link" target="_blank" rel="noopener nofollow"`.

### Task list

- List item bắt đầu `[c]` với `c` là **bất kỳ 1 ký tự**: `checked = c !== " "`; DOM
  `li.task-list-item[data-task="c"]` (+ `.is-checked`) chứa `input.task-list-item-checkbox`.
- **Không có danh sách custom state hard-code** — các state `/ - > < ? !...` là quy ước theme
  (CSS core chỉ style `data-task="x"|"X"`). Click checkbox toggle `" "` ↔ `"x"`;
  Mod+L cycle qua regex `/\[.\]/`.

---

## 8. Link resolution & MetadataCache

### `getFirstLinkpathDest(linkpath, sourcePath)` — luật từng bước

1. Linkpath rỗng + có sourcePath ⇒ chính file nguồn (self-link `[[#heading]]`).
2. Lowercase linkpath; lấy basename; nếu có `.` → tra `uniqueFileLookup` (multi-map key =
   **filename lowercase kèm extension**). Trượt → thử `linkpath + ".md"`. Vẫn trượt ⇒ unresolved.
3. Linkpath không có folder + đúng 1 ứng viên ⇒ xong (happy case shortest path).
4. Prefix `./` / `../`: resolve theo `dirname(sourcePath)`, chỉ nhận match path chính xác.
5. Prefix `/` ⇒ vault-absolute: chỉ match full path chính xác.
6. Còn lại: full-path match thắng; nếu không, gom mọi ứng viên có path lowercase **kết thúc bằng**
   linkpath, chia 2 nhóm (cùng folder với nguồn ưu tiên trước), mỗi nhóm **sort theo độ dài path tăng dần**, nối lại.

- **Mọi thứ case-insensitive**; hòa → "cùng folder trước, rồi path ngắn nhất".
- Key unresolved chuẩn hóa bằng cách strip `.md` cuối.
- `fileToLinktext` theo `newLinkFormat`: absolute = full path (bỏ `.md`); relative = path `../` từ folder nguồn;
  shortest = basename, nhưng nếu basename resolve ngược không về đúng target → fallback full path.
- Heading chèn vào link được sanitize: `heading.replace(/([:#|^\\\r\n]|%%|\[\[|]])/g," ").replace(/\s+/g," ").trim()`.

### Cấu trúc CachedMetadata (worker.js)

Position mọi nơi: `{line: 0-based, col: 0-based, offset: 0-based}`; `position = {start, end}`.

```js
{
  frontmatter?: object,
  frontmatterPosition?: Pos,
  frontmatterLinks?: [{key:"prop"|"prop.0", link, original, displayText}],
  links?:    [{position, link, original, displayText}],
  embeds?:   [{position, link, original, displayText}],
  tags?:     [{position, tag /* kèm # */}],
  headings?: [{position, heading /* text thô */, level}],
  footnotes?: [{position, id}], footnoteRefs?: [{position, id}],
  referenceLinks?: [{position, id, link}],
  sections?: [{type /* paragraph|heading|list|code|blockquote|callout|yaml|... */, position, id? /* block id */}],
  listItems?: [{position, parent /* line 1-based của item cha; âm = root list */, task? /* ký tự [c] */, id?}],
  blocks?:   { [idLowercase]: {position, id} }
}
```
Mảng rỗng bị xóa.

`resolveSubpath(cache, subpath)`: split `#`, bỏ rỗng. `^id` ⇒ block (match id case-insensitive, tìm cả
listItem khớp); `[^id]` ⇒ footnote; còn lại walk heading tuần tự — so sánh qua
`h.replace(/[!"#$%&()*+,.:;<=>?@^`{|}~\/\[\]\\\r\n]/g," ").replace(/\s+/g," ").trim()` lowercase,
heading sau phải sâu hơn heading trước; trả `{type:"heading", current, next, start, end}`.

---

## 9. Editor

### Stack

- **CodeMirror 6** bundled trong app.js (`@codemirror/state|view|language|commands|search|autocomplete|collab|lint`,
  `@lezer/*`) — module map expose cho plugin.
- Markdown trong editor **không phải** Lezer-markdown mà là **HyperMD stream mode** adapt vào CM6.
- Root editor: class `markdown-source-view cm-s-obsidian mod-cm6` + `is-live-preview` khi LP bật.

### Live Preview — cơ chế

- Một CM6 StateField/decoration set duyệt token các dòng visible. Predicate lộ syntax:
  **nếu bất kỳ selection range nào chạm range token → hiện source thô**; ngược lại ký tự formatting bị
  ẩn bằng `Decoration.replace`, link thành `Decoration.mark({class:"cm-underline"})`, embed/ảnh/math/
  code-block/HR/callout/table thành **widget** block hoặc inline. Widget được recycle theo `sourcePath`+`href`.
- Node inline được coi là "ngữ cảnh formatting cần lộ":
  `["em","strong","inline-code","strikethrough","highlight","link","image","hmd-internal-link","hmd-embed","formatting-link","footref"]`.
- Toggle: `editor:toggle-source` (LP ↔ source thô trong edit view); `markdown:toggle-preview` Mod+E
  (edit ↔ reading). View state per-leaf: `state.mode` (`source`/`preview`) + `state.source` (bool, LP hay raw).
- **Vim**: port đầy đủ codemirror-vim bundled (`.cm-vimMode`, fat cursor, panel `:` lệnh).

### Suggesters

| Trigger | Điều kiện | Hành vi |
|---|---|---|
| `[[` link | `lastIndexOf("[[") > lastIndexOf("]")` trên text dòng đến cursor | query sau `[[`; có `#` → heading mode, `#^` → block mode; kết thúc `\|` → display-text mode; mặc định fuzzy trên mọi file linkable + alias frontmatter (alias gắn icon `lucide-forward`). `![[` tương tự, tự thêm `!` |
| `#` tag | `/(^|\s)#[^...charset tag...]*$/g` và ký tự sau cursor không phải `#` | suggest tag hiện có, Tab hoàn thành |
| `[^` footnote | `/(?:^|[^\[])(\[\^)([^\]]*)$/` (bỏ qua nếu là definition) | |
| `/` slash | `/(^|\s)\/([^\s\/]*)$/` (plugin `slash-command`, mặc định off) | chạy command |
| Property | trong Properties UI | fuzzy tên property (kèm icon type); value theo widget |

### Fuzzy search (`prepareQuery` / `fuzzySearch`) — thuật toán chính xác

- `prepareQuery`: lowercase; `tokens` = tách theo whitespace, mỗi ký tự punctuation
  (`/[ -⁯⸀-⹿\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]/`) và mỗi ký tự CJK
  (`/[ༀ-࿿぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/`) là token riêng;
  `fuzzy` = từng ký tự non-space.
- `fuzzySearch`: (1) thử **token pass** — từng token `indexOf` theo thứ tự từ cuối match trước; match
  bắt đầu giữa từ (không phải word-boundary/camelCase) → tăng bộ đếm penalty; (2) trượt → **per-char
  fuzzy pass** — từng ký tự xuất hiện theo thứ tự, match giữa từ chỉ khi liền kề match trước.
- **Điểm** (0 là hoàn hảo, càng âm càng tệ):
  ```
  score = 0 − max(0, numRanges − 1)            // phân mảnh
            − midWordPenalties / 10
            − (matchSpan − queryLen) / 100      // độ rời rạc trong span
            − firstMatchOffset / 1000           // match sớm tốt hơn
            − targetLen / 10000                 // target ngắn thắng
  ```
- `prepareSimpleSearch`: split space, mọi từ phải xuất hiện (substring), cùng công thức điểm, không penalty boundary.
- Filename search: thử basename trước; chỉ match full path → **điểm −1**.

---

## 10. Reading view

- Render **mỗi node mdast top-level thành một section riêng** (chuỗi HTML; heading mang `depth` để fold).
  Section lưu `{html, pos, level}`.
- Mỗi section: `el.appendChild(DOMPurify.sanitize(html, config §7))` + class `el-<tagName>` trên wrapper.
- **Ảo hóa (virtualized)**: section được đo; ẩn section dưới heading đã gập; chỉ attach section gần
  viewport; render theo queue và **recycle** (tái dùng `.internal-embed.is-loaded` khớp src/width/height/alt).
- **Post-processor pipeline**: `registerPostProcessor(fn, sortOrder)`, sort tăng dần theo `sortOrder||0`,
  chạy `fn(sectionEl, context)` (được trả Promise). Built-in (order 0, theo thứ tự đăng ký): resolver
  internal-link, tag link, embed, wiring checkbox, wiring callout icon/fold, bọc table RTL/scroll,
  xử lý ảnh, nút copy code, Prism, mermaid, block `query`, footnote backref.
- **Internal link**: anchor có `data-href`, class `internal-link` (+ `is-unresolved` qua
  `metadataCache.isUnresolved`). Click: `openLinkText(href, sourcePath, Keymap.isModEvent(e))` —
  Mod = tab mới, Mod+Alt = split, Mod+Alt+Shift = window mới. `mouseover` → trigger
  `hover-link` (page preview).
- **Heading**: mang `data-heading` = text nguồn thô. Điều hướng subpath dùng `resolveSubpath` + scroll
  (không dùng URL fragment).
- **Embed**: tìm `.internal-embed:not(.is-loaded)`, load với depth tracking qua WeakMap —
  **giới hạn lồng depth ≤ 5**, vượt → render link fallback. Embed markdown re-enter chính renderer.

---

## 11. Global Search

### Kiến trúc

- **Không có inverted index** — search là **scan tuyến tính** trên `vault.getFiles()` (queue async hủy được),
  bỏ qua Excluded files; chỉ `cachedRead` file `md`/`canvas` khi query cần content. Chạy trên **main thread**
  (worker.js chỉ là metadata parser). Tag/heading/listItem/frontmatter offset lấy từ metadata cache.
- File `.canvas`: query chạy trên text của mọi node `type:"text"` (key kết quả `canvas-<nodeId>`) + filename;
  plugin canvas giữ metadata cache per-node nên `tag:`/`task:` hoạt động trong card.

### Tokenizer

Token: `quote` (`"..."` escape `\"`), `regex` (`/.../` escape `\/`), `not` (`-`), `bracket` `[` `]`,
`parenthesis` `(` `)`, `colon` `:`, `greaterthan` `>`, `lessthan` `<`, text trần split space.
Từ trần viết hoa đúng `OR`, `TRUE`, `FALSE`, `EMPTY` thành token riêng.

### Grammar

```
query      := andGroup (OR andGroup)*       // AND (space) bind chặt hơn OR
andGroup   := primary+
primary    := operator ":" primary          // file:foo
            | "[" query (":" query)? "]"    // [name] hoặc [name:value]
            | "-" primary                   // phủ định
            | ">" primary | "<" primary     // so sánh (trong [prop:>x])
            | "(" query ")"
            | TRUE | FALSE | EMPTY
            | text | "phrase" | /regex/
```
- Operator lạ trước `:` → lỗi `Operator "x" not recognized`.
- Operator "exclusive" không lồng nhau được (vd `line:(file:x)` lỗi), trừ `section:` tự lồng được.
  `match-case:`/`ignore-case:` lồng tự do. `[prop]` không lồng trong `[...]`.

### Semantics match

- **Text trần**: substring (regex-escaped), flags `gmi` (case-insensitive) / `gm` (sensitive).
  Key mặc định: `filename` (md/canvas/base) + `content` (md).
- **"Phrase"**: trên `content` dùng word-boundary 2 đầu (nếu đầu/cuối là ký tự word); trên
  `filename`/`filepath` substring thường; trên propertyName = so sánh bằng case-insensitive.
- **Regex**: compile nguyên trạng, bỏ match độ dài 0.
- Match trả về cặp offset `[start,end]` đã merge sort theo key.

### Bảng operator đầy đủ

| Operator | Hành vi |
|---|---|
| `match-case:X` / `ignore-case:X` | ép case cho biểu thức con |
| `path:X` | match full path (exclusive) |
| `file:X` | match filename (exclusive) |
| `content:X` | chỉ body (exclusive) |
| `line:X` | sub-query phải match trong **1 dòng** |
| `block:X` | trong 1 block (sections + listItems từ cache) |
| `section:X` | trong 1 section (giữa các heading); tự lồng được |
| `task:X` | trong task item; `task:""` = mọi task |
| `task-todo:X` | task status `" "` |
| `task-done:X` | task status ≠ `" "` (**mọi ký tự non-space đều tính done**) |
| `tag:X` | tag từ cache + frontmatter; tự thêm `#`; match `^tag($|/)` case-insensitive (`tag:#a` khớp `#a/b`) |
| `[name]` | có property tên match |
| `[name:value]` | tên AND giá trị match (array: phần tử bất kỳ); value hỗ trợ TRUE/FALSE/EMPTY/quote/regex/`>`/`<` |

### View state, sort, context

- Sort (chung với file explorer): `alphabetical`, `alphabeticalReverse`, `byModifiedTime`,
  `byModifiedTimeReverse`, `byCreatedTime`, `byCreatedTimeReverse`. **Không có sort theo relevance.**
- **Context mặc định**: mở rộng match đến ranh giới dòng, tối đa **100 ký tự** mỗi phía (cắt → `…`);
  match chồng lấn trong cửa sổ gộp 1 hàng kết quả.
- **Extra context**: match trong list item → cả subtree item; trong section → cả section; còn lại
  tối đa 1000 ký tự mỗi phía chặn bởi dòng trống/heading.
- Highlight bằng span `search-result-file-matched-text`; lịch sử query: localStorage `recent-searches`.

---

## 12. Quick Switcher

Settings `switcher.json`: `{showExistingOnly:false, showAttachments:true, showAllFileTypes:false}`.
Giới hạn **20** gợi ý; `Shift+Enter` tạo note; `Tab` autocomplete path.

Nguồn gợi ý:
1. Query rỗng → recent files (không chấm điểm).
2. **File**: match target = `path bỏ .md`; thử **basename trước**, fail → full path với **điểm −1**.
3. **Alias** frontmatter (luôn bật) → `{type:"alias", alias, file}`.
4. **Unresolved links** (trừ khi `showExistingOnly`) → chọn = tạo note.
5. **Bookmarks** (nếu bật): match `groupPath + title`; bookmark non-file cũng hiện.
6. **Heading KHÔNG nằm trong switcher.**
7. File khớp Excluded files → **điểm −10** + class `mod-downranked`.
8. Sort điểm giảm dần; **≥ 10000 file** chuyển fuzzy → simple word search.

---

## 13. Graph view

### Engine

- **Render**: PixiJS lên `<canvas>`; màu đọc từ CSS bằng probe div
  (`graph-view color-fill`, `color-fill-focused`, `color-fill-tag`, `color-fill-unresolved`,
  `color-fill-attachment`, `color-arrow`, `color-circle`, `color-line`, `color-text`,
  `color-fill-highlight`, `color-line-highlight`) đọc computed `color`+`opacity`.
- **Physics**: worker `sim.js` — fork **d3-force** (forceX/Y + forceLink + forceManyBody + forceCollide,
  Barnes-Hut quadtree) có **WASM fast path**, fallback JS.

### Protocol & hằng số sim.js

Message vào: `{nodes: {id: [x,y]|null}, links: [[src,dst],...], forceNode: {id,x,y}|null (ghim khi kéo),
forces: {centerStrength, linkStrength, linkDistance, repelStrength}, alpha, alphaTarget, run}`.

Mặc định: `alpha=1`, `alphaDecay = 1 − 0.001^(1/300)` (~300 tick), `alphaMin=0.001` (dưới là dừng),
`centerStrength=0.1`, `linkStrength=1`, `linkDistance=250`, `repel=-1000`, **`velocityDecay=0.6`**, ~60fps.

Forces: `forceX(0)`+`forceY(0)` strength = centerStrength (**không phải** d3 forceCenter);
`forceLink.distance(linkDistance)`, strength = linkStrength × default d3 (`1/min(degree(src),degree(dst))`);
`forceManyBody.strength(repel).distanceMin(30)` — app gửi `repel = −(slider³)`;
`forceCollide(radius=60, strength=0.5)`. Data mới reheat với `alpha: 0.3`.
Output: Float32 positions transferable mỗi tick.

### graph.json — schema đầy đủ

```jsonc
{
  "collapse-filter": false,        // section Filters đang gập (sinh "collapse-"+sectionId:
  "search": "",                    //   filter|color-groups|display|forces)
  "showTags": false,               // default false
  "showAttachments": false,        // default false
  "hideUnresolved": false,         // default false
  "showOrphans": true,             // default true
  "collapse-color-groups": false,
  "colorGroups": [ { "query": "...", "color": { "a": 1, "rgb": 16711680 } } ],
  "collapse-display": false,
  "showArrow": false,
  "textFadeMultiplier": 0,         // slider -3..3 bước 0.1
  "nodeSizeMultiplier": 1,         // slider 0.1..5
  "lineSizeMultiplier": 1,         // slider 0.1..5
  "collapse-forces": false,
  "centerStrength": 0.5187...,     // slider 0..1; default = inverse-curve(0.1) ≈ 0.5187
  "repelStrength": 10,             // slider 0..20; worker nhận -(v³)
  "linkStrength": 1,               // slider 0..1; worker nhận curve(v)
  "linkDistance": 250,             // slider 30..500, raw
  "scale": 0.0289,                 // mức zoom đã lưu (clamp 1/128..8)
  "close": true                    // panel controls đang đóng
}
```
**Đường cong slider**: giá trị lưu là vị trí slider; worker nhận
`curve(v, 0.01) = (0.01^(1−v) − 0.01)/(1 − 0.01)` cho centerStrength/linkStrength (exponential,
curve(0)=0, curve(1)=1); repel nhận `−v³`.

### Dựng graph, kích thước node, màu

- Node = file đã cache (+ tag node nếu `showTags`; attachment; unresolved). Edge từ
  `metadataCache.resolvedLinks` (+ unresolved nếu hiện). Excluded files bị bỏ.
- **Color groups**: đánh giá **theo thứ tự mảng, match đầu tiên thắng**.
- **Thứ tự màu node**: focused (hover/selected, nếu CSS alpha>0) → group color → tag → unresolved →
  attachment → fill mặc định.
- **Bán kính node**: `nodeSizeMult × clamp(3·sqrt(weight+1), 8, 30)` — `weight` = số link xuôi+ngược
  (global) hoặc trọng số BFS (local).
- **Text fade**: `textAlpha = clamp(log2(scale) + 1 − textFadeMultiplier, 0, 1)`; scale label = `sqrt(1/scale)`.
- **Zoom**: clamp `[1/128, 8]`, lerp mũ 0.85/frame.
- **Animate (timelapse)**: re-add node theo `min(ctime,mtime)`.
- **Local graph** defaults: `{showAttachments:false, hideUnresolved:false, showOrphans:true, showTags:false,
  localJumps:1 (slider 1..5), localInterlinks:false, localForelinks:true, localBacklinks:true}` —
  BFS từ file gốc, weight gốc 30 giảm dần theo hop; lưu trong view state, không vào graph.json.

---

## 14. Canvas

### Format `.canvas` (JSON Canvas)

Top level: `{ "nodes": [...], "edges": [...] }` — key lạ được giữ nguyên round-trip (`unknownData`).

**Node chung**: `{ "id": "<16 hex>", "x": int, "y": int, "width": int, "height": int, "color"?: string }`
— tọa độ/kích thước **làm tròn int**; `color` bỏ khi rỗng; giá trị `"1"`..`"6"`
(1 đỏ, 2 cam, 3 vàng, 4 lục, 5 cyan, 6 tím — CSS `--canvas-color-N`) **hoặc** `"#RRGGBB"`
(legacy `"r,g,b"` convert sang hex khi load).

| type | field thêm |
|---|---|
| `"text"` | `"text": "<markdown>"` |
| `"file"` | `"file": "<vault path>", "subpath"?: "#Heading" \| "#^block"` (bỏ khi rỗng) |
| `"link"` | `"url": "https://..."` (render webview) |
| `"group"` | `"label"?: string, "background"?: "<vault image path>", "backgroundStyle"?: "ratio"\|"repeat"` (bỏ khi `"cover"` default) |

**Edge**:
```json
{ "id": "<hex>", "fromNode": "<nodeId>", "fromSide": "top|right|bottom|left",
  "fromEnd": "none|arrow",   // bỏ khi "none" (default)
  "toNode": "<nodeId>", "toSide": "top|right|bottom|left",
  "toEnd": "none|arrow",     // bỏ khi "arrow" (default)
  "color"?: "1".."6"|"#hex", "label"?: "text" }
```
Side thiếu được tự tính từ vị trí tương đối 2 node.

### Hành vi

- Group kéo theo node bên trong; label group searchable.
- Text node → "Convert to file" thành node file `.md`.
- **Viewport (zoom/pan) không nằm trong file** — lưu localStorage `canvas-<filepath>` per vault.
- Settings plugin `.obsidian/canvas.json`: `{snapToObjects:true, snapToGrid:true}`.
- Text node được index cho global search.

---

## 15. Bases

`.base` = **YAML**. File rỗng → 1 view `table` tên "Table". Key lạ giữ trong `unrecognizedData`.

```yaml
filters:            # filter toàn cục: chuỗi formula HOẶC {and:[...]}, {or:[...]}, {not:[...]} (đệ quy, mỗi object đúng 1 key)
  and:
    - 'status != "done"'
    - or:
        - file.hasTag("project")
        - note.priority > 2
formulas:           # tên -> chuỗi formula
  ppu: "(price / age).toFixed(2)"
properties:         # cấu hình per-property
  note.price:
    displayName: Price
newItemFolder: "x"
newItemTemplate: "t.md"
views:              # mảng; view đầu là default
  - type: table     # bắt buộc; types: "table", "cards", "list" (plugin mở rộng được)
    name: My view   # bắt buộc, không rỗng
    filters: ...    # cùng shape and/or/not, scope theo view
    order: [file.name, note.price]        # thứ tự cột (property ids)
    sort: [{property: note.price, direction: DESC}]   # ASC|DESC
    groupBy: {property: note.status, direction: ASC}
    summaries: {note.price: "Average"}
    limit: 10
```

**Namespace property id**: `name` trần → `note.name` (frontmatter); prefix `file.` (metadata file:
name, path, size, mtime, tags…), `formula.` (định nghĩa trong `formulas`), `note.` (frontmatter).
Chuỗi filter là biểu thức formula (`file.hasTag(...)`, toán tử so sánh, `.toFixed()`…).
View đang active là ephemeral (workspace), không lưu vào file.

---

## 16. Daily notes / Templates

**Engine biến template** (dùng chung): thay `{{key}}` **case-insensitive**, rồi `{{date}}` / `{{time}}` /
`{{date:FORMAT}}` / `{{time:FORMAT}}` với 1 snapshot `moment()`; default `date → "YYYY-MM-DD"`,
`time → "HH:mm"`, override bằng options `{dateFormat, timeFormat}`.

- **Daily notes**: tên = `moment().format(format || "YYYY-MM-DD")`; folder = option, fallback
  newFileLocation; template expand với `{title: <chuỗi ngày>}`. `openBehavior:"daily"` mở lúc launch.
- **Templates**: chọn file dưới `folder`; cung cấp `{{title}}` (basename file active), `{{date}}`, `{{time}}`.
- **Note composer**: template merge/extract hỗ trợ `{{fromTitle}}`, `{{newTitle}}`, `{{content}}`
  (tự append `\n\n{{content}}` nếu thiếu).
- **Unique note creator (zk-prefixer)**: tên = `moment().format(format || "YYYYMMDDHHmm")`; chống trùng:
  nếu có file bắt đầu bằng chuỗi sinh ra → cộng thời gian theo đơn vị nhỏ nhất trong `m,h,d,w,M,y`
  làm thay đổi chuỗi format, đến khi unique; mở với cursor ở chế độ rename.

---

## 17. File handling

- **Attachments** — `getAvailablePathForAttachments(name, ext, sourceFile)` theo `attachmentFolderPath`:
  `"."`/`"./"` → folder cha của note; `"./sub"` → `<noteParent>/sub`; còn lại = path literal;
  folder tự tạo (tra case-insensitive trước); filename sanitize + cắt 250 ký tự; trùng → suffix
  `name 1.ext`, `name 2.ext`… Dùng bởi paste/drop, audio recorder, tải URL (extension từ content-type).
- **Rename + update link**: `renameFile` bọc trong `runAsyncLinkUpdate` — đợi metadata cache sạch,
  **snapshot toàn bộ ref đã resolve** (`iterateAllRefs`), thực hiện rename, rồi viết lại wikilink/mdlink
  trong các file nguồn bị ảnh hưởng (sinh lại qua `fileToLinktext` theo `newLinkFormat`/`useMarkdownLinks`);
  rename heading/block đi qua updater `renameSubpath`. `alwaysUpdateLinks:false` → hỏi user.
- **Delete**: confirm theo `promptDelete` (dialog kiêm xử lý `deleteUnlinkedAttachments` — xóa kèm
  attachment chỉ được tham chiếu bởi note bị xóa). Đích theo `trashOption`: `system` → OS trash
  (fallback local nếu fail), `local` → `<vault>/.trash/` (suffix chống trùng), `none` → xóa hẳn.
- **File recovery**: IndexedDB **`<appId>-backup`** v1, store `backups` (autoIncrement,
  index `path`, `ts`), record `{path, ts, data}`. Trigger khi vault `modify`, `file-open`, `create`;
  resave timer 60s, cleanup mỗi giờ (option: interval phút + retention ngày). UI diff snapshot.
- **Watch ngoài**: `fs.watch` đệ quy (+ watch ẩn cho configDir); `.obsidian/*.json` đổi → hot-reload.

---

## 18. Per-device state

`loadLocalStorage(k)` = `JSON.parse(localStorage["<appId>-" + k])` — **per-vault per-device**.

Key per-vault (prefix `<appId>-`): `config` (tên configDir thay thế), `note-fold-<path>` (fold state,
dọn khi xóa file), `tag-pane-fold`, `canvas-<path>` (viewport canvas), `recent-searches`,
`recent-commands`, `page-preview-unfold-properties`, `last-plugin-update-check`,
`enable-plugin-<appId>` ("true" = tắt restricted mode).

Key global: `theme`, `local-themes`, `communityPluginSortOrder`, `communityThemeSortOrder`,
`most-recently-installed-version`, `spellcheck-languages`, `vim`, `mobile-selected-vault`,
`history-show-diff`, `MathJax-Menu-Settings`.

IndexedDB:
| DB | version | stores | dùng cho |
|---|---|---|---|
| `<appId>-cache` | 19 | `file`, `metadata` | metadata index (§8) |
| `<appId>-backup` | 1 | `backups` | File Recovery |
| `<appId>-sync` | 1 | `data` | Sync (xóa sau 30s nếu Sync tắt) |
| `<appId>-webview` | 1 | `icons`, `history` | Web Viewer |

---

## 19. CSS theming

`app.css` ~20,600 dòng. **Kiến trúc tầng:**
1. `:root` — chỉ heading weights (để theme override được): `--h1-weight:700`, h2..h6 600
   (variable fonts: 700/680/660/640/620/600).
2. **`body`** — block token chủ (~840 dòng): mọi variable component + "Color mappings" map token
   ngữ nghĩa vào ramp `--color-base-*`.
3. `.theme-light` / `.theme-dark` (trên `<body>`) — định nghĩa palette thật + vài override dark.
4. `body` tiếp — font stacks + `--font-text-size: 16px`.

> **Bài học specificity:** token đặt trên `body` (không phải `:root`), palette trên
> `body.theme-light/.theme-dark` — theme/snippet cộng đồng dựa vào đúng thứ tự này.

### Accent system

```css
--accent-h: 258; --accent-s: 88%; --accent-l: 66%;  /* tím mặc định ≈ #8a5cf5 */
--color-accent: hsl(var(--accent-h), var(--accent-s), var(--accent-l));
/* light */ --color-accent-1: hsl(calc(h−1), calc(s*1.01), calc(l*1.075)); --color-accent-2: hsl(calc(h−3), calc(s*1.02), calc(l*1.15));
/* dark  */ --color-accent-1: hsl(calc(h−3), calc(s*1.02), calc(l*1.15));  --color-accent-2: hsl(calc(h−5), calc(s*1.05), calc(l*1.29));
--text-accent: var(--color-accent) /* dark: accent-1 */;
--interactive-accent: var(--color-accent-1) /* dark: accent */;
--interactive-accent-hover: var(--color-accent-2) /* dark: accent-1 */;
```

### Color ramp

| Var | Light | Dark |
|---|---|---|
| `--color-base-00` | `#ffffff` | `#1e1e1e` |
| `--color-base-05` | `#fcfcfc` | `#212121` |
| `--color-base-10` | `#fafafa` | `#242424` |
| `--color-base-20` | `#f6f6f6` | `#262626` |
| `--color-base-25` | `#e3e3e3` | `#2a2a2a` |
| `--color-base-30` | `#e0e0e0` | `#363636` |
| `--color-base-35` | `#d4d4d4` | `#3f3f3f` |
| `--color-base-40` | `#bdbdbd` | `#555555` |
| `--color-base-50` | `#ababab` | `#666666` |
| `--color-base-60` | `#707070` | `#999999` |
| `--color-base-70` | `#5c5c5c` | `#b3b3b3` |
| `--color-base-100` | `#222222` | `#dadada` |

`--mono-rgb-0`: `255,255,255` / `0,0,0`; `--mono-rgb-100`: `0,0,0` / `255,255,255`;
`--highlight-mix-blend-mode`: `darken` / `lighten`; `color-scheme` tương ứng.

### Extended colors

| Var | Light | Dark |
|---|---|---|
| `--color-red` | `#e93147` (233,49,71) | `#fb464c` (251,70,76) |
| `--color-orange` | `#ec7500` (236,117,0) | `#e9973f` (233,151,63) |
| `--color-yellow` | `#e0ac00` (224,172,0) | `#e0de71` (224,222,113) |
| `--color-green` | `#08b94e` (8,185,78) | `#44cf6e` (68,207,110) |
| `--color-cyan` | `#00bfbc` (0,191,188) | `#53dfdd` (83,223,221) |
| `--color-blue` | `#086ddd` (8,109,221) | `#027aff` (2,122,255) |
| `--color-purple` | `#7852ee` (120,82,238) | `#a882ff` (168,130,255) |
| `--color-pink` | `#d53984` (213,57,132) | `#fa99cd` (250,153,205) |

(mỗi màu có biến `-rgb` kèm theo)

### Token ngữ nghĩa chính

| Token | Định nghĩa | Light | Dark |
|---|---|---|---|
| `--background-primary` | base-00 | `#ffffff` | `#1e1e1e` |
| `--background-primary-alt` | base-10 | `#fafafa` | `#242424` |
| `--background-secondary` | base-20 | `#f6f6f6` | `#262626` |
| `--background-secondary-alt` | theme | base-05 `#fcfcfc` | base-30 `#363636` |
| `--background-modifier-hover` | `rgba(mono-100, .067)` | | |
| `--background-modifier-active-hover` | accent @10% | | |
| `--background-modifier-border` | base-30 | `#e0e0e0` | `#363636` |
| `--background-modifier-border-hover` | base-35 | `#d4d4d4` | `#3f3f3f` |
| `--background-modifier-border-focus` | base-40 | `#bdbdbd` | `#555555` |
| `--background-modifier-error` | red | | |
| `--background-modifier-success` | green | | |
| `--background-modifier-message` | `rgba(0,0,0,0.9)` | | |
| `--background-modifier-form-field` | base-00 | `#ffffff` | base-25 `#2a2a2a` |
| `--background-modifier-cover` | theme | `rgba(220,220,220,.4)` | `rgba(10,10,10,.4)` |
| `--text-normal` | base-100 | `#222222` | `#dadada` |
| `--text-muted` | base-70 | `#5c5c5c` | `#b3b3b3` |
| `--text-faint` | base-50 | `#ababab` | `#666666` |
| `--text-on-accent` | `white` | | |
| `--text-error/warning/success` | red/orange/green | | |
| `--text-selection` | accent @20% | | dark: accent @33% |
| `--text-highlight-bg` | `rgba(255,208,0,0.4)` | | |
| `--interactive-normal` | base-00 | `#ffffff` | base-30 `#363636` |
| `--interactive-hover` | base-10 | `#fafafa` | base-35 `#3f3f3f` |

### Typography

```css
--font-default: ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI",
  "Google Sans Flex", Roboto, "Inter Variable", "Inter", "Apple Color Emoji",
  "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
--font-monospace-default: ui-monospace, SFMono-Regular, "Cascadia Mono", "Roboto Mono",
  "DejaVu Sans Mono", "Liberation Mono", Menlo, Monaco, "Consolas", "Source Code Pro", monospace;
--font-interface: var(--font-interface-override), var(--font-interface-theme), var(--default-font,'??'), var(--font-default);
--font-text: var(--font-text-override), var(--font-text-theme), var(--font-default);
--font-monospace: var(--font-monospace-override), var(--font-monospace-theme), var(--font-monospace-default);
--font-text-size: 16px;
```
`'??'` = tên font cố ý không hợp lệ làm placeholder; app ghi đè slot `-override`/`-theme` runtime từ settings.

- Cỡ tương đối: `--font-smallest: 0.8em; --font-smaller: 0.875em; --font-small: 0.933em`
- UI: `--font-ui-smaller: 12px; --font-ui-small: 13px; --font-ui-medium: 15px; --font-ui-large: 20px`
- Weight: `--font-thin:100` … `--font-black:900`; `--font-weight: var(--font-normal)`
- Line height: `--line-height-normal: 1.5; --line-height-tight: 1.3`

### Spacing / radius / z-index

- `--size-2-1: 2px; --size-2-2: 4px; --size-2-3: 6px`
- `--size-4-1: 4px; -2: 8px; -3: 12px; -4: 16px; -5: 20px; -6: 24px; -8: 32px; -9: 36px; -10: 40px; -12: 48px; -16: 64px; -18: 72px`
- `--radius-s: 4px; --radius-m: 8px; --radius-l: 12px; --radius-xl: 16px`
- `--border-width: 1px`
- Z: `--layer-cover:5; sidedock:10; status-bar:15; popover:30; slides:45; modal:50; notice:60; menu:65; tooltip:70; dragged-item:80`

### Shadow (light / dark)

```css
/* light */
--shadow-s: 0px 1px 2px rgba(0,0,0,.028), 0px 3.4px 6.7px rgba(0,0,0,.042), 0px 15px 30px rgba(0,0,0,.07);
--shadow-l: 0px 1.8px 7.3px rgba(0,0,0,.071), 0px 6.3px 24.7px rgba(0,0,0,.112), 0px 15px 30px rgba(0,0,0,.1);
/* dark */
--shadow-s: 0px 1px 2px rgba(0,0,0,.121), 0px 3.4px 6.7px rgba(0,0,0,.179), 0px 15px 30px rgba(0,0,0,.3);
--shadow-l: 0px 1.8px 7.3px rgba(0,0,0,.071), 0px 6.3px 24.7px rgba(0,0,0,.112), 0px 30px 90px rgba(0,0,0,.2);
```

### Metrics chrome

- `--header-height: 40px` (view header, tab bar, titlebar offset)
- Ribbon: `--ribbon-width: 44px`, bg `--background-secondary`
- Tabs: `--tab-width: 200px; --tab-max-width: 320px; --tab-curve: 6px; --tab-radius-active: 6px 6px 0 0;
  --tab-font-size: var(--font-ui-small)`; text: faint → muted (active/focused) → normal (focused-active-current);
  stacked: `--tab-stacked-pane-width: 700px`
- Status bar: bg secondary, border `1px 0 0 1px`, radius `8px 0 0 0` (pill nổi góc phải dưới),
  font `--font-ui-smaller`, `position: fixed`
- Scrollbar: 12px, thumb `rgba(mono-100, .1)` (active .2), chỉ khi `body.styled-scrollbars`
- Divider splitter: `--divider-color: var(--background-modifier-border)`; hover →
  `--interactive-accent`, width 1px → 3px
- Icon: `--icon-xs:14px; s:16px; m/l:18px; xl:32px`; stroke 2/2/1.75/1.75/1.25; mặc định
  `--icon-color: var(--text-muted)`, opacity 0.85
- Input: `--input-height: 30px; --input-radius: 5px`; Toggle: 40×18px thumb trắng
- Modal: `--modal-radius: 12px`, dialog 560px (max 80vw), settings 90vw×85vh max 1100×1000
- Prompt (switcher/palette): width 700px, max 80vw/70vh, input 40px, `border-radius: var(--radius-l)`,
  `box-shadow: var(--shadow-l)`, top 80px
- Popover: 450×400px; Menu: bg `--background-secondary`, radius 8px, padding 6px
- Animation: `--anim-duration-superfast: 70ms; fast: 140ms; moderate: 300ms; slow: 560ms`

### Variable editor/markdown đáng chú ý

- `--file-line-width: 700px` (readable line length); `--file-margins: 32px`
- Heading size: h1 `1.618em`, h2 `1.462em`, h3 `1.318em`, h4 `1.188em`, h5 `1.076em`, h6 `1em`;
  letter-spacing −0.015/−0.011/−0.008/−0.005/−0.002/0 em; inline-title alias h1
- `--p-spacing: 1rem` (source mode: 0); `--indent-size: 4` (cũng là `tab-size`)
- **Bold**: `b, strong { font-weight: calc(var(--font-weight) + var(--bold-modifier)) }` với
  `--bold-modifier: 200`
- Code: `--code-size: var(--font-smaller)`, bg `--background-primary-alt`; màu syntax:
  comment=faint, function=yellow, keyword=pink, string=green, operator/tag=red, property=cyan,
  value=purple, important=orange
- Blockquote: border-left 2px `--interactive-accent`, padding-left 24px
- Link: internal/external đều accent + underline; unresolved: opacity 0.7
- Tag pill: bg accent@10%, radius `2em`, padding `0.25em 0.65em`, size `--font-smaller`
- Embed: border-left `2px solid var(--interactive-accent)`, padding-left 24px, max-height 4000px
- Checkbox: size = `--font-text-size`, radius 4px, checked bg `--interactive-accent`;
  done: line-through + `--text-muted`
- Table: border 1px `--background-modifier-border`, header weight bold-modifier
- Nav (file explorer): item size `--font-ui-small`, padding `4px 8px 4px 24px`, radius 4px,
  selected bg accent@15%, children margin-left 12px + indent guide 1px
- Graph: `--graph-text: var(--text-normal); --graph-line: base-35; --graph-node: var(--text-muted);
  --graph-node-unresolved: var(--text-faint); --graph-node-focused: var(--text-accent);
  --graph-node-tag: var(--color-green); --graph-node-attachment: var(--color-yellow)`
- Canvas: `--canvas-background: var(--background-primary); --canvas-dot-pattern: base-30;
  --canvas-color-1..6` = red/orange/yellow/green/cyan/purple rgb

### Body feature classes

| Class | Tác dụng |
|---|---|
| `.theme-light` / `.theme-dark` | đổi palette |
| `.mod-macos/.mod-windows/.mod-linux` | chrome theo OS |
| `.is-frameless` / `.is-hidden-frameless` | titlebar custom |
| `.is-focused` | cửa sổ focus → màu titlebar/tab focused |
| `.is-fullscreen`, `.is-maximized`, `.is-popout-window`, `.is-translucent` | |
| `.is-grabbing` | đang kéo: ép cursor, tắt hover |
| `.is-mobile/.is-phone/.is-tablet/.is-ios` | layout mobile |
| `.show-ribbon` | **vắng mặt** → `--ribbon-width: 0` + ẩn ribbon |
| `.show-inline-title` | vắng → ẩn inline title |
| `.show-view-header` | vắng → ẩn hẳn `.view-header` |
| `.styled-scrollbars` | bật scrollbar custom |
| `.mod-rtl` | RTL |

Lưu ý: "Readable line length" **không phải** body class — nó toggle `.is-readable-line-width` trên
`.markdown-preview-view` / `.markdown-source-view.mod-cm6` (cap `--file-line-width: 700px`).

---

## 20. DOM classes

### Shell

```
body.theme-dark.mod-macos.is-frameless.is-focused.show-ribbon.show-inline-title…
├── .titlebar  (fixed top, app-region: drag)
│   └── .titlebar-inner > .titlebar-button-container.mod-left/.mod-right > .titlebar-button
├── .app-container  (flex column 100%)
│   ├── .horizontal-main-container  (flex row)
│   │   └── .workspace
│   │       ├── .workspace-ribbon.mod-left  (44px, flex column; .side-dock-actions > .side-dock-ribbon-action.clickable-icon)
│   │       ├── .workspace-split.mod-horizontal.mod-left-split
│   │       ├── .workspace-split.mod-vertical.mod-root  (bg --background-primary)
│   │       └── .workspace-split.mod-horizontal.mod-right-split
│   └── .status-bar  (fixed bottom-right) > .status-bar-item(.mod-clickable)
└── overlay cùng cấp .app-container:
    .modal-container > .modal-bg + (.modal | .prompt)
    .suggestion-container, .popover.hover-popover, .menu, .tooltip, .notice-container, .drag-ghost
```

### Split / tabs / leaf

- `.workspace-split` — `.mod-vertical` (row, con `flex:1 0 0; width:0`), `.mod-horizontal` (column),
  `.mod-root/.mod-left-split/.mod-right-split` (sidebar `flex:0 0 auto`, size inline JS).
  Con có `.workspace-leaf-resize-handle` (strip 3px, hover accent, cursor col/row-resize).
- `.workspace-tabs` (.mod-top = chạm đỉnh window, .mod-active = group focus, .mod-stacked)
  - `.workspace-tab-header-container` (height 40px) > `-inner` (drag region)
    - `.workspace-tab-header[data-type]` — `.is-active` có bg `--tab-background-active` +
      **hiệu ứng góc cong ngược** bằng `::before/::after` (vòng tròn `--tab-curve` + clip-path +
      box-shadow fill — copy verbatim để pixel-perfect)
      - `.workspace-tab-header-inner` > `-icon` + `-title` + `-close-button`
    - controls: `.workspace-tab-header-new-tab`, `.workspace-tab-header-tab-list`
  - `.workspace-tab-container`
    - `.workspace-leaf` (`contain: strict`; `.mod-active`; `.is-highlighted::before` accent overlay 25%)
      - `.workspace-leaf-content[data-type][data-mode]`
        - `.view-header` (40px; ẩn nếu body thiếu `.show-view-header`) → `.view-header-nav-buttons`,
          `.view-header-title-container` (breadcrumb), `.view-actions > .view-action.clickable-icon`
        - `.view-content` (`height: calc(100% - var(--header-height))`)

Root split: leaf bg `--background-primary`; sidebar: bg `--background-secondary`, view-content padding `12px 12px 32px`.

### Markdown views

- **Edit**: `.markdown-source-view.mod-cm6` (+`.is-live-preview`, `.is-readable-line-width`, `.is-folding`)
  → CM6: `.cm-editor > .cm-scroller > .cm-sizer > .cm-contentContainer > .cm-content > .cm-line`;
  theme class `.cm-s-obsidian`.
  - Line classes: `HyperMD-header(-1..6)`, `HyperMD-list-line`, `HyperMD-quote`,
    `HyperMD-codeblock(-begin/-end/-bg)`, `HyperMD-task-line[data-task]`, `HyperMD-table-row`,
    `HyperMD-footnote`, `HyperMD-hr`
  - Span classes: `cm-header-1..6`, `cm-strong`, `cm-em`, `cm-highlight`, `cm-strikethrough`,
    `cm-inline-code`, `cm-hmd-internal-link`, `cm-link`, `cm-url`, `cm-hashtag(-begin/-end)`,
    `cm-formatting(-link/-list/-task/-quote/-header/-code)`, `cm-hmd-frontmatter`, `cm-hmd-footnote`,
    `cm-comment`, `cm-math`, `cm-footref`, `cm-blockquote-border`, `cm-embed-block`, `cm-callout`,
    `cm-table-widget`, `cm-fold-indicator`, `cm-indent`, `cm-active`
- **Reading**: `.markdown-reading-view > .markdown-preview-view.markdown-rendered`
  (padding 32px, scroll, `scrollbar-gutter: stable`) > `.markdown-preview-sizer.markdown-preview-section`
  (cap 700px khi readable) > `.markdown-preview-pusher` + div mỗi block.
- `.inline-title` (tiêu đề doc trên content), `.internal-embed/.inline-embed/.image-embed/.markdown-embed`.

### Tree (explorer/outline/bookmarks/search dùng chung)

```
.tree-item (.nav-folder/.nav-file)
├── .tree-item-self (.nav-folder-title/.nav-file-title)
│     [.is-clickable .mod-collapsible .is-active .is-selected .has-focus .is-being-dragged
│      .is-being-dragged-over .is-being-renamed .is-cut .has-active-menu]
│   ├── .tree-item-icon.collapse-icon  (absolute, margin-inline-start −20px)
│   ├── .tree-item-inner (-text/-subtext)
│   ├── .nav-file-tag  (badge extension: 9px uppercase, letter-spacing .05em)
│   └── .tree-item-flair-outer > .tree-item-flair  (số đếm)
└── .tree-item-children  (margin-left 12px + indent guide border-left)
```
Header pane: `.nav-header > .nav-buttons-container > .clickable-icon.nav-action-button(.is-active)`;
container `.nav-files-container`.

### Modal / prompt / suggestion / menu / tooltip

- `.modal-container(.mod-dim)` → `.modal-bg` + `.modal` (radius 12px, border 1px, padding 16px)
  → `.modal-close-button`, `.modal-header > .modal-title`, `.modal-content`, `.modal-button-container`.
- `.prompt` → `.prompt-input-container > input.prompt-input`, `.prompt-results` (chứa `.suggestion-item`),
  `.prompt-instructions > .prompt-instruction > .prompt-instruction-command`.
- `.suggestion-container`/`.popover`: bg primary, border 1px, shadow-s, radius 8px; bên trong
  `.suggestion > .suggestion-item` (padding 6px 12px; `.is-selected` bg hover; `.mod-complex` →
  `.suggestion-content > .suggestion-title (.suggestion-highlight=bold) + .suggestion-note`,
  `.suggestion-icon`, `.suggestion-aux > .suggestion-hotkey/.suggestion-flair`); `.suggestion-empty`.
- `.menu` (fixed, bg secondary, radius 8px) > `.menu-scroll` > `.menu-item` (`.selected`, `.is-disabled`,
  `.is-warning`, `.is-label`; `.menu-item-icon` + `.menu-item-title`; `.mod-submenu`); `.menu-separator`.
- `.tooltip` (fixed, bg `rgba(0,0,0,.9)`, **color #FAFAFA hardcode**, radius 4px, max-width 300px,
  animation pop-down 200ms).

---

## 21. Callouts

Slot màu là **RGB triplet** (không phải màu) để dùng được cả `rgba(var(--callout-color), 0.1)` (nền)
lẫn `rgb(var(--callout-color))` (title/icon). Box: bg `rgba(color, 0.1)`, border
`var(--callout-border-width)=0px solid rgba(color, 0.25)`, radius 4px, padding `12px 12px 12px 24px`,
margin `1em 0`, `mix-blend-mode: var(--highlight-mix-blend-mode)`.

| `data-callout` | Slot | Light RGB | Dark RGB | Icon |
|---|---|---|---|---|
| (default / `note` / không nhận diện) | `--callout-default` (blue) | 8,109,221 | 2,122,255 | `lucide-pencil` |
| `abstract`, `summary`, `tldr` | `--callout-summary` (cyan) | 0,191,188 | 83,223,221 | `lucide-clipboard-list` |
| `info` | `--callout-info` (blue) | 8,109,221 | 2,122,255 | `lucide-info` |
| `todo` | `--callout-todo` (blue) | 8,109,221 | 2,122,255 | `lucide-check-circle-2` |
| `important` | `--callout-important` (cyan) | 0,191,188 | 83,223,221 | `lucide-flame` |
| `tip`, `hint` | `--callout-tip` (cyan) | 0,191,188 | 83,223,221 | `lucide-flame` |
| `success`, `check`, `done` | `--callout-success` (green) | 8,185,78 | 68,207,110 | `lucide-check` |
| `question`, `help`, `faq` | `--callout-question` (orange) | 236,117,0 | 233,151,63 | `help-circle` |
| `warning`, `caution`, `attention` | `--callout-warning` (orange) | 236,117,0 | 233,151,63 | `lucide-alert-triangle` |
| `failure`, `fail`, `missing` | `--callout-fail` (red) | 233,49,71 | 251,70,76 | `lucide-x` |
| `danger`, `error` | `--callout-error` (red) | 233,49,71 | 251,70,76 | `lucide-zap` |
| `bug` | `--callout-bug` (red) | 233,49,71 | 251,70,76 | `lucide-bug` |
| `example` | `--callout-example` (purple) | 120,82,238 | 168,130,255 | `lucide-list` |
| `quote`, `cite` | `--callout-quote` | 158,158,158 (cả 2 theme) | — | `quote-glyph` |

---

## 22. Checklist clone

Khi sao chép một tính năng, đối chiếu các điểm "dễ sai" sau:

1. **Markdown**: dùng đúng regex §7 (đặc biệt charset tag, callout, block id `[a-zA-Z0-9-]`);
   nhớ `breaks: true` (newline đơn = `<br>`); display text mặc định `Note > Head`; size param ảnh.
2. **Link resolution**: 6 bước §8, case-insensitive toàn bộ, tie-break "cùng folder rồi path ngắn nhất".
3. **Search**: grammar + bảng operator §11; context 100 ký tự chặn dòng; 6 chế độ sort
   (không có relevance); operator exclusive không lồng.
4. **Fuzzy**: port nguyên công thức điểm §9 để ranking switcher giống hệt; penalty −1 path-only,
   −10 excluded.
5. **Graph**: d3-force với forceX/Y (không forceCenter), `velocityDecay 0.6`, repel `−slider³`
   `distanceMin 30`, collide(60, 0.5), reheat alpha 0.3, radius `clamp(3√(w+1), 8, 30)`,
   text fade `clamp(log2(scale)+1−fade, 0, 1)`, đường cong slider `(0.01^(1−v) − 0.01)/0.99`.
6. **Canvas**: làm tròn int x/y/w/h; luật bỏ field default (`fromEnd:"none"`, `toEnd:"arrow"`,
   `backgroundStyle:"cover"`); giữ key lạ round-trip — cần cho byte-identical.
7. **Settings**: chỉ ghi key khác default; tách app/appearance đúng whitelist; hot-reload khi file
   `.obsidian/*.json` đổi từ ngoài.
8. **CSS**: token trên `body`, palette trên `.theme-light/.theme-dark`; bold = font-weight + 200;
   callout color = RGB triplet; tab active dùng trick góc cong ngược; tooltip màu chữ hardcode.
9. **Embed depth ≤ 5**; mọi HTML render qua DOMPurify với config §7.
10. **Task**: mọi ký tự non-space = done; không hard-code danh sách state.
