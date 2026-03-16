# A2R Thin Client V3 - Complete Changes Summary

## 1. Backend Integration Settings (Already Handled)

The backend connection is already configured in:
- **Main Process**: `src/main/index.ts` and `src/main/connection-manager.ts`
- **Settings Stored**: 
  - `backend`: 'cloud' | 'desktop'
  - `cloudUrl`: WebSocket URL for cloud (default: ws://localhost:3010)
  - `desktopPort`: Local desktop port (default: 3010)
  
### Access Settings via:
1. **Tray Menu**: Right-click tray icon → Connection → Cloud/Desktop Mode
2. **Settings Modal**: Click ⚙️ gear icon in header
3. **Programmatic**: `window.thinClient.getSettings()` / `updateSettings()`

### Backend Stores:
- **Agent Store**: `src/stores/agentStore.ts` → fetches from `/api/agents`
- **Model Store**: `src/stores/modelStore.ts` → fetches from `/api/v1/providers`
- **Surface Store**: `src/stores/surfaceStore.ts` → local state (auto-discovery)

---

## 2. Gizzi Mascot Fixed

**Issue**: Gizzi wasn't showing when expanded

**Fix**: 
- Gizzi now ALWAYS shows when Agent Mode is ON (both compact and expanded)
- Moved inline with the "Agent On" button in the bottom row
- Uses `AnimatePresence` for smooth entry/exit animations

```
Bottom Row:
┌─────────────────────────────────────────────────────────┐
│ [Choose Agent]  [🎭 Agent On]  [Build]                 │
│                    ^ Gizzi inline when enabled         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Reduced Bottom Spacing

**Before**: 40px padding at bottom
**After**: 4px padding at bottom

**Changes in ThinClientApp.tsx**:
```css
.input-wrapper {
  padding-bottom: 4px;  /* Was 40px */
}
```

---

## 4. Discretion Text & Use Case Hints

### Discretion Text
- Shows at bottom of textarea: "A2R can make mistakes. Check important info."
- Appears only when input is empty
- Small, muted text (10px)

### Use Case Hints (Rotating)
- Rotates every 5 seconds in placeholder:
  - "Ask about your code with @vscode"
  - "Search the web with @browser"
  - "Check your calendar with @calendar"
  - "Query your database with @postgres"
  - "Review GitHub PRs with @github"
  - "Ask anything..."

---

## 5. Layout Reorganized

### New Layout:
```
┌─────────────────────────────────────────────────────────────┐
│ A2R [Desktop]          [⚙] [🗑] [✕]        ← Header (always)
├─────────────────────────────────────────────────────────────┤
│ [VS Code ●] [Chrome ●] [Terminal ●]        ← Connected Surfaces
├─────────────────────────────────────────────────────────────┤
│ [Kimi ▼]                [Connect ▼]         ← Toolbar
├─────────────────────────────────────────────────────────────┤
│ [+] Ask about your code with @vscode   [↑]  ← Input Area
│ A2R can make mistakes...                      (discretion text)
├─────────────────────────────────────────────────────────────┤
│ [Choose Agent] [🎭 Agent On] [Build]       ← Bottom Actions
└─────────────────────────────────────────────────────────────┘
```

### Button Positions:
| Button | Position | Notes |
|--------|----------|-------|
| Choose Agent | Bottom Left | Shows first agent name |
| Agent On/Off | Bottom Center | Has Gizzi inline when ON |
| Build/Plan | Bottom Right | Toggle mode |
| Connect | Toolbar Right | Shows count badge |
| Model Selector | Toolbar Left | Real models from API |

---

## 6. Surface Discoverer / Connector Tab

### New Component: `src/stores/surfaceStore.ts`
Manages connected surfaces similar to ChatGPT Apps / Claude MCP.

### Default Surfaces:
- **VS Code** - Read/edit files, run commands
- **Cursor** - AI code editor integration
- **Chrome** - Browser automation
- **Terminal** - Shell access
- **PostgreSQL** - Database queries
- **GitHub** - Repo/PR access (MCP)
- **Notion** - Page access (MCP)
- **Slack** - Message channels (MCP)

### UI Features:
1. **Horizontal Tabs**: Shows up to 3 connected surfaces at top
2. **Connect Button**: In toolbar, shows count badge
3. **+ Menu**: Lists connected surfaces + connect option
4. **Dropdown**: Full surface management (connect/disconnect)

### Usage:
- Click surface tab → adds `@surface` to input
- Click Connect → see available surfaces
- + Menu → Quick access to connected surfaces

---

## 7. Research: ChatGPT + Button / Claude MCP

### ChatGPT Approach (App Directory):
- **+ Button Menu**: Attachments, web search, connected apps
- **App Directory**: Browse all available integrations
- **Connection**: OAuth flow to third-party services
- **Invocation**: Type `@AppName` in prompt
- **Examples**: Spotify, Notion, Slack, GitHub, etc.

### Claude Approach (MCP - Model Context Protocol):
- **MCP Servers**: External processes exposing tools
- **Configuration**: `claude_desktop_config.json`
- **Transport**: Stdio (local) or HTTP (remote)
- **Discovery**: Auto-discovers tools from MCP servers
- **Open Standard**: Anyone can build MCP servers

### A2R Implementation (Hybrid):
```
ChatGPT UX Simplicity + Claude MCP Power

+ Button Menu:
  ├── Files or photos
  ├── Add to project
  ├── Add from GitHub
  ├── Web search
  ├── ───────────────
  ├── @VS Code (connected)
  ├── @Chrome (connected)
  ├── @Terminal (connected)
  ├── ───────────────
  └── Connect app...

Surface Types:
  - Native: VS Code, Chrome (native messaging)
  - MCP: GitHub, Notion, Slack (MCP servers)
  - Database: PostgreSQL, MongoDB
```

### Future Implementation:
1. **Surface Discovery**: Auto-detect running apps (VS Code, Chrome)
2. **Native Messaging**: Chrome extension handshake
3. **MCP Support**: Load MCP servers from config
4. **OAuth**: Connect cloud services (GitHub, Notion, etc.)

---

## Files Changed

### New Files:
| File | Description |
|------|-------------|
| `src/stores/surfaceStore.ts` | Surface/app connection management |
| `CONNECTOR_RESEARCH.md` | Research on ChatGPT/Claude connectors |

### Modified Files:
| File | Changes |
|------|---------|
| `src/components/InputArea.tsx` | Complete layout rebuild, Gizzi inline, hints |
| `src/components/ThinClientApp.tsx` | Header always visible, 4px bottom padding |
| `src/stores/modelStore.ts` | (No changes - already existed) |
| `src/stores/agentStore.ts` | (No changes - already existed) |

---

## Build Status

```
✓ TypeScript: Pass
✓ Production Build: Pass (1.07MB bundle)
✓ All dependencies resolved
```

## Next Steps for Connector Implementation:

1. **Native Messaging Host**: Implement for Chrome/VS Code
2. **MCP Client**: Add MCP protocol support
3. **OAuth Flow**: Connect cloud services
4. **Surface Actions**: Implement actual tool calls
5. **Context Injection**: Feed surface data into prompts
